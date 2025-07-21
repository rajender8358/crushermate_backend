const MaterialRate = require('../models/MaterialRate');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @desc    Get app configuration including dropdowns and rates
// @route   GET /api/config/app
// @access  Private
const getAppConfig = asyncHandler(async (req, res) => {
  // Get current material rates
  const materialRates = await MaterialRate.getCurrentRates();

  // Entry types configuration
  const entryTypes = [
    {
      value: 'Sales',
      label: 'Sales',
      description: 'Revenue from material sales',
      requiresMaterial: true,
    },
    {
      value: 'Raw Stone',
      label: 'Raw Stone',
      description: 'Raw material purchases',
      requiresMaterial: false,
    },
  ];

  // Material types configuration
  const materialTypes = [
    {
      value: 'M-Sand',
      label: 'M-Sand',
      description: 'Manufactured Sand',
      category: 'sand',
    },
    {
      value: 'P-Sand',
      label: 'P-Sand',
      description: 'Plastering Sand',
      category: 'sand',
    },
    {
      value: 'Blue Metal',
      label: 'Blue Metal',
      description: 'Crushed Stone Aggregate',
      category: 'aggregate',
    },
  ];

  // Create rates lookup for quick access
  const ratesLookup = {};
  materialRates.forEach(rate => {
    ratesLookup[rate.materialType] = {
      currentRate: rate.currentRate,
      previousRate: rate.previousRate,
      lastUpdated: rate.effectiveDate,
      updatedBy: rate.updatedBy,
    };
  });

  // Business rules
  const businessRules = {
    validation: {
      truckNumber: {
        pattern: '^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$',
        example: 'KA01AB1234',
        message: 'Please enter a valid truck number format',
      },
      units: {
        min: 0.1,
        max: 100,
        message: 'Units must be between 0.1 and 100',
      },
      rate: {
        min: 1,
        max: 100000,
        message: 'Rate must be between ₹1 and ₹100,000',
      },
    },
    calculations: {
      totalAmount: 'units * ratePerUnit',
      roundingPrecision: 2,
    },
  };

  res.json({
    success: true,
    data: {
      entryTypes,
      materialTypes,
      materialRates: ratesLookup,
      businessRules,
      appSettings: {
        currency: 'INR',
        locale: 'en-IN',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: 'HH:mm',
      },
    },
  });
});

// @desc    Calculate total amount for given units and rate
// @route   POST /api/config/calculate
// @access  Private
const calculateTotal = asyncHandler(async (req, res) => {
  const { units, ratePerUnit, materialType } = req.body;

  // Validation
  if (!units || !ratePerUnit) {
    throw new AppError(
      'Units and rate per unit are required',
      400,
      'VALIDATION_ERROR',
    );
  }

  const unitsNum = parseFloat(units);
  const rateNum = parseFloat(ratePerUnit);

  if (isNaN(unitsNum) || isNaN(rateNum)) {
    throw new AppError(
      'Units and rate must be valid numbers',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (unitsNum <= 0 || rateNum <= 0) {
    throw new AppError(
      'Units and rate must be greater than 0',
      400,
      'VALIDATION_ERROR',
    );
  }

  // Calculate total with proper rounding
  const totalAmount = Math.round(unitsNum * rateNum * 100) / 100;

  // Format for display
  const formattedTotal = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(totalAmount);

  const formattedRate = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rateNum);

  res.json({
    success: true,
    data: {
      calculation: {
        units: unitsNum,
        ratePerUnit: rateNum,
        totalAmount: totalAmount,
        materialType: materialType || null,
      },
      formatted: {
        units: `${unitsNum} units`,
        ratePerUnit: formattedRate,
        totalAmount: formattedTotal,
        breakdown: `${unitsNum} units × ${formattedRate} = ${formattedTotal}`,
      },
    },
  });
});

// @desc    Get current material rates with calculation preview
// @route   GET /api/config/rates
// @access  Private
const getCurrentRates = asyncHandler(async (req, res) => {
  const { units = 1 } = req.query;
  const unitsNum = parseFloat(units);

  const materialRates = await MaterialRate.getCurrentRates();

  const ratesWithCalculations = materialRates.map(rate => {
    const totalForUnits = unitsNum * rate.currentRate;

    return {
      materialType: rate.materialType,
      currentRate: rate.currentRate,
      previousRate: rate.previousRate,
      changePercentage: rate.rateChangePercentage,
      lastUpdated: rate.effectiveDate,
      updatedBy: rate.updatedBy,
      calculation: {
        units: unitsNum,
        totalAmount: Math.round(totalForUnits * 100) / 100,
        formatted: {
          rate: new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
          }).format(rate.currentRate),
          total: new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
          }).format(totalForUnits),
        },
      },
    };
  });

  res.json({
    success: true,
    data: {
      rates: ratesWithCalculations,
      previewUnits: unitsNum,
    },
  });
});

// @desc    Validate truck entry data
// @route   POST /api/config/validate
// @access  Private
const validateTruckEntry = asyncHandler(async (req, res) => {
  const { truckNumber, entryType, materialType, units, ratePerUnit } = req.body;

  const errors = [];
  const warnings = [];

  // Truck number validation
  const truckNumberPattern = /^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$/;
  if (!truckNumber) {
    errors.push('Truck number is required');
  } else if (!truckNumberPattern.test(truckNumber.toUpperCase())) {
    errors.push('Please enter a valid truck number format (e.g., KA01AB1234)');
  }

  // Entry type validation
  if (!entryType) {
    errors.push('Entry type is required');
  } else if (!['Sales', 'Raw Stone'].includes(entryType)) {
    errors.push('Entry type must be either Sales or Raw Stone');
  }

  // Material type validation for Sales
  if (entryType === 'Sales') {
    if (!materialType) {
      errors.push('Material type is required for Sales entries');
    } else if (!['M-Sand', 'P-Sand', 'Blue Metal'].includes(materialType)) {
      errors.push('Invalid material type selected');
    }
  }

  // Units validation
  if (!units) {
    errors.push('Units is required');
  } else {
    const unitsNum = parseFloat(units);
    if (isNaN(unitsNum)) {
      errors.push('Units must be a valid number');
    } else if (unitsNum <= 0) {
      errors.push('Units must be greater than 0');
    } else if (unitsNum > 100) {
      errors.push('Units cannot exceed 100');
    } else if (unitsNum > 50) {
      warnings.push('Large quantity detected. Please verify the units.');
    }
  }

  // Rate validation
  if (!ratePerUnit) {
    errors.push('Rate per unit is required');
  } else {
    const rateNum = parseFloat(ratePerUnit);
    if (isNaN(rateNum)) {
      errors.push('Rate must be a valid number');
    } else if (rateNum <= 0) {
      errors.push('Rate must be greater than 0');
    } else if (rateNum > 100000) {
      errors.push('Rate cannot exceed ₹100,000');
    }

    // Check against current market rates for Sales
    if (entryType === 'Sales' && materialType && rateNum) {
      // This would compare against current rates and warn if significantly different
      // For now, just a placeholder
      if (rateNum < 15000 || rateNum > 30000) {
        warnings.push('Rate seems unusual compared to current market rates');
      }
    }
  }

  const isValid = errors.length === 0;

  res.json({
    success: true,
    data: {
      isValid,
      errors,
      warnings,
      validatedData: isValid
        ? {
            truckNumber: truckNumber?.toUpperCase(),
            entryType,
            materialType: entryType === 'Sales' ? materialType : null,
            units: parseFloat(units),
            ratePerUnit: parseFloat(ratePerUnit),
            totalAmount: isValid
              ? Math.round(parseFloat(units) * parseFloat(ratePerUnit) * 100) /
                100
              : null,
          }
        : null,
    },
  });
});

module.exports = {
  getAppConfig,
  calculateTotal,
  getCurrentRates,
  validateTruckEntry,
};
