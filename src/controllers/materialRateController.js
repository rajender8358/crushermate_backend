const MaterialRate = require('../models/MaterialRate');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { body, validationResult } = require('express-validator');

// Validation rules
const updateRateValidation = [
  body('materialType')
    .isIn(['M-Sand', 'P-Sand', 'Blue Metal'])
    .withMessage('Material type must be M-Sand, P-Sand, or Blue Metal'),
  body('currentRate')
    .isFloat({ min: 1, max: 10000 })
    .withMessage('Rate must be between 1 and 10,000'),
  body('notes')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Notes cannot exceed 200 characters'),
];

// @desc    Get current material rates
// @route   GET /api/material-rates
// @access  Private
const getCurrentRates = asyncHandler(async (req, res) => {
  const rates = await MaterialRate.getCurrentRates();

  res.json({
    success: true,
    data: {
      rates,
    },
  });
});

// @desc    Update material rate
// @route   POST /api/material-rates
// @access  Private (Owner only)
const updateMaterialRate = asyncHandler(async (req, res) => {
  // Check if user is owner
  if (req.user.role !== 'owner') {
    throw new AppError(
      'Owner access required',
      403,
      'INSUFFICIENT_PERMISSIONS',
    );
  }

  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => err.msg),
      error: 'VALIDATION_ERROR',
    });
  }

  const { materialType, currentRate, notes, effectiveDate } = req.body;

  // Check if rate already exists for this material
  const existingRate = await MaterialRate.findOne({
    materialType,
    isActive: true,
  });

  let materialRate;

  if (existingRate) {
    // Store previous rate
    const previousRate = existingRate.currentRate;

    // Update existing rate
    existingRate.currentRate = currentRate;
    existingRate.previousRate = previousRate;
    existingRate.updatedBy = req.user.id;
    existingRate.effectiveDate = effectiveDate || new Date();
    existingRate.notes = notes || '';

    materialRate = await existingRate.save();
  } else {
    // Create new rate entry
    materialRate = await MaterialRate.create({
      materialType,
      currentRate,
      updatedBy: req.user.id,
      effectiveDate: effectiveDate || new Date(),
      notes: notes || '',
    });
  }

  // Populate user info
  await materialRate.populate('updatedBy', 'username email');

  res.json({
    success: true,
    message: `${materialType} rate updated successfully`,
    data: {
      materialRate,
    },
  });
});

// @desc    Get rate history for a material
// @route   GET /api/material-rates/history/:materialType
// @access  Private
const getRateHistory = asyncHandler(async (req, res) => {
  const { materialType } = req.params;
  const { limit = 10 } = req.query;

  // Validate material type
  if (!['M-Sand', 'P-Sand', 'Blue Metal'].includes(materialType)) {
    throw new AppError('Invalid material type', 400, 'VALIDATION_ERROR');
  }

  const history = await MaterialRate.getRateHistory(
    materialType,
    parseInt(limit),
  );

  res.json({
    success: true,
    data: {
      materialType,
      history,
    },
  });
});

// @desc    Get specific material rate
// @route   GET /api/material-rates/:materialType
// @access  Private
const getMaterialRate = asyncHandler(async (req, res) => {
  const { materialType } = req.params;

  // Validate material type
  if (!['M-Sand', 'P-Sand', 'Blue Metal'].includes(materialType)) {
    throw new AppError('Invalid material type', 400, 'VALIDATION_ERROR');
  }

  const rate = await MaterialRate.getRateForMaterial(materialType);

  if (!rate) {
    throw new AppError(`Rate not found for ${materialType}`, 404, 'NOT_FOUND');
  }

  res.json({
    success: true,
    data: {
      rate,
    },
  });
});

// @desc    Bulk update multiple rates
// @route   PUT /api/material-rates/bulk
// @access  Private (Owner only)
const bulkUpdateRates = asyncHandler(async (req, res) => {
  // Check if user is owner
  if (req.user.role !== 'owner') {
    throw new AppError(
      'Owner access required',
      403,
      'INSUFFICIENT_PERMISSIONS',
    );
  }

  const { rates, effectiveDate } = req.body;

  // Validate rates array
  if (!Array.isArray(rates) || rates.length === 0) {
    throw new AppError('Rates array is required', 400, 'VALIDATION_ERROR');
  }

  // Validate each rate
  const validMaterials = ['M-Sand', 'P-Sand', 'Blue Metal'];
  const updatedRates = [];

  for (const rateData of rates) {
    const { materialType, currentRate, notes } = rateData;

    // Validate material type and rate
    if (!validMaterials.includes(materialType)) {
      throw new AppError(
        `Invalid material type: ${materialType}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    if (!currentRate || currentRate < 1 || currentRate > 10000) {
      throw new AppError(
        `Invalid rate for ${materialType}`,
        400,
        'VALIDATION_ERROR',
      );
    }

    // Update or create rate
    const existingRate = await MaterialRate.findOne({
      materialType,
      isActive: true,
    });

    let materialRate;

    if (existingRate) {
      const previousRate = existingRate.currentRate;
      existingRate.currentRate = currentRate;
      existingRate.previousRate = previousRate;
      existingRate.updatedBy = req.user.id;
      existingRate.effectiveDate = effectiveDate || new Date();
      existingRate.notes = notes || '';
      materialRate = await existingRate.save();
    } else {
      materialRate = await MaterialRate.create({
        materialType,
        currentRate,
        updatedBy: req.user.id,
        effectiveDate: effectiveDate || new Date(),
        notes: notes || '',
      });
    }

    await materialRate.populate('updatedBy', 'username email');
    updatedRates.push(materialRate);
  }

  res.json({
    success: true,
    message: `${updatedRates.length} material rates updated successfully`,
    data: {
      rates: updatedRates,
    },
  });
});

// @desc    Get rate statistics
// @route   GET /api/material-rates/stats
// @access  Private (Owner only)
const getRateStatistics = asyncHandler(async (req, res) => {
  // Check if user is owner
  if (req.user.role !== 'owner') {
    throw new AppError(
      'Owner access required',
      403,
      'INSUFFICIENT_PERMISSIONS',
    );
  }

  const { period = 'month' } = req.query;

  // Calculate date range
  const now = new Date();
  let startDate;

  switch (period) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Get rate changes in the period
  const rateChanges = await MaterialRate.find({
    effectiveDate: { $gte: startDate },
    isActive: true,
  })
    .populate('updatedBy', 'username email')
    .sort({ effectiveDate: -1 });

  // Get current rates with change percentages
  const currentRates = await MaterialRate.getCurrentRates();

  const rateStats = currentRates.map(rate => ({
    materialType: rate.materialType,
    currentRate: rate.currentRate,
    previousRate: rate.previousRate,
    changePercentage: rate.rateChangePercentage,
    lastUpdated: rate.effectiveDate,
    updatedBy: rate.updatedBy,
  }));

  res.json({
    success: true,
    data: {
      period,
      dateRange: { startDate, endDate: now },
      currentRates: rateStats,
      recentChanges: rateChanges.length,
      rateHistory: rateChanges,
    },
  });
});

module.exports = {
  getCurrentRates,
  updateMaterialRate,
  getRateHistory,
  getMaterialRate,
  bulkUpdateRates,
  getRateStatistics,
  updateRateValidation,
};
