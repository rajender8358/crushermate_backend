const mongoose = require('mongoose');

const otherExpenseSchema = new mongoose.Schema(
  {
    expensesName: {
      type: String,
      required: [true, 'Expenses name is required'],
      trim: true,
      maxlength: [100, 'Expenses name cannot exceed 100 characters'],
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
      max: [10000000, 'Amount cannot exceed 10,000,000'],
    },
    others: {
      type: String,
      trim: true,
      maxlength: [500, 'Others field cannot exceed 500 characters'],
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    date: {
      type: Date,
      default: Date.now,
      required: [true, 'Date is required'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
otherExpenseSchema.index({ organization: 1, date: -1 });
otherExpenseSchema.index({ user: 1, date: -1 });
otherExpenseSchema.index({ organization: 1, isActive: 1 });

// Virtual for formatted amount
otherExpenseSchema.virtual('formattedAmount').get(function () {
  return this.amount.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
  });
});

// Ensure virtual fields are serialized
otherExpenseSchema.set('toJSON', { virtuals: true });
otherExpenseSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('OtherExpense', otherExpenseSchema); 