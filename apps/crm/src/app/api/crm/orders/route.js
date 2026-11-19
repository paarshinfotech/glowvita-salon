import { NextResponse } from 'next/server';
import _db from '@repo/lib/db';
import OrderModel from '@repo/lib/models/Vendor/Order.model';
import mongoose from 'mongoose';
if (mongoose.models.Order) {
  delete mongoose.models.Order;
}
import ProductModel from '@repo/lib/models/Vendor/Product.model';
import InventoryTransactionModel from '@repo/lib/models/Vendor/InventoryTransaction.model';
import VendorModel from '@repo/lib/models/Vendor/Vendor.model';
import SupplierModel from '@repo/lib/models/Vendor/Supplier.model';
import { authMiddlewareCrm } from '@/middlewareCrm';
import { NotificationService } from '@repo/lib';

await _db();

// GET Orders for the logged-in user (Vendor or Supplier)
export const GET = authMiddlewareCrm(async (req) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    let query = {};
    if (role === 'vendor' || role === 'staff') {
      // Vendors see orders they placed (to suppliers) and orders they received (from customers)
      query = {
        $or: [
          { vendorId: userId }, // B2B orders placed by this vendor
          { vendorId: userId, customerId: { $exists: true } } // B2C orders for this vendor
        ]
      };
    } else if (role === 'supplier') {
      // Suppliers see orders they received from vendors
      query = { supplierId: userId };
    }

    // Populate supplierId from Supplier model and vendorId from Vendor model
    const orders = await OrderModel.find(query)
      .populate({ path: 'supplierId', model: SupplierModel, select: 'firstName lastName shopName email mobile' })
      .populate({ path: 'vendorId', model: VendorModel, select: 'firstName lastName businessName email phone' })
      .sort({ createdAt: -1 });

    return NextResponse.json(orders, { status: 200 });
  } catch (error) {
    console.error("Error fetching orders:", error);
    return NextResponse.json({ message: "Failed to fetch orders" }, { status: 500 });
  }
}, ['vendor', 'supplier', 'staff']);


// POST - Create a new Order (Vendor purchasing from Supplier)
export const POST = authMiddlewareCrm(async (req) => {
  try {
    const vendorId = req.user.userId;
    let { 
      items, 
      supplierId, 
      totalAmount, 
      shippingAddress,
      paymentMethod,
      paymentStatus,
      paymentId,
      paymentOrderId,
    } = await req.json();

    if (!items || items.length === 0 || !supplierId || !totalAmount || !shippingAddress) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    // Normalize supplierId - it might be an object if populated on the frontend
    const actualSupplierId = typeof supplierId === 'object' && supplierId._id ? supplierId._id : supplierId;

    // Validate minimum order value for supplier
    const SupplierModel = (await import("@repo/lib/models/Vendor/Supplier.model")).default;
    const supplier = await SupplierModel.findById(actualSupplierId);

    if (supplier && supplier.minOrderValue > 0 && totalAmount < supplier.minOrderValue) {
      return NextResponse.json({
        message: `Order total must be at least ₹${supplier.minOrderValue} for this supplier.`
      }, { status: 400 });
    }

    // Normalize items productId - they might be objects if populated
    const normalizedItems = items.map(item => ({
      ...item,
      productId: typeof item.productId === 'object' && item.productId._id ? item.productId._id : item.productId
    }));

    const orderId = `B2B-${Date.now()}`; // Generate a unique order ID

    // Check stock for all items before proceeding
    for (const item of normalizedItems) {
      if (item.productId) {
        const product = await ProductModel.findById(item.productId);
        if (!product) {
          return NextResponse.json({ message: `Product not found: ${item.productName}` }, { status: 404 });
        }
        if (product.stock < item.quantity) {
          return NextResponse.json({
            message: `Insufficient stock for ${item.productName}. Available: ${product.stock}, requested: ${item.quantity}`
          }, { status: 400 });
        }
      }
    }

    const newOrder = new OrderModel({
      orderId,
      vendorId,
      supplierId: actualSupplierId, // Use the string ID
      items: normalizedItems, // Use normalized items
      totalAmount,
      shippingAddress,
      regionId: supplier?.regionId, // Inherit regionId from supplier
      status: 'Pending',
      paymentMethod: paymentMethod || 'online',
      paymentStatus: paymentStatus || (paymentMethod === 'cod' ? 'pending' : (paymentId ? 'completed' : 'pending')),
      paymentId: paymentId || null,
      paymentOrderId: paymentOrderId || null,
      razorpayOrderId: paymentOrderId || null,
      statusHistory: [{ status: 'Pending', notes: 'Order placed by vendor.' }]
    });

    await newOrder.save();

    // Trigger Notification for Marketplace Order
    (async () => {
      try {
        // Notify Supplier
        await NotificationService.sendMarketplaceOrderAlert(supplierId, 'supplier', newOrder, 'placed');

        // Notify Admin of new B2B activity
        await NotificationService.sendAdminAlert('New Marketplace Order', `New order ${orderId} placed from a vendor to a supplier.`);
      } catch (err) {
        console.error('Order Notification Error:', err);
      }
    })();
    // Decrement stock and create inventory transactions for each item
    for (const item of normalizedItems) {
      if (item.productId) {
        const product = await ProductModel.findById(item.productId);
        if (product) {
          const previousStock = product.stock;
          const newStock = previousStock - item.quantity;

          // Update product stock
          await ProductModel.findByIdAndUpdate(item.productId, {
            $set: { stock: Math.max(0, newStock) }
          });

          // Create inventory transaction record for the supplier
          const transaction = new InventoryTransactionModel({
            productId: item.productId,
            vendorId: actualSupplierId,
            productCategory: product.category,
            type: 'OUT',
            quantity: item.quantity,
            previousStock,
            newStock: Math.max(0, newStock),
            reason: `B2B Order ${orderId} placed by vendor ${vendorId}`,
            reference: orderId,
            performedBy: vendorId
          });
          await transaction.save();
        }
      }
    }

    return NextResponse.json(newOrder, { status: 201 });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json({ message: "Failed to create order", error: error.message }, { status: 500 });
  }
}, ['vendor', 'staff']);


// PATCH - Update order status and tracking
export const PATCH = authMiddlewareCrm(async (req) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;
    const { orderId, status, trackingNumber, courier, cancellationReason } = await req.json();

    if (!orderId || !status) {
      return NextResponse.json({ message: "Order ID and status are required" }, { status: 400 });
    }

    // Try to find order by _id first (MongoDB ID)
    // Only use findById if orderId is a valid MongoDB ObjectId
    let order = null;

    // Check if orderId is a valid MongoDB ObjectId format
    if (mongoose.Types.ObjectId.isValid(orderId)) {
      order = await OrderModel.findById(orderId);
      if (order) {
      }
    } else {
    }

    // If not found, try to find by the human-readable orderId field
    if (!order) {
      order = await OrderModel.findOne({ orderId: orderId });
      if (order) {
      }
    }

    // Log the order details if found
    if (order) {

    }

    if (!order) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    // Security check: Only the seller (supplier or vendor) can update the order status
    let isAuthorized = false;

    // Helper function to safely compare IDs
    const compareIds = (id1, id2) => {
      if (!id1 || !id2) return false;
      // Convert both to strings for comparison
      return id1.toString() === id2.toString();
    };

    if (role === 'supplier') {
      // Suppliers can update orders where they are the supplier
      isAuthorized = compareIds(order.supplierId, userId);
    } else if (role === 'vendor') {
      // Vendors can update:
      // 1. Orders they placed (where they are the vendorId)
      // 2. Orders they received (where they are the customerId) - for customer orders
      const isB2BOrderTheyPlaced = compareIds(order.vendorId, userId);
      const isB2COrderForCustomer = compareIds(order.customerId, userId);

      isAuthorized = isB2BOrderTheyPlaced || isB2COrderForCustomer;
    }

    if (!isAuthorized) {
      return NextResponse.json({ message: "You are not authorized to update this order" }, { status: 403 });
    }

    // If status is being changed to Cancelled, restore stock
    if (status === 'Cancelled' && order.status !== 'Cancelled') {
      for (const item of order.items) {
        if (item.productId) {
          const product = await ProductModel.findById(item.productId);
          if (product) {
            const previousStock = product.stock;
            const newStock = previousStock + item.quantity;

            // Update product stock
            await ProductModel.findByIdAndUpdate(item.productId, {
              $set: { stock: newStock }
            });

            // Create inventory transaction record for restoration
            const transaction = new InventoryTransactionModel({
              productId: item.productId,
              vendorId: order.supplierId,
              productCategory: product.category,
              type: 'IN',
              quantity: item.quantity,
              previousStock,
              newStock,
              reason: `B2B Order ${order.orderId} cancelled. Reason: ${cancellationReason || 'N/A'}. Stock restored.`,
              reference: order.orderId,
              performedBy: userId
            });
            await transaction.save();
          }
        }
      }
    }

    order.status = status;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (courier) order.courier = courier;
    if (status === 'Cancelled') {
      if (cancellationReason) order.cancellationReason = cancellationReason;
      order.cancelledAt = new Date();
      order.cancelledBy = role === 'vendor' ? 'Vendor' : 'Supplier';
    }

    order.statusHistory.push({
      status: status,
      notes: `Order status updated to ${status}.`
    });

    await order.save();

    // Trigger Notification for Status Update (Non-blocking)
    (async () => {
      try {
        // If B2B (vendor placed order to supplier), notify vendor
        if (order.vendorId && !order.customerId) {
          await NotificationService.sendMarketplaceOrderAlert(order.vendorId, 'vendor', order, status);
        }
        // If B2C (customer placed order to vendor), notify customer
        else if (order.customerId) {
          await NotificationService.sendToUser(order.customerId, 'client', {
            title: `Order Update: ${status} 🛍️`,
            body: `Your order ${order.orderId} from the salon is now ${status}.`,
            data: { type: 'order_update', orderId: order._id.toString(), status }
          });
        }
      } catch (err) {
        console.error('Order Status Update Notification Error:', err);
      }
    })();

    return NextResponse.json(order, { status: 200 });

  } catch (error) {
    console.error("Error updating order status:", error);
    return NextResponse.json({ message: "Failed to update order status" }, { status: 500 });
  }
}, ['vendor', 'supplier', 'staff']);