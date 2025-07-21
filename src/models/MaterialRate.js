const mongoose = require('mongoose');

const materialRateSchema = new mongoose.Schema(
  {
    materialType: {
      type: String,
      required: [true, 'Material type is required'],
      enum: ['M-Sand', 'P-Sand', 'Blue Metal'],
      unique: true,
      index: true,
    },
    currentRate: {
      type: Number,
      required: [true, 'Current rate is required'],
      min: [1, 'Rate must be greater than 0'],
      max: [50000, 'Rate cannot exceed 50,000'],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Updated by user is required'],
    },
    effectiveDate: {
      type: Date,
      required: [true, 'Effective date is required'],
      default: Date.now,
      index: true,
    },
    previousRate: {
      type: Number,
      default: null,
    },
    notes: {
      type: String,
      maxlength: [200, 'Notes cannot exceed 200 characters'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Index for better query performance
materialRateSchema.index({ materialType: 1, effectiveDate: -1 });
materialRateSchema.index({ updatedBy: 1, createdAt: -1 });

// Virtual for formatted current rate
materialRateSchema.virtual('formattedRate').get(function () {
  return `₹${this.currentRate.toLocaleString('en-IN')}`;
});

// Virtual for rate change percentage
materialRateSchema.virtual('rateChangePercentage').get(function () {
  if (!this.previousRate || this.previousRate === 0) return null;

  const change =
    ((this.currentRate - this.previousRate) / this.previousRate) * 100;
  return Math.round(change * 100) / 100; // Round to 2 decimal places
});

// Pre-save middleware to set previous rate
materialRateSchema.pre('save', async function (next) {
  if (this.isNew || !this.isModified('currentRate')) {
    return next();
  }

  try {
    // Find the previous rate for this material type
    const previousEntry = await this.constructor
      .findOne({
        materialType: this.materialType,
        _id: { $ne: this._id },
      })
      .sort({ effectiveDate: -1 });

    if (previousEntry) {
      this.previousRate = previousEntry.currentRate;
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Static method to get current rates for all materials
materialRateSchema.statics.getCurrentRates = function () {
  return this.find({ isActive: true })
    .populate('updatedBy', 'username email')
    .sort({ materialType: 1 });
};

// Static method to get rate history for a material
materialRateSchema.statics.getRateHistory = function (
  materialType,
  limit = 10,
) {
  return this.find({ materialType, isActive: true })
    .populate('updatedBy', 'username email')
    .sort({ effectiveDate: -1 })
    .limit(limit);
};

// Static method to get rate for a specific material
materialRateSchema.statics.getRateForMaterial = function (materialType) {
  return this.findOne({ materialType, isActive: true }).populate(
    'updatedBy',
    'username email',
  );
};

// Instance method to deactivate rate
materialRateSchema.methods.deactivate = function () {
  this.isActive = false;
  return this.save();
};

module.exports = mongoose.model('MaterialRate', materialRateSchema);
