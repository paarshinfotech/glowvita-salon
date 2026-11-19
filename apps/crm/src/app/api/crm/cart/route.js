
import { NextResponse } from 'next/server';
import _db from '@repo/lib/db';
import CartModel from '@repo/lib/models/Vendor/Cart.model';
import { withSubscriptionCheck } from '@/middlewareCrm';

await _db();

// GET: Fetch the vendor's cart
export const GET = withSubscriptionCheck(async (req) => {
  try {
    const vendorId = req.user.userId || req.user._id;
    let cart = await CartModel.findOne({ vendorId }).lean();

    if (!cart) {
      // If no cart exists, create an empty one
      cart = { vendorId, items: [] };
    } else {
    }

    return NextResponse.json({ success: true, data: cart });
  } catch (error) {
    console.error("Failed to fetch cart:", error);
    return NextResponse.json({ success: false, message: 'Failed to fetch cart', error: error.message }, { status: 500 });
  }
}, ['vendor']);

// POST: Add an item to the cart or update quantity if it exists (Optimized)
export const POST = withSubscriptionCheck(async (req) => {
  try {
    const vendorId = req.user.userId || req.user._id;
    const item = await req.json();


    if (!item.productId || !item.quantity || !item.price) {
      return NextResponse.json({ success: false, message: 'Product ID, quantity, and price are required' }, { status: 400 });
    }

    // Check product stock before adding
    const ProductModel = (await import('@repo/lib/models/Vendor/Product.model')).default;
    const product = await ProductModel.findById(item.productId).select('stock productName');
    if (product && (product.stock === undefined || product.stock <= 0)) {
      return NextResponse.json({ 
        success: false, 
        message: `${product.productName || 'This product'} is currently out of stock.` 
      }, { status: 400 });
    }

    // Use a single, efficient findOneAndUpdate operation
    const updatedCart = await CartModel.findOneAndUpdate(
      {
        vendorId,
        'items.productId': item.productId
      },
      {
        $inc: { 'items.$.quantity': item.quantity }
      },
      { new: true }
    );

    // If the item was not found in the cart, add it
    if (!updatedCart) {
      const cartWithNewItem = await CartModel.findOneAndUpdate(
        { vendorId },
        {
          $push: { items: item },
          $setOnInsert: { vendorId: vendorId }
        },
        { upsert: true, new: true }
      );
      return NextResponse.json({ success: true, data: cartWithNewItem });
    }

    return NextResponse.json({ success: true, data: updatedCart });

  } catch (error) {
    console.error("Failed to add item to cart:", error);
    return NextResponse.json({ success: false, message: 'Failed to add item to cart', error: error.message }, { status: 500 });
  }
}, ['vendor']);


// PUT: Update item quantity in the cart
export const PUT = withSubscriptionCheck(async (req) => {
  try {
    const vendorId = req.user.userId || req.user._id;
    const { productId, quantity } = await req.json();


    if (!productId || quantity === undefined) {
      return NextResponse.json({ success: false, message: 'Product ID and quantity are required' }, { status: 400 });
    }

    if (quantity <= 0) {
      // If quantity is 0 or less, remove the item
      const updatedCart = await CartModel.findOneAndUpdate(
        { vendorId },
        { $pull: { items: { productId } } },
        { new: true }
      );
      return NextResponse.json({ success: true, data: updatedCart || { vendorId, items: [] } });
    } else {
      // Otherwise, update the quantity
      const updatedCart = await CartModel.findOneAndUpdate(
        { vendorId, 'items.productId': productId },
        { $set: { 'items.$.quantity': quantity } },
        { new: true }
      );
      return NextResponse.json({ success: true, data: updatedCart });
    }
  } catch (error) {
    console.error("Failed to update cart item:", error);
    return NextResponse.json({ success: false, message: 'Failed to update cart item', error: error.message }, { status: 500 });
  }
}, ['vendor']);


// DELETE: Remove an item from the cart
export const DELETE = withSubscriptionCheck(async (req) => {
  try {
    const vendorId = req.user.userId || req.user._id;
    const { productId } = await req.json();


    if (!productId) {
      return NextResponse.json({ success: false, message: 'Product ID is required' }, { status: 400 });
    }

    const updatedCart = await CartModel.findOneAndUpdate(
      { vendorId },
      { $pull: { items: { productId } } },
      { new: true }
    );


    return NextResponse.json({ success: true, data: updatedCart || { vendorId, items: [] } });
  } catch (error) {
    console.error("Failed to remove item from cart:", error);
    return NextResponse.json({ success: false, message: 'Failed to remove item from cart', error: error.message }, { status: 500 });
  }
}, ['vendor']);
