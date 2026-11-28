// models/VendorNotifications.model.js

import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    channels: {
      type: [String],
      required: true,
      enum: ["Push", "SMS", "WhatsApp", "Email"],
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    targetType: {
      type: [String],
      required: true,
    },
    targets: [
      {
        id: { type: String, required: true },
        name: { type: String },
      },
    ],
    date: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Sent", "Scheduled"],
      default: "Sent",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const vendorNotificationsSchema = new mongoose.Schema({
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
    required: true,
    unique: true,
    index: true,
  },
  notifications: {
    type: [notificationSchema],
    default: [],
    validate: {
      validator: (notifications) => notifications.length <= 1000,
      message:
        "Notifications array cannot exceed 1000 entries to prevent document size issues.",
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for optimized querying
vendorNotificationsSchema.index({ vendor: 1, "notifications.status": 1 });
vendorNotificationsSchema.index(
  { "notifications.title": "text", "notifications.content": "text" },
  { weights: { "notifications.title": 10, "notifications.content": 5 } }
);
vendorNotificationsSchema.index({ createdAt: -1 });
vendorNotificationsSchema.index({ updatedAt: -1 });

// Pre-save hook to update `updatedAt` timestamp
vendorNotificationsSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Pre-save hook to enforce document size limit
vendorNotificationsSchema.pre("save", function (next) {
  const docSize = Buffer.byteLength(JSON.stringify(this), "utf8");
  if (docSize > 16 * 1024 * 1024) {
    return next(new Error("Document size exceeds MongoDB's 16MB limit."));
  }
  next();
});

// Static method for paginated notification retrieval
vendorNotificationsSchema.statics.getNotificationsByVendor = async function (
  vendorId
) {
  const skip = (page - 1) * limit;

  const pipeline = [
    { $match: { vendor: new mongoose.Types.ObjectId(vendorId) } },
    { $project: { vendor: 1, notifications: 1, createdAt: 1, updatedAt: 1 } },
  ];

  return this.aggregate(pipeline).exec();
};

// Force delete model to ensure schema updates during development hot-reloading
if (mongoose.models.VendorNotifications) {
  delete mongoose.models.VendorNotifications;
}

const VendorNotificationsModel = mongoose.model("VendorNotifications", vendorNotificationsSchema);

export default VendorNotificationsModel;
