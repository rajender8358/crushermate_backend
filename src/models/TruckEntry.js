const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const truckEntrySchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Entry must belong to an organization'],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
    },
    truckNumber: {
      type: String,
      required: [true, 'Truck number is required'],
      trim: true,
      uppercase: true,
      match: [
        /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/,
        'Please enter a valid truck number format (e.g., KA01AB1234)',
      ],
    },
    entryType: {
      type: String,
      required: [true, 'Entry type is required'],
      enum: ['Sales', 'Raw Stone'],
      index: true,
    },
    materialType: {
      type: String,
      enum: ['M-Sand', 'P-Sand', 'Blue Metal', null],
      required: function () {
        return this.entryType === 'Sales';
      },
      validate: {
        validator: function (value) {
          if (this.entryType === 'Sales') {
            return value && ['M-Sand', 'P-Sand', 'Blue Metal'].includes(value);
          }
          return true; // Raw Stone entries don't need materialType
        },
        message: 'Material type is required for Sales entries',
      },
    },
    units: {
      type: Number,
      required: [true, 'Units is required'],
      min: [0.1, 'Units must be greater than 0'],
      max: [100, 'Units cannot exceed 100'],
    },
    ratePerUnit: {
      type: Number,
      required: [true, 'Rate per unit is required'],
      min: [1, 'Rate must be greater than 0'],
    },
    totalAmount: {
      type: Number,
      required: false, // Auto-calculated in pre-save middleware
    },
    truckImage: {
      type: String,
      default: null,
    },
    entryDate: {
      type: Date,
      required: [true, 'Entry date is required'],
      default: Date.now,
      index: true,
    },
    entryTime: {
      type: String,
      required: false, // Not required from frontend
      default: function () {
        const now = new Date();
        return now.toTimeString().slice(0, 5); // "HH:MM"
      },
      match: [
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        'Please enter time in HH:MM format',
      ],
    },
    status: {
      type: String,
      enum: ['active', 'deleted'],
      default: 'active',
      index: true,
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Add pagination plugin
truckEntrySchema.plugin(mongoosePaginate);

// Compound indexes for better query performance
truckEntrySchema.index({ userId: 1, entryDate: -1 });
truckEntrySchema.index({ entryType: 1, entryDate: -1 });
truckEntrySchema.index({ materialType: 1, entryDate: -1 });
truckEntrySchema.index({ truckNumber: 1, entryDate: -1 });
truckEntrySchema.index({ status: 1, entryDate: -1 });

// Virtual for formatted entry date
truckEntrySchema.virtual('formattedDate').get(function () {
  if (!this.entryDate) return '';
  return this.entryDate.toLocaleDateString('en-IN');
});

// Virtual for formatted total amount
truckEntrySchema.virtual('formattedAmount').get(function () {
  if (!this.totalAmount) return '₹0';
  return `₹${this.totalAmount.toLocaleString('en-IN')}`;
});

// Pre-save middleware to calculate total amount
truckEntrySchema.pre('save', function (next) {
  if (this.units && this.ratePerUnit) {
    // Calculate total amount with proper rounding
    this.totalAmount = Math.round(this.units * this.ratePerUnit * 100) / 100;
  }
  next();
});

// Static method to get entries by date range
truckEntrySchema.statics.getEntriesByDateRange = function (
  startDate,
  endDate,
  filters = {},
) {
  const query = {
    status: 'active',
    entryDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
    ...filters,
  };

  return this.find(query)
    .populate('userId', 'username email')
    .sort({ entryDate: -1, createdAt: -1 });
};

// Static method to get summary by date range
truckEntrySchema.statics.getSummaryByDateRange = async function (
  startDate,
  endDate,
  filters = {},
) {
  const baseMatch = {
    status: 'active',
    entryDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    },
    ...filters,
  };

  const summary = await this.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: '$entryType',
        totalAmount: { $sum: '$totalAmount' },
        totalUnits: { $sum: '$units' },
        count: { $sum: 1 },
      },
    },
  ]);

  // Format the summary
  const result = {
    totalSales: 0,
    totalRawStone: 0,
    totalExpenses: 0,
    salesCount: 0,
    rawStoneCount: 0,
    totalEntries: 0,
  };

  summary.forEach(item => {
    if (item._id === 'Sales') {
      result.totalSales = item.totalAmount;
      result.salesCount = item.count;
    } else if (item._id === 'Raw Stone') {
      result.totalRawStone = item.totalAmount;
      result.rawStoneCount = item.count;
    }
  });

  result.totalEntries = result.salesCount + result.rawStoneCount;
  result.netIncome =
    result.totalSales - result.totalRawStone - result.totalExpenses;

  return result;
};

// Static method to get entries by truck number
truckEntrySchema.statics.getEntriesByTruckNumber = function (truckNumber) {
  return this.find({
    truckNumber: truckNumber.toUpperCase(),
    status: 'active',
  })
    .populate('userId', 'username email')
    .sort({ entryDate: -1 });
};

// Instance method to soft delete
truckEntrySchema.methods.softDelete = function () {
  this.status = 'deleted';
  return this.save();
};

module.exports = mongoose.model('TruckEntry', truckEntrySchema);
