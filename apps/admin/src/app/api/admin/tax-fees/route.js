import { NextResponse } from "next/server";
import _db from "@repo/lib/db";
import TaxFeeSettings from "@repo/lib/models/admin/TaxFeeSettings";
import { authMiddlewareAdmin } from "../../../../middlewareAdmin.js";
import mongoose from 'mongoose';

// Initialize database connection
await _db();

// Helper function to transform settings to frontend format
const transformSettings = (settings) => {
  if (!settings) {
    return {
      platformFee: 15,
      serviceTax: 18,
      productPlatformFee: 10,
      productGST: 18,
      platformFeeType: "percentage",
      serviceTaxType: "percentage",
      productPlatformFeeType: "percentage",
      productGSTType: "percentage",
      platformFeeEnabled: true,
      serviceTaxEnabled: true,
      productPlatformFeeEnabled: true,
      productGSTEnabled: true,
    };
  }

  return {
    platformFee: settings.platformFee != null ? settings.platformFee : 15,
    platformFeeType: settings.platformFeeType || 'percentage',
    platformFeeEnabled: settings.platformFeeEnabled !== false,
    serviceTax: settings.serviceTax != null ? settings.serviceTax : 18, // This is GST
    serviceTaxType: settings.serviceTaxType || 'percentage',
    serviceTaxEnabled: settings.serviceTaxEnabled !== false,
    productPlatformFee: settings.productPlatformFee != null ? settings.productPlatformFee : 10,
    productPlatformFeeType: settings.productPlatformFeeType || 'percentage',
    productPlatformFeeEnabled: settings.productPlatformFeeEnabled !== false,
    productGST: settings.productGST != null ? settings.productGST : 18,
    productGSTType: settings.productGSTType || 'percentage',
    productGSTEnabled: settings.productGSTEnabled !== false,
    _id: settings._id
  };
};

// GET all tax fee settings
export const GET = authMiddlewareAdmin(async (req) => {
  try {
    const settings = await TaxFeeSettings.findOne().sort({ updatedAt: -1 });
    return NextResponse.json(transformSettings(settings), { status: 200 });
  } catch (error) {
    console.error("Error fetching tax fee settings:", error);
    return NextResponse.json(
      { message: "Error fetching tax fee settings", error: error.message },
      { status: 500 }
    );
  }
}, ["SUPER_ADMIN", "REGIONAL_ADMIN", "STAFF"], "tax-fees:view");

// PATCH update tax fee settings
export const PATCH = authMiddlewareAdmin(async (req) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const updates = await req.json();
    
    // Find the most recent settings
    const currentSettings = await TaxFeeSettings.findOne().sort({ updatedAt: -1 });
    
    let updatedSettings;
    
    if (currentSettings) {
      // Update existing settings
      updatedSettings = await TaxFeeSettings.findByIdAndUpdate(
        currentSettings._id,
        updates,
        { new: true, session }
      );
    } else {
      // Create new settings if none exist
      updatedSettings = new TaxFeeSettings(updates);
      await updatedSettings.save({ session });
    }
    
    await session.commitTransaction();
    return NextResponse.json(transformSettings(updatedSettings), { status: 200 });
    
  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating tax fee settings:", error);
    return NextResponse.json(
      { message: error.message || "Error updating tax fee settings" },
      { status: 400 }
    );
  } finally {
    session.endSession();
  }
}, ["SUPER_ADMIN", "REGIONAL_ADMIN", "STAFF"], "tax-fees:edit");

// POST create new tax fee settings
export const POST = authMiddlewareAdmin(async (req) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const settingsData = await req.json();
    const newSettings = new TaxFeeSettings(settingsData);
    await newSettings.save({ session });
    
    await session.commitTransaction();
    return NextResponse.json(newSettings, { status: 201 });
    
  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating tax fee settings:", error);
    return NextResponse.json(
      { message: "Error creating tax fee settings", error: error.message },
      { status: 400 }
    );
  } finally {
    session.endSession();
  }
}, ["SUPER_ADMIN", "REGIONAL_ADMIN", "STAFF"], "tax-fees:edit");