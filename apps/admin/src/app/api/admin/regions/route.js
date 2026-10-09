import { NextResponse } from "next/server";
import _db from "@repo/lib/db";
import RegionModel from "@repo/lib/models/admin/Region";
import AdminUserModel from "@repo/lib/models/admin/AdminUser";
import { authMiddlewareAdmin } from "../../../../middlewareAdmin";
import { hasPermission, forbiddenResponse } from "@repo/lib";

// GET all regions
export const GET = authMiddlewareAdmin(async (req) => {
  try {
    await _db();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 20;
    const skip = (page - 1) * limit;

    const regions = await RegionModel.find({})
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await RegionModel.countDocuments({});

    return NextResponse.json({
      success: true,
      data: regions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET Regions Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}, ["SUPER_ADMIN", "REGIONAL_ADMIN", "STAFF"], "regions:view");

// POST create region
export const POST = authMiddlewareAdmin(async (req) => {
  try {
    await _db();
    const body = await req.json();
    const { name, code, description, geometry, cities, states } = body;

    if (!name || !code) {
      return NextResponse.json({ success: false, error: "Name and code are required" }, { status: 400 });
    }

    const newRegion = await RegionModel.create({
      name,
      code,
      description,
      geometry,
      cities,
      states
    });

    return NextResponse.json({ success: true, data: newRegion }, { status: 201 });
  } catch (error) {
    console.error("POST Region Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}, ["SUPER_ADMIN", "REGIONAL_ADMIN", "STAFF"], "regions:edit");

// PUT update region
export const PUT = authMiddlewareAdmin(async (req) => {
  try {
    await _db();
    const body = await req.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Region ID is required" }, { status: 400 });
    }

    const updatedRegion = await RegionModel.findByIdAndUpdate(id, updateData, { new: true }).lean();

    if (!updatedRegion) {
      return NextResponse.json({ success: false, error: "Region not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updatedRegion });
  } catch (error) {
    console.error("PUT Region Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}, ["SUPER_ADMIN", "REGIONAL_ADMIN", "STAFF"], "regions:edit");

// DELETE region
export const DELETE = authMiddlewareAdmin(async (req) => {
  try {
    await _db();
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await req.json();
        id = body?.id || body?._id;
      } catch (_) { }
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "Region ID is required" }, { status: 400 });
    }

    const deletedRegion = await RegionModel.findByIdAndDelete(id);

    if (!deletedRegion) {
      return NextResponse.json({ success: false, error: "Region not found" }, { status: 404 });
    }

    // Clean up any assigned region references in Admin users
    try {
      await AdminUserModel.updateMany(
        { assignedRegions: id },
        { $pull: { assignedRegions: id } }
      );
    } catch (cleanupErr) {
      console.warn("Failed to clean up assignedRegions in AdminUserModel:", cleanupErr);
    }

    return NextResponse.json({
      success: true,
      message: "Region deleted successfully",
      data: deletedRegion
    });
  } catch (error) {
    console.error("DELETE Region Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}, ["SUPER_ADMIN", "REGIONAL_ADMIN", "STAFF"], "regions:delete");

