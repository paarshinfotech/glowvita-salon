import _db from "@repo/lib/db";
import ProductModel from "@repo/lib/models/Vendor/Product.model";
import VendorModel from "@repo/lib/models/Vendor.model";
import SupplierModel from "@repo/lib/models/Vendor/Supplier.model";
import ProductCategoryModel from "@repo/lib/models/admin/ProductCategory.model";
import ReviewModel from "@repo/lib/models/Review/Review.model";

await _db();
// ... (OPTIONS remains same)

// Get Single Product by ID
export const GET = async (request, { params }) => {
  try {
    const { id } = params;

    if (!id) {
      return Response.json({
        success: false,
        message: "Product ID is required"
      }, { status: 400 });
    }

    // Get product by ID and populate category
    const product = await ProductModel.findById(id).populate('category', 'name');

    if (!product) {
      return Response.json({
        success: false,
        message: "Product not found"
      }, { status: 404 });
    }

    // Check if product is approved and allowed on website
    if (product.status !== 'approved' || product.showOnWebsite === false) {
      return Response.json({
        success: false,
        message: "Product not available"
      }, { status: 404 });
    }

    // Populate vendor/supplier based on origin
    let vendorData = null;
    if (product.origin === 'Supplier') {
      // For supplier products, populate with Supplier model
      vendorData = await SupplierModel.findById(product.vendorId).select('shopName firstName lastName status city state');
    } else {
      // For vendor products, populate with Vendor model
      vendorData = await VendorModel.findById(product.vendorId).select('businessName firstName lastName status city state');
    }

    // Check if vendor/supplier exists and is approved
    if (!vendorData || vendorData.status !== 'Approved') {
      return Response.json({
        success: false,
        message: "Product not available"
      }, { status: 404 });
    }

    // Fetch real rating stats
    const stats = await ReviewModel.aggregate([
      { $match: { entityId: product._id, entityType: 'product', isApproved: true } },
      {
        $group: {
          _id: '$entityId',
          averageRating: { $avg: '$rating' },
          reviewCount: { $sum: 1 }
        }
      }
    ]);

    const reviewStats = stats.length > 0 ? {
      averageRating: stats[0].averageRating.toFixed(1),
      reviewCount: stats[0].reviewCount
    } : {
      averageRating: "0.0",
      reviewCount: 0
    };

    // Transform the data for the frontend
    const transformedProduct = {
      id: product._id,
      name: product.productName,
      description: product.description || '',
      price: product.price,
      salePrice: product.salePrice > 0 ? product.salePrice : null,
      images: product.productImages && product.productImages.length > 0
        ? product.productImages
        : ['/images/product-placeholder.png'],
      vendorId: vendorData._id,
      vendorName: product.origin === 'Supplier' ? vendorData.shopName : vendorData.businessName || 'Unknown Vendor',
      vendorLocation: `${vendorData.city || ''}, ${vendorData.state || ''}`.trim(),
      origin: product.origin || 'Vendor',
      category: product.category?.name || 'Beauty Products',
      categoryId: product.category?._id || product.category || null,
      stock: product.stock,
      isActive: product.isActive,
      rating: reviewStats.averageRating,
      reviewCount: reviewStats.reviewCount,
      // New fields from product schema
      size: product.size || null,
      sizeMetric: product.sizeMetric || null,
      keyIngredients: product.keyIngredients || [],
      forBodyPart: product.forBodyPart || null,
      bodyPartType: product.bodyPartType || null,
      productForm: product.productForm || null,
      brand: product.brand || null,
    };

    return new Response(JSON.stringify({
      success: true,
      product: transformedProduct
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      },
    });
  } catch (error) {
    console.error('Product Detail API Error:', error);

    return Response.json({
      success: false,
      message: "Failed to fetch product details",
      error: error.message
    }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
};
