import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100, // Limit name length for storage efficiency
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    discountedPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    duration: {
      type: Number,
      required: true,
      min: 1,
    },
    // Service timing information
    prepTime: {
      type: Number, // in minutes
      default: 0,
    },
    setupCleanupTime: {
      type: Number, // in minutes
      default: 0,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500, // Limit description length for storage efficiency
    },
    image: {
      type: String,
      trim: true,
      default: null,
      maxlength: 1000, // Limit URL/path length
    },
    gender: {
      type: String,
      enum: ["men", "women", "unisex"],
      required: true,
    },
    staff: [
      {
        type: String,
        trim: true,
        maxlength: 50, // Limit staff name length
      },
    ],
    commission: {
      type: Boolean,
      default: false,
    },
    homeService: {
      available: {
        type: Boolean,
        default: false,
      },
      charges: {
        type: Number,
        min: 0,
        default: null,
      },
    },
    weddingService: {
      available: {
        type: Boolean,
        default: false,
      },
      charges: {
        type: Number,
        min: 0,
        default: null,
      },
    },
    bookingInterval: {
      type: Number,
      default: 15,
      min: 1,
    },
    tax: {
      enabled: {
        type: Boolean,
        default: false,
      },
      type: {
        type: String,
        enum: ["percentage", "fixed"],
        default: "percentage",
      },
      value: {
        type: Number,
        min: 0,
        default: null,
      },
    },
    onlineBooking: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "disapproved"],
      default: "pending",
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    addOns: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "AddOn",
      },
    ],
  },
  { _id: true }
);

// Add a method to calculate service price with tax
serviceSchema.methods.calculatePriceWithTax = function () {
  if (!this.tax || !this.tax.enabled) {
    return this.price;
  }

  if (this.tax.type === "percentage") {
    return this.price + (this.price * this.tax.value) / 100;
  } else {
    return this.price + this.tax.value;
  }
};

// Add a method to calculate discount
serviceSchema.methods.calculateDiscountedPrice = function () {
  if (this.discountedPrice !== null && this.discountedPrice !== undefined) {
    return this.discountedPrice;
  }
  return this.price;
};

const vendorServicesSchema = new mongoose.Schema({
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
    required: true,
    unique: true, // One document per vendor (this already creates an index)
  },
  services: {
    type: [serviceSchema],
    default: [],
    validate: {
      validator: (services) => services.length <= 1000, // Limit number of services per vendor
      message: "Services array cannot exceed 1000 entries to prevent document size issues.",
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

// Indexes for optimized querying (removed duplicate vendor index)
vendorServicesSchema.index({ vendor: 1, "services.status": 1 }); // For vendor and status filtering
vendorServicesSchema.index({ "services.category": 1 }); // For category-based filtering
vendorServicesSchema.index(
  { "services.name": "text", "services.description": "text" },
  { weights: { "services.name": 10, "services.description": 5 } } // Prioritize name in text search
);
vendorServicesSchema.index({ createdAt: -1 }); // For sorting by creation date 
vendorServicesSchema.index({ updatedAt: -1 }); // For sorting by update date

// Pre-save hook to update `updatedAt` timestamp
vendorServicesSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Pre-save hook to enforce document size limit
vendorServicesSchema.pre("save", function (next) {
  const docSize = Buffer.byteLength(JSON.stringify(this), "utf8");
  if (docSize > 16 * 1024 * 1024) {
    return next(new Error("Document size exceeds MongoDB's 16MB limit."));
  }
  next();
});

// Static method for paginated service retrieval
vendorServicesSchema.statics.getServicesByVendor = async function (
  vendorId,
  page = 1,
  limit = 100,
  status = null,
  category = null
) {
  const skip = (page - 1) * limit;

  const pipeline = [
    { $match: { vendor: new mongoose.Types.ObjectId(vendorId) } },
    { $unwind: "$services" },
  ];

  if (status) {
    pipeline.push({ $match: { "services.status": status } });
  }
  if (category) {
    pipeline.push({ $match: { "services.category": new mongoose.Types.ObjectId(category) } });
  }

  // ✅ Populate category via lookup
  pipeline.push(
    {
      $lookup: {
        from: "categories", // collection name in MongoDB
        localField: "services.category",
        foreignField: "_id",
        as: "categoryDetails",
      },
    },
    { $unwind: { path: "$categoryDetails", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "addons", // collection name in MongoDB (plural of AddOn)
        localField: "services.addOns",
        foreignField: "_id",
        as: "addOnDetails",
      },
    },
    {
      $addFields: {
        "services.categoryName": "$categoryDetails.name", // add category name
        "services.addOnDetails": "$addOnDetails",
      },
    },
    { $project: { categoryDetails: 0, addOnDetails: 0 } }, // remove raw details
    { $skip: skip },
    { $limit: limit },
    {
      $group: {
        _id: "$_id",
        vendor: { $first: "$vendor" },
        services: { $push: "$services" },
        createdAt: { $first: "$createdAt" },
        updatedAt: { $first: "$updatedAt" },
      },
    },
    { $project: { vendor: 1, services: 1, createdAt: 1, updatedAt: 1 } }
  );

  return this.aggregate(pipeline).exec();
};

// Static method to get staff for a specific service
vendorServicesSchema.statics.getStaffForService = async function (
  vendorId,
  serviceId
) {
  const vendorServices = await this.findOne({ vendor: vendorId });

  if (!vendorServices) {
    return [];
  }

  const service = vendorServices.services.id(serviceId);

  if (!service || !service.staff || service.staff.length === 0) {
    return [];
  }

  return service.staff;
};

const VendorServicesModel =
  mongoose.models.VendorServices ||
  mongoose.model("VendorServices", vendorServicesSchema);

export default VendorServicesModel;