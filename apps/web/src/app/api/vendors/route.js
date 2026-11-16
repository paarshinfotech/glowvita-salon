import _db from "@repo/lib/db";
import VendorServicesModel from "@repo/lib/models/Vendor/VendorServices.model";
import RegionModel from "@repo/lib/models/admin/Region.model";
import ReviewModel from "@repo/lib/models/Review/Review.model";
import AppointmentModel from "@repo/lib/models/Appointment/Appointment.model.js";
import ClientModel from "@repo/lib/models/Vendor/Client.model.js";
import mongoose from "mongoose";
import { assignRegion } from "@repo/lib/utils/assignRegion.js";

/* ── Static imports (moved off hot path) ───────────────────────────────────
   These were previously dynamic `await import(...)` calls inside the request
   handler, adding module-resolution overhead on every request that uses an
   offer code. They are now eagerly loaded at module initialisation time.    */
import CRMOfferModel from "@repo/lib/models/Vendor/CRMOffer.model.js";
import AdminOfferModel from "@repo/lib/models/admin/AdminOffers.model.js";
import CategoryModel from "@repo/lib/models/admin/Category.model.js";

/* ── In-memory region cache ─────────────────────────────────────────────────
   assignRegion() makes a DB round-trip on every request. Region data is
   essentially static (changes rarely), so we cache results for 5 minutes.   */
const regionCache = new Map(); // key → { regionId, expiresAt }
const REGION_TTL_MS = 5 * 60 * 1000;

async function resolveRegion(city, lat, lng) {
  const key = `${city}|${lat}|${lng}`;
  const cached = regionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.regionId;

  const regionId = await assignRegion(city, null, { lat, lng });
  regionCache.set(key, { regionId, expiresAt: Date.now() + REGION_TTL_MS });
  return regionId;
}

/* ── CORS helper ────────────────────────────────────────────────────────── */
const setCorsHeaders = (response) => {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
};

export const OPTIONS = async () => setCorsHeaders(new Response(null, { status: 200 }));

/* ── Offer resolution ───────────────────────────────────────────────────────
   Extracted into its own function so the logic is clear and easy to test.
   Returns the same shape as before; no business logic changed.              */
async function resolveOffer(offerCode) {
  if (!offerCode) return null;

  let offerVendorIds = null;
  let offerRegionId = null;
  let offerSpecialties = [];
  let offerCategories = [];
  let offerServices = [];
  let offerServiceCategories = [];
  let mainSalonCategories = [];
  let serviceCategoryIdsFromNames = [];

  const crmOffer = await CRMOfferModel.findOne({
    code: new RegExp(`^${offerCode}$`, "i"),
    status: { $ne: "Expired" },
  }).lean();

  if (crmOffer) {
    offerVendorIds = [crmOffer.businessId];
    offerServices = crmOffer.applicableServices || [];
    offerServiceCategories = crmOffer.applicableServiceCategories || [];
    offerSpecialties = (crmOffer.applicableSpecialties || []).filter((s) => s !== "");
    offerCategories = (crmOffer.applicableCategories || []).filter((s) => s !== "");
  } else {
    const adminOffer = await AdminOfferModel.findOne({
      code: new RegExp(`^${offerCode}$`, "i"),
      status: { $ne: "Expired" },
      isActive: { $ne: false },
    }).lean();

    if (adminOffer) {
      offerSpecialties = (adminOffer.applicableSpecialties || []).filter((s) => s !== "");
      offerCategories = (adminOffer.applicableCategories || []).filter((s) => s !== "");
      if (adminOffer.regionId) offerRegionId = adminOffer.regionId;
    }
  }

  if (offerCategories.length > 0) {
    const mainSet = new Set(["unisex", "men", "women"]);
    const serviceCategoryNames = [];
    offerCategories.forEach((cat) => {
      const lower = cat.toLowerCase();
      if (mainSet.has(lower)) mainSalonCategories.push(lower);
      else serviceCategoryNames.push(cat);
    });

    if (serviceCategoryNames.length > 0) {
      try {
        const matchedCats = await CategoryModel.find({
          name: { $in: serviceCategoryNames.map((n) => new RegExp(`^${n}$`, "i")) },
        })
          .select("_id")
          .lean();
        serviceCategoryIdsFromNames = matchedCats.map((c) => c._id);
      } catch (err) {
        console.error("Error looking up service category names:", err);
      }
    }
  }

  return {
    offerVendorIds,
    offerRegionId,
    offerSpecialties,
    offerServices,
    offerServiceCategories,
    mainSalonCategories,
    serviceCategoryIdsFromNames,
  };
}

/* ── Main handler ───────────────────────────────────────────────────────── */
export const GET = async (request) => {
  try {
    const db = await _db();
    if (!db) {
      return setCorsHeaders(
        Response.json({ success: false, message: "Service unavailable", vendors: [] }, { status: 503 })
      );
    }

    const { searchParams } = new URL(request.url);
    const serviceName  = searchParams.get("serviceName")?.trim()  || "";
    const offerCode    = searchParams.get("offerCode")?.trim()    || "";
    const urlRegionId  = searchParams.get("regionId")?.trim();
    const limit        = parseInt(searchParams.get("limit")  || "20", 10);
    const offset       = parseInt(searchParams.get("offset") || "0",  10);
    const latStr       = searchParams.get("lat");
    const lngStr       = searchParams.get("lng");
    const lat          = latStr ? parseFloat(latStr) : NaN;
    const lng          = lngStr ? parseFloat(lngStr) : NaN;
    const city         = searchParams.get("city")?.trim() || searchParams.get("locationLabel")?.trim() || "";

    /* ── Fan-out: region + offer resolved in parallel ──────────────────────
       Previously these were two sequential awaits. Running them concurrently
       saves the full RTT of whichever finishes second (~50–200 ms).         */
    let regionId = urlRegionId && mongoose.Types.ObjectId.isValid(urlRegionId)
      ? new mongoose.Types.ObjectId(urlRegionId)
      : null;

    const [resolvedRegionId, offerResult] = await Promise.all([
      regionId ? Promise.resolve(null) : resolveRegion(city, lat, lng),
      resolveOffer(offerCode),
    ]);

    if (!regionId && resolvedRegionId) regionId = resolvedRegionId;

    let useCityFallback = false;
    let cityLegacy      = null;
    if (!regionId && !resolvedRegionId && city && city !== "Current Location") {
      useCityFallback = true;
      cityLegacy      = city.split(",")[0].trim();
    }

    const {
      offerVendorIds          = null,
      offerRegionId           = null,
      offerSpecialties        = [],
      offerServices           = [],
      offerServiceCategories  = [],
      mainSalonCategories     = [],
      serviceCategoryIdsFromNames = [],
    } = offerResult || {};

    /* ── Parse categoryIds & lookup by serviceName ─────────────────────── */
    const categoryIdsStr = searchParams.get("categoryIds");
    const categoryIds = categoryIdsStr
      ? categoryIdsStr
          .split(",")
          .map((id) => id.trim())
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id))
      : [];

    let matchedCategoryIds = [];
    if (serviceName) {
      try {
        const safeRegex = new RegExp(serviceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        const matchedCats = await CategoryModel.find({ name: safeRegex })
          .select("_id")
          .lean();
        matchedCategoryIds = matchedCats.map((c) => c._id);
      } catch (err) {
        console.error("Error looking up categories for serviceName:", err);
      }
    }

    const allCategoryIds = [
      ...categoryIds,
      ...matchedCategoryIds.filter(
        (id) => !categoryIds.some((cid) => cid.toString() === id.toString())
      ),
    ];

    /* ── Aggregation Pipeline ──────────────────────────────────────────── */
    const pipeline = [];

    pipeline.push({
      $lookup: {
        from: "vendors",
        localField: "vendor",
        foreignField: "_id",
        as: "vendorData",
      },
    });
    pipeline.push({ $unwind: "$vendorData" });

    const vendorMatch = { "vendorData.status": "Approved" };

    if (offerVendorIds?.length > 0) {
      vendorMatch["vendorData._id"] = {
        $in: offerVendorIds.map((id) => new mongoose.Types.ObjectId(id.toString())),
      };
    } else if (offerRegionId || regionId) {
      const targetRegionId = new mongoose.Types.ObjectId((offerRegionId || regionId).toString());
      const region     = await RegionModel.findById(targetRegionId).lean();
      const regionName = region?.name || "";
      vendorMatch.$or = [
        { "vendorData.regionId": targetRegionId },
        { "vendorData.city": { $regex: new RegExp(regionName, "i") } },
      ];
    } else if (useCityFallback && cityLegacy) {
      vendorMatch.$or = [
        { "vendorData.city":    { $regex: new RegExp(cityLegacy, "i") } },
        { "vendorData.address": { $regex: new RegExp(cityLegacy, "i") } },
      ];
    }

    pipeline.push({ $match: vendorMatch });
    pipeline.push({ $unwind: "$services" });

    const serviceSearchConditions = [];
    if (allCategoryIds.length > 0) {
      serviceSearchConditions.push({ "services.category": { $in: allCategoryIds } });
    }
    if (serviceName) {
      const safeRegex = new RegExp(serviceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      serviceSearchConditions.push({ "services.name": safeRegex });
      serviceSearchConditions.push({ "vendorData.businessName": safeRegex });
    }

    const matchAndConditions = [{ "services.status": "approved" }];

    if (serviceSearchConditions.length > 0) {
      matchAndConditions.push({ $or: serviceSearchConditions });
    }

    const offerOrConditions = [
      ...(offerServices.length > 0
        ? [{ "services._id": { $in: offerServices.map((id) => new mongoose.Types.ObjectId(id.toString())) } }]
        : []),
      ...(offerServiceCategories.length > 0
        ? [{ "services.category": { $in: offerServiceCategories.map((id) => new mongoose.Types.ObjectId(id.toString())) } }]
        : []),
      ...(serviceCategoryIdsFromNames.length > 0
        ? [{ "services.category": { $in: serviceCategoryIdsFromNames } }]
        : []),
      ...(offerSpecialties.length > 0
        ? [{ "services.name": { $in: offerSpecialties.map((s) => new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")) } }]
        : []),
    ];

    if (offerOrConditions.length > 0) {
      matchAndConditions.push({ $or: offerOrConditions });
    }

    if (mainSalonCategories.length > 0) {
      matchAndConditions.push({ "vendorData.category": { $in: mainSalonCategories } });
    }

    pipeline.push({
      $match: matchAndConditions.length === 1 ? matchAndConditions[0] : { $and: matchAndConditions },
    });

    pipeline.push({
      $lookup: {
        from: "categories",
        localField: "services.category",
        foreignField: "_id",
        as: "services.category",
      },
    });
    pipeline.push({ $unwind: { path: "$services.category", preserveNullAndEmptyArrays: true } });
    pipeline.push({
      $lookup: {
        from: "weddingpackages",
        localField: "vendor",
        foreignField: "vendorId",
        as: "weddingPackageList",
      },
    });

    pipeline.push({
      $group: {
        _id: "$vendorData._id",
        businessName:  { $first: "$vendorData.businessName" },
        firstName:     { $first: "$vendorData.firstName" },
        lastName:      { $first: "$vendorData.lastName" },
        phone:         { $first: "$vendorData.phone" },
        city:          { $first: "$vendorData.city" },
        state:         { $first: "$vendorData.state" },
        category:      { $first: "$vendorData.category" },
        subCategories: { $first: "$vendorData.subCategories" },
        profileImage:  { $first: "$vendorData.profileImage" },
        description:   { $first: "$vendorData.description" },
        location:      { $first: "$vendorData.location" },
        regionId:      { $first: "$vendorData.regionId" },
        createdAt:     { $first: "$vendorData.createdAt" },
        subscription:  { $first: "$vendorData.subscription" },
        vendorType:    { $first: "$vendorData.vendorType" },
        services:      { $push: "$services" },
        isHomeService: {
          $max: {
            $or: [
              { $in: ["$vendorData.vendorType", ["hybrid", "home-only", "vendor-home-travel"]] },
              { $in: ["at-home", { $ifNull: ["$vendorData.subCategories", []] }] },
              { $eq: ["$services.homeService.available", true] },
              { $eq: ["$services.serviceHomeService.available", true] },
            ],
          },
        },
        isWeddingService: {
          $max: {
            $or: [
              { $eq: ["$services.weddingService.available", true] },
              { $eq: ["$services.serviceWeddingService.available", true] },
              {
                $gt: [
                  {
                    $size: {
                      $filter: {
                        input: { $ifNull: ["$weddingPackageList", []] },
                        as: "pkg",
                        cond: {
                          $and: [
                            { $eq: ["$$pkg.isActive", true] },
                            { $ne: ["$$pkg.status", "pending"] },
                            { $ne: ["$$pkg.status", "rejected"] }
                          ]
                        },
                      },
                    },
                  },
                  0,
                ],
              },
            ],
          },
        },
      },
    });

    pipeline.push({ $match: { services: { $ne: [] } } });

    const now = new Date();
    pipeline.push({
      $lookup: {
        from: "crmoffers",
        let: { vendorId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$businessId", "$$vendorId"] },
                  { $lte: ["$startDate", now] },
                  { $or: [{ $eq: ["$expires", null] }, { $gte: ["$expires", now] }] },
                ],
              },
            },
          },
        ],
        as: "offers",
      },
    });

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: offset });
    pipeline.push({ $limit: limit });

    const vendors = await VendorServicesModel.aggregate(pipeline).exec();

    /* ── Batch enrichment: 3 queries total instead of 3×N ──────────────────
       Previously: for each of N vendors → ReviewModel.aggregate (1 query)
                                         → ClientModel.distinct   (1 query)
                                         → AppointmentModel.distinct (1 query)
                 = 3N DB calls (up to 60 for limit=20)

       Now: 3 queries total, results joined in JS.
       Business logic is identical — same averages, same unique-phone dedup.  */
    if (vendors.length === 0) {
      return setCorsHeaders(Response.json({ success: true, vendors: [], count: 0 }));
    }

    const vendorIds = vendors.map((v) => v._id);

    const [allRatings, clientPhonesByVendor, apptPhonesByVendor] = await Promise.all([
      /* All review stats in one aggregation */
      ReviewModel.aggregate([
        {
          $match: {
            entityId:   { $in: vendorIds },
            entityType: "salon",
            isApproved: true,
          },
        },
        {
          $group: {
            _id:           "$entityId",
            averageRating: { $avg: "$rating" },
            reviewCount:   { $sum: 1 },
          },
        },
      ]),

      /* All client phones grouped by vendor in one aggregation.
         Using $addToSet inside Mongo is faster than doing Set merges in JS
         across N separate distinct() calls.                                  */
      ClientModel.aggregate([
        {
          $match: {
            vendorId: { $in: vendorIds },
            phone:    { $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id:    "$vendorId",
            phones: { $addToSet: "$phone" },
          },
        },
      ]),

      /* All appointment phones grouped by vendor in one aggregation */
      AppointmentModel.aggregate([
        {
          $match: {
            vendorId:    { $in: vendorIds },
            clientPhone: { $nin: [null, ""] },
          },
        },
        {
          $group: {
            _id:    "$vendorId",
            phones: { $addToSet: "$clientPhone" },
          },
        },
      ]),
    ]);

    /* Build O(1) lookup maps so the per-vendor join below is pure JS */
    const ratingsMap     = new Map(allRatings.map((r) => [r._id.toString(), r]));
    const clientPhoneMap = new Map(clientPhonesByVendor.map((c) => [c._id.toString(), c.phones]));
    const apptPhoneMap   = new Map(apptPhonesByVendor.map((a) => [a._id.toString(), a.phones]));

    const vendorsWithStats = vendors.map((vendor) => {
      const id     = vendor._id.toString();
      const rating = ratingsMap.get(id);

      /* Merge client + appointment phone sets — same dedup logic as before */
      const clientPhones = clientPhoneMap.get(id) ?? [];
      const apptPhones   = apptPhoneMap.get(id)   ?? [];
      const uniquePhones = new Set([...clientPhones, ...apptPhones]);
      const dynamicClientCount = uniquePhones.size;

      return {
        ...vendor,
        rating:             rating ? rating.averageRating.toFixed(1) : "0.0",
        reviewCount:        rating?.reviewCount ?? 0,
        clientCount:        dynamicClientCount,
        dynamicClientCount: dynamicClientCount,
      };
    });

    return setCorsHeaders(
      Response.json({ success: true, vendors: vendorsWithStats, count: vendorsWithStats.length })
    );
  } catch (error) {
    console.error("Vendor search error:", error);
    return setCorsHeaders(
      Response.json({ success: false, message: "Internal server error", vendors: [] }, { status: 500 })
    );
  }
};