import { NextResponse } from "next/server";
import _db from "@repo/lib/db";
import TaxFeeSettings from "@repo/lib/models/admin/TaxFeeSettings";

// Force dynamic rendering — never cache this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    serviceTax: settings.serviceTax != null ? settings.serviceTax : 18,
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

// GET tax fee settings (public endpoint - no authentication required)
export async function GET() {
  try {
    // During build phase, return default settings
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return NextResponse.json(transformSettings(null), { status: 200 });
    }

    const settings = await TaxFeeSettings.findOne().sort({ updatedAt: -1 });
    const response = NextResponse.json(transformSettings(settings), { status: 200 });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  } catch (error) {
    console.error("Error fetching tax fee settings:", error);
    return NextResponse.json(
      { message: "Error fetching tax fee settings", error: error.message },
      { status: 500 }
    );
  }
}
