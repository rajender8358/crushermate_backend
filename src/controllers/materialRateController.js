const MaterialRate = require('../models/MaterialRate');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @desc    Get all material rates for the organization
// @route   GET /api/material-rates
// @access  Private
const getMaterialRates = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;

  const rates = await MaterialRate.find({
    organization: organizationId,
  });

  res.json({
    success: true,
    data: rates || [],
  });
});

// @desc    Create or update a material rate
// @route   POST /api/material-rates
// @access  Private (Owner only)
const updateRate = asyncHandler(async (req, res) => {
  const { organizationId, role } = req.user;
  const { materialType, rate } = req.body;

  if (role !== 'owner') {
    throw new AppError(
      'Only owners can update material rates.',
      403,
      'ACCESS_DENIED',
    );
  }

  if (!materialType || !rate) {
    throw new AppError(
      'Material type and rate are required.',
      400,
      'VALIDATION_ERROR',
    );
  }

  // Find the current rate for this organization and material type
  const currentRate = await MaterialRate.findOne({
    organization: organizationId,
    materialType,
  });

  // If the rate is the same, do nothing
  if (currentRate && currentRate.currentRate === parseFloat(rate)) {
    return res.json({
      success: true,
      message: 'Rate is already up to date.',
      data: currentRate,
    });
  }

  let result;
  if (currentRate) {
    // Update existing rate and record history
    currentRate.history.push({
      rate: currentRate.currentRate,
      effectiveDate: currentRate.effectiveDate,
      updatedBy: currentRate.updatedBy,
    });
    currentRate.previousRate = currentRate.currentRate;
    currentRate.currentRate = parseFloat(rate);
    currentRate.effectiveDate = new Date();
    currentRate.updatedBy = req.user.id;
    result = await currentRate.save();
  } else {
    // Create new rate
    result = await MaterialRate.create({
      organization: organizationId,
      materialType,
      currentRate: parseFloat(rate),
      updatedBy: req.user.id,
      history: [],
    });
  }

  res.status(201).json({
    success: true,
    message: `Rate for ${materialType} updated successfully.`,
    data: result,
  });
});

module.exports = {
  getMaterialRates,
  updateRate,
};
