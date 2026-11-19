
import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
  productName: { type: String, required: true },
  productImage: { type: String }, // URL to the uploaded image
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },

  // For B2C: Customer buying from Vendor
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerName: { type: String },
  customerEmail: { type: String },

  // For B2B: Vendor buying from Supplier
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' }, // The buyer
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' }, // The seller
  regionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Region', index: true, required: true },

  items: [orderItemSchema],
  totalAmount: { type: Number, required: true },

  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending',
  },

  shippingAddress: { type: String, required: true },
  shippingCharge: { type: Number, default: 0 },

  // Payment details
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  },
  paymentMethod: {
    type: String,
    enum: ['online', 'cod'],
    default: 'online',
  },
  paymentId: {
    type: String,
    default: null,
  },
  paymentOrderId: {
    type: String,
    default: null,
  },
  razorpayOrderId: {
    type: String,
    default: null,
  },

  trackingNumber: { type: String },
  courier: { type: String },
  cancellationReason: { type: String, default: null },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: null }, // 'Vendor', 'Supplier'

  statusHistory: [{
    status: String,
    date: { type: Date, default: Date.now },
    notes: String,
  }],
}, { timestamps: true });

// Add initial status to history before saving and inherit regionId
orderSchema.pre('save', async function (next) {
  if (this.isNew) {
    this.statusHistory.push({ status: 'Pending', notes: 'Order placed.' });
  }

  // 1. Inherit regionId if missing
  if (!this.regionId) {
    try {
      // Determine parents
      const sellerId = this.supplierId || this.vendorId;
      const sellerModelName = this.supplierId ? 'Supplier' : 'Vendor';

      if (sellerId) {
        const SellerModel = mongoose.models[sellerModelName] || (await import(`./${sellerModelName}.model.js`)).default;
        const seller = await SellerModel.findById(sellerId).select('regionId');
        if (seller && seller.regionId) {
          this.regionId = seller.regionId;
        }
      }
    } catch (error) {
      console.error("[OrderModel] Error inheriting regionId:", error);
    }
  }

  next();
});

const OrderModel = mongoose.models.Order || mongoose.model('Order', orderSchema);

export default OrderModel;
