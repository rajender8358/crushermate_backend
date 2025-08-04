const TruckEntry = require('../models/TruckEntry');
const MaterialRate = require('../models/MaterialRate');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { body, validationResult, query } = require('express-validator');
const { deleteImage, extractPublicId } = require('../middleware/uploadImage');
const mongoose = require('mongoose');

// Validation rules
const createTruckEntryValidation = [
  body('truckNumber')
    .notEmpty()
    .withMessage('Truck number is required')
    .custom(value => {
      // More flexible truck number validation
      const truckNumber = value.toUpperCase();
      // Allow various formats: KA01AB1234, KA-01-AB-1234, KA 01 AB 1234, etc.
      const pattern =
        /^[A-Z]{2}[\s\-]?[0-9]{2}[\s\-]?[A-Z]{1,2}[\s\-]?[0-9]{4}$/;
      if (!pattern.test(truckNumber)) {
        throw new Error(
          'Please provide a valid truck number (e.g., KA01AB1234, KA-01-AB-1234)',
        );
      }
      return true;
    }),
  body('truckName')
    .notEmpty()
    .withMessage('Truck name is required')
    .isLength({ max: 20 })
    .withMessage('Truck name must be 20 characters or less')
    .matches(/^[A-Za-z\s]+$/)
    .withMessage('Truck name must contain only letters and spaces'),
  body('entryType')
    .isIn(['Sales', 'Raw Stone'])
    .withMessage('Entry type must be either Sales or Raw Stone'),
  body('units').custom(value => {
    // Handle both string and number values from multipart form data
    const unitsValue = parseFloat(value);
    if (isNaN(unitsValue) || unitsValue < 0.1 || unitsValue > 100) {
      throw new Error('Units must be between 0.1 and 100');
    }
    return true;
  }),
  body('ratePerUnit').custom(value => {
    // Handle both string and number values from multipart form data
    const rateValue = parseFloat(value);
    if (isNaN(rateValue) || rateValue < 1) {
      throw new Error('Rate per unit must be greater than 0');
    }
    return true;
  }),
  body('materialType')
    .optional()
    .isIn([
      'M-Sand',
      'P-Sand',
      'Blue Metal 0.5in',
      'Blue Metal 0.75in',
      'Jally',
      'Kurunai',
      'Mixed',
    ])
    .withMessage('Material type must be one of the valid sales materials'),
];

const updateTruckEntryValidation = [
  body('truckNumber')
    .optional()
    .custom(value => {
      if (!value) return true; // Optional field
      // More flexible truck number validation
      const truckNumber = value.toUpperCase();
      // Allow various formats: KA01AB1234, KA-01-AB-1234, KA 01 AB 1234, etc.
      const pattern =
        /^[A-Z]{2}[\s\-]?[0-9]{2}[\s\-]?[A-Z]{1,2}[\s\-]?[0-9]{4}$/;
      if (!pattern.test(truckNumber)) {
        throw new Error(
          'Please provide a valid truck number (e.g., KA01AB1234, KA-01-AB-1234)',
        );
      }
      return true;
    }),
  body('truckName')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Truck name must be 20 characters or less')
    .matches(/^[A-Za-z\s]+$/)
    .withMessage('Truck name must contain only letters and spaces'),
  body('entryType')
    .optional()
    .isIn(['Sales', 'Raw Stone'])
    .withMessage('Entry type must be either Sales or Raw Stone'),
  body('units')
    .optional()
    .custom(value => {
      if (!value) return true; // Optional field
      // Handle both string and number values from multipart form data
      const unitsValue = parseFloat(value);
      if (isNaN(unitsValue) || unitsValue < 0.1 || unitsValue > 100) {
        throw new Error('Units must be between 0.1 and 100');
      }
      return true;
    }),
  body('ratePerUnit')
    .optional()
    .custom(value => {
      if (!value) return true; // Optional field
      // Handle both string and number values from multipart form data
      const rateValue = parseFloat(value);
      if (isNaN(rateValue) || rateValue < 1) {
        throw new Error('Rate per unit must be greater than 0');
      }
      return true;
    }),
  body('materialType')
    .optional()
    .isIn([
      'M-Sand',
      'P-Sand',
      'Blue Metal 0.5in',
      'Blue Metal 0.75in',
      'Jally',
      'Kurunai',
      'Mixed',
    ])
    .withMessage('Material type must be one of the valid sales materials'),
];

// @desc    Create new truck entry
// @route   POST /api/truck-entries
// @access  Private
const createTruckEntry = asyncHandler(async (req, res) => {
  const { organizationId, id: userId } = req.user;
  const {
    truckNumber,
    truckName,
    entryType,
    materialType,
    units,
    ratePerUnit,
    entryDate,
    notes,
  } = req.body;

  let truckImage = null;
  if (req.file) {
    truckImage = req.file.path; // Path from multer upload
  }

  // Basic validation
  if (!truckNumber || !truckName || !entryType || !units || !ratePerUnit) {
    throw new AppError('Missing required fields', 400, 'VALIDATION_ERROR');
  }

  const newEntry = await TruckEntry.create({
    organization: organizationId,
    userId,
    truckNumber,
    truckName,
    entryType,
    materialType,
    units,
    ratePerUnit,
    entryDate,
    truckImage,
    notes,
  });

  res.status(201).json({
    success: true,
    message: 'Truck entry created successfully',
    data: {
      truckEntry: newEntry,
    },
  });
});

// @desc    Get all truck entries (with filtering)
// @route   GET /api/truck-entries
// @access  Private
const getAllTruckEntries = asyncHandler(async (req, res) => {
  const { organizationId, id: userId, role } = req.user;
  const {
    page = 1,
    limit = 10,
    sortBy = 'entryDate',
    sortOrder = 'desc',
    ...queryFilters
  } = req.query;

  const filter = {
    organization: new mongoose.Types.ObjectId(organizationId),
    status: 'active',
  };

  // User-specific filtering
  if (role !== 'owner') {
    filter.userId = new mongoose.Types.ObjectId(userId);
  } else if (queryFilters.userId) {
    filter.userId = new mongoose.Types.ObjectId(queryFilters.userId);
  }

  // Other filters from query
  if (queryFilters.truckNumber) {
    filter.truckNumber = { $regex: queryFilters.truckNumber, $options: 'i' };
  }
  if (queryFilters.entryType) {
    filter.entryType = queryFilters.entryType;
  }
  if (queryFilters.materialType) {
    filter.materialType = queryFilters.materialType;
  }
  if (queryFilters.startDate && queryFilters.endDate) {
    filter.entryDate = {
      $gte: new Date(queryFilters.startDate),
      $lte: new Date(queryFilters.endDate),
    };
  }

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort: { [sortBy]: sortOrder },
    populate: 'userId',
  };

  const result = await TruckEntry.paginate(filter, options);

  res.json({
    success: true,
    data: result.docs,
    pagination: {
      totalDocs: result.totalDocs,
      limit: result.limit,
      totalPages: result.totalPages,
      page: result.page,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    },
  });
});

// @desc    Get a single truck entry by ID
// @route   GET /api/truck-entries/:id
// @access  Private
const getTruckEntry = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;
  const { id } = req.params;

  const entry = await TruckEntry.findOne({
    _id: id,
    organization: organizationId,
    status: 'active',
  }).populate('userId', 'username email');

  if (!entry) {
    throw new AppError('Truck entry not found', 404, 'NOT_FOUND');
  }

  res.json({
    success: true,
    data: entry,
  });
});

// @desc    Update a truck entry by ID
// @route   PUT /api/truck-entries/:id
// @access  Private
const updateTruckEntry = asyncHandler(async (req, res) => {
  const { organizationId, id: userId, role } = req.user;
  const { id } = req.params;

  const entry = await TruckEntry.findOne({
    _id: id,
    organization: organizationId,
    status: 'active',
  });

  if (!entry) {
    throw new AppError('Truck entry not found', 404, 'NOT_FOUND');
  }

  // Check ownership
  if (role !== 'owner' && entry.userId.toString() !== userId) {
    throw new AppError(
      'You are not authorized to update this entry',
      403,
      'ACCESS_DENIED',
    );
  }

  // Update fields
  const {
    truckNumber,
    entryType,
    materialType,
    units,
    ratePerUnit,
    entryDate,
    notes,
  } = req.body;

  if (truckNumber) entry.truckNumber = truckNumber;
  if (entryType) entry.entryType = entryType;
  if (materialType) entry.materialType = materialType;
  if (units) entry.units = units;
  if (ratePerUnit) entry.ratePerUnit = ratePerUnit;
  if (entryDate) entry.entryDate = entryDate;
  if (notes) entry.notes = notes;

  if (req.file) {
    entry.truckImage = req.file.path;
  }

  const updatedEntry = await entry.save();

  res.json({
    success: true,
    message: 'Truck entry updated successfully',
    data: {
      truckEntry: updatedEntry,
    },
  });
});

// @desc    Delete a truck entry by ID (soft delete)
// @route   DELETE /api/truck-entries/:id
// @access  Private
const deleteTruckEntry = asyncHandler(async (req, res) => {
  const { organizationId, id: userId, role } = req.user;
  const { id } = req.params;

  const entry = await TruckEntry.findOne({
    _id: id,
    organization: organizationId,
    status: 'active',
  });

  if (!entry) {
    throw new AppError('Truck entry not found', 404, 'NOT_FOUND');
  }

  // Check ownership
  if (role !== 'owner' && entry.userId.toString() !== userId) {
    throw new AppError(
      'You are not authorized to delete this entry',
      403,
      'ACCESS_DENIED',
    );
  }

  await entry.softDelete();

  res.json({
    success: true,
    message: 'Truck entry deleted successfully',
    data: null,
  });
});

// @desc    Get truck entries summary
// @route   GET /api/truck-entries/summary
// @access  Private
const getTruckEntriesSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate, userId } = req.query;

  // Build filter
  const filter = { status: 'active' };

  // Role-based filtering
  if (req.user.role !== 'owner') {
    filter.userId = req.user.id;
  } else if (userId) {
    filter.userId = userId;
  }

  // Date range
  if (startDate || endDate) {
    filter.entryDate = {};
    if (startDate) filter.entryDate.$gte = new Date(startDate);
    if (endDate) filter.entryDate.$lte = new Date(endDate);
  }

  const summary = await TruckEntry.getSummaryByDateRange(
    startDate || new Date(new Date().getFullYear(), 0, 1), // Start of year if not provided
    endDate || new Date(), // Today if not provided
    req.user.role !== 'owner' ? { userId: req.user.id } : {},
  );

  res.json({
    success: true,
    data: {
      summary,
    },
  });
});

module.exports = {
  createTruckEntry,
  getAllTruckEntries,
  getTruckEntry,
  updateTruckEntry,
  deleteTruckEntry,
  getTruckEntriesSummary,
  createTruckEntryValidation,
  updateTruckEntryValidation,
};
