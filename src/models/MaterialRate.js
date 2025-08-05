const mongoose = require('mongoose');

const materialRateSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Rate must belong to an organization'],
    },
    materialType: {
      type: String,
      required: [true, 'Material type is required'],
      enum: [
        '1 1/2" Metal',
        '3/4" Jalli',
        '1/2" Jalli',
        '1/4" Kuranai',
        'Dust',
        'Wetmix',
        'M sand',
        'P sand',
        'Raw Stone'
      ],
    },
    currentRate: {
      type: Number,
      required: [true, 'Current rate is required'],
      min: [0, 'Rate cannot be negative'],
    },
    previousRate: {
      type: Number,
      default: null,
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    history: [
      {
        rate: Number,
        effectiveDate: Date,
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

materialRateSchema.index(
  { organization: 1, materialType: 1 },
  { unique: true },
);

// Method to update a rate and record history
materialRateSchema.statics.updateRate = async function (
  organizationId,
  materialType,
  newRate,
  userId,
) {
  const existingRate = await this.findOne({
    organization: organizationId,
    materialType,
  });

  if (existingRate) {
    // If rate already exists, update it
    existingRate.history.push({
      rate: existingRate.currentRate,
      effectiveDate: existingRate.effectiveDate,
      updatedBy: existingRate.updatedBy,
    });
    existingRate.previousRate = existingRate.currentRate;
    existingRate.currentRate = newRate;
    existingRate.effectiveDate = new Date();
    existingRate.updatedBy = userId;
    return existingRate.save();
  } else {
    // If rate doesn't exist, create it
    return this.create({
      organization: organizationId,
      materialType,
      currentRate: newRate,
      updatedBy: userId,
      history: [],
    });
  }
};

materialRateSchema.statics.getRatesForOrganization = function (organizationId) {
  return this.find({ organization: organizationId }).populate(
    'updatedBy',
    'username',
  );
};

materialRateSchema.statics.getMaterialTypes = async function () {
  return this.distinct('materialType');
};

module.exports = mongoose.model('MaterialRate', materialRateSchema);
