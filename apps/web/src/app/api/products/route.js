import _db from "@repo/lib/db";
export const dynamic = 'force-dynamic';
import ProductModel from "@repo/lib/models/Vendor/Product.model";
import VendorModel from "@repo/lib/models/Vendor.model";
import SupplierModel from "@repo/lib/models/Vendor/Supplier.model";
import ProductCategoryModel from "@repo/lib/models/admin/ProductCategory.model";
import ReviewModel from "@repo/lib/models/Review/Review.model";

await _db();
// ... (OPTIONS remains the same)

// Get Public Products (only products approved via admin panel)
export const GET = async (request) => {
  try {
    // ... (vendorId extraction remains the same)
    const url = new URL(request.url);
    const vendorId = url.searchParams.get('vendorId');
    const categoryId = url.searchParams.get('categoryId');

    // ── Coordinate-based location filtering (primary) ──────────────────────
    const latStr = url.searchParams.get("lat");
    const lngStr = url.searchParams.get("lng");
    const lat = latStr ? parseFloat(latStr) : NaN;
    const lng = lngStr ? parseFloat(lngStr) : NaN;

    // ── Legacy city-name fallback ──────────────────────────────────────────
    const city = url.searchParams.get("city")?.trim();

    /* ── Determine region filter ─────────────────────────────────────────── */
    let regionId = null;
    let useCityFallback = false;
    let cityLegacy = null;

    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      try {
        const RegionModel = (await import("@repo/lib/models/admin/Region.model")).default;
        const region = await RegionModel.findOne({
          geometry: {
            $geoIntersects: {
              $geometry: {
                type: "Point",
                coordinates: [lng, lat], // GeoJSON: [lng, lat]
              },
            },
          },
          isActive: true,
        });

        if (region) {
          regionId = region._id;
          console.log(`[ProductsAPI] Region matched: ${region.name} for [${lat}, ${lng}]`);
        } else if (city && city !== "Current Location" && city !== "") {
          // Fallback to city-based matching if coordinates are outside any region
          useCityFallback = true;
          cityLegacy = city;
          console.log(`[ProductsAPI] No region for [${lat}, ${lng}] – Falling back to city: ${city}`);
        } else {
          // Coordinates given but outside any defined service area and no city provided
          console.log(`[ProductsAPI] No region for [${lat}, ${lng}] and no city fallback – returning noServiceArea`);
          return new Response(JSON.stringify({
            success: true,
            products: [],
            count: 0,
            noServiceArea: true,
            message: "We're not available in this area yet"
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (err) {
        console.error("[ProductsAPI] Region lookup error:", err);
      }
    } else if (city && city !== "Current Location" && city !== "") {
      useCityFallback = true;
      cityLegacy = city;
    }

    // Build query with optional filters
    const query = {
      status: 'approved',
      isActive: true,
      stock: { $gt: 0 },
      showOnWebsite: { $ne: false }
    };

    if (vendorId) {
      query.vendorId = vendorId;
    }

    if (categoryId) {
      query.category = categoryId;
    }

    // Get products that are approved via admin panel
    const approvedProducts = await ProductModel.find(query)
      .select('productName description price salePrice productImages vendorId stock createdAt origin size sizeMetric keyIngredients forBodyPart bodyPartType productForm brand category')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    // Separate products by origin (Vendor vs Supplier)
    const vendorProducts = approvedProducts.filter(p => p.origin === 'Vendor');
    const supplierProducts = approvedProducts.filter(p => p.origin === 'Supplier');

    // Get vendor IDs and supplier IDs
    const vendorIds = [...new Set(vendorProducts.map(p => p.vendorId))];
    const supplierIds = [...new Set(supplierProducts.map(p => p.vendorId))];

    // Fetch vendors and suppliers in parallel
    const vendorQuery = {
      _id: { $in: vendorIds },
      status: 'Approved'
    };

    const supplierQuery = {
      _id: { $in: supplierIds },
      status: 'Approved'
    };

    // Apply location filters to vendor/supplier lookups
    if (regionId) {
      vendorQuery.regionId = regionId;
      supplierQuery.regionId = regionId;
    } else if (useCityFallback && cityLegacy) {
      vendorQuery.city = { $regex: new RegExp(`^${cityLegacy}$`, "i") };
      supplierQuery.city = { $regex: new RegExp(`^${cityLegacy}$`, "i") };
    }

    const [vendors, suppliers] = await Promise.all([
      vendorIds.length > 0
        ? VendorModel.find(vendorQuery).select('_id businessName firstName lastName status city state')
        : Promise.resolve([]),
      supplierIds.length > 0
        ? SupplierModel.find(supplierQuery).select('_id shopName firstName lastName status city state')
        : Promise.resolve([])
    ]);

    // Create maps for quick lookup
    const vendorMap = new Map(vendors.map(v => [v._id.toString(), v]));
    const supplierMap = new Map(suppliers.map(s => [s._id.toString(), s]));

    // Filter and transform products -- deduplicate by _id to guard against duplicate DB entries
    const seenProductIds = new Set();
    const validProducts = approvedProducts.filter(product => {
      const pid = product._id.toString();
      if (seenProductIds.has(pid)) return false;
      seenProductIds.add(pid);
      if (product.origin === 'Vendor') {
        return vendorMap.has(product.vendorId.toString());
      } else {
        return supplierMap.has(product.vendorId.toString());
      }
    });

    if (validProducts.length === 0) {
      return Response.json({
        success: true,
        products: [],
        count: 0,
        message: "No approved products from approved vendors found"
      });
    }

    // Transform the data for the frontend
    const transformedProducts = validProducts.map(product => {
      let vendorData = null;
      if (product.origin === 'Vendor') {
        vendorData = vendorMap.get(product.vendorId.toString());
      } else {
        vendorData = supplierMap.get(product.vendorId.toString());
      }

      return {
        id: product._id,
        name: product.productName,
        description: product.description || '',
        price: product.price,
        salePrice: product.salePrice > 0 ? product.salePrice : null,
        image: product.productImages && product.productImages.length > 0
          ? product.productImages[0]
          : '/images/product-placeholder.png',
        vendorId: vendorData?._id || product.vendorId,
        vendorName: product.origin === 'Vendor'
          ? (vendorData?.businessName || 'Unknown Vendor')
          : (vendorData?.shopName || 'Unknown Supplier'),
        origin: product.origin || 'Vendor',
        category: product.category?.name || 'Beauty Products',
        stock: product.stock,
        isNew: new Date(product.createdAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        rating: 0,
        reviewCount: 0,
        hint: product.description || product.productName,
        // Additional fields from product schema
        size: product.size || null,
        sizeMetric: product.sizeMetric || null,
        keyIngredients: product.keyIngredients || [],
        forBodyPart: product.forBodyPart || null,
        bodyPartType: product.bodyPartType || null,
        productForm: product.productForm || null,
        brand: product.brand || null,
        categoryId: product.category?._id || product.category || null
      };
    });

    // Fetch real ratings and review counts in parallel
    const productStats = await Promise.all(transformedProducts.map(async (p) => {
      const stats = await ReviewModel.aggregate([
        { $match: { entityId: p.id, entityType: 'product', isApproved: true } },
        {
          $group: {
            _id: '$entityId',
            averageRating: { $avg: '$rating' },
            reviewCount: { $sum: 1 }
          }
        }
      ]);
      return {
        id: p.id,
        rating: stats.length > 0 ? stats[0].averageRating.toFixed(1) : "0.0",
        reviewCount: stats.length > 0 ? stats[0].reviewCount : 0
      };
    }));

    // Update transformed products with real stats
    const statsMap = new Map(productStats.map(s => [s.id.toString(), s]));
    transformedProducts.forEach(p => {
      const stats = statsMap.get(p.id.toString());
      if (stats) {
        p.rating = stats.rating;
        p.reviewCount = stats.reviewCount;
      }
    });

    return new Response(JSON.stringify({
      success: true,
      products: transformedProducts,
      count: transformedProducts.length
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      },
    });
  } catch (error) {
    console.error('Products API Error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    return new Response(JSON.stringify({
      success: false,
      message: `Failed to fetch products: ${error.message}`,
      products: [],
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      },
    });
  }
};