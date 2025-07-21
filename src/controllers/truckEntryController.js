const TruckEntry = require('../models/TruckEntry');
const MaterialRate = require('../models/MaterialRate');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { body, validationResult, query } = require('express-validator');
const { deleteImage, extractPublicId } = require('../middleware/uploadImage');

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
    .isIn(['M-Sand', 'P-Sand', 'Blue Metal'])
    .withMessage('Material type must be M-Sand, P-Sand, or Blue Metal'),
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
    .isIn(['M-Sand', 'P-Sand', 'Blue Metal'])
    .withMessage('Material type must be M-Sand, P-Sand, or Blue Metal'),
];

// @desc    Create new truck entry
// @route   POST /api/truck-entries
// @access  Private
const createTruckEntry = asyncHandler(async (req, res) => {
  // Debug: Log incoming request
  console.log('📥 Create Truck Entry Request:');
  console.log('  - Body:', JSON.stringify(req.body, null, 2));
  console.log('  - User ID:', req.user?.id);
  console.log('  - File:', req.file);

  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('❌ Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => err.msg),
      error: 'VALIDATION_ERROR',
    });
  }

  const { truckNumber, entryType, materialType, units, ratePerUnit, notes } =
    req.body;

  // Validate material type for Sales entries
  if (entryType === 'Sales' && !materialType) {
    throw new AppError(
      'Material type is required for Sales entries',
      400,
      'VALIDATION_ERROR',
    );
  }

  // Convert string values to numbers (multipart form data sends everything as strings)
  const unitsValue = parseFloat(units);
  const ratePerUnitValue = parseFloat(ratePerUnit);

  // Set entryTime and entryDate automatically
  const now = new Date();
  const entryTime = now.toTimeString().slice(0, 5); // "HH:MM"
  const entryDate = now;

  console.log('✅ Creating truck entry with data:', {
    userId: req.user.id,
    truckNumber: truckNumber.toUpperCase(),
    entryType,
    materialType: entryType === 'Sales' ? materialType : null,
    units: unitsValue,
    ratePerUnit: ratePerUnitValue,
    entryTime,
    entryDate,
    notes: notes || '',
    truckImage: req.file ? req.file.path : null,
  });

  // Create truck entry
  const truckEntry = await TruckEntry.create({
    userId: req.user.id,
    truckNumber: truckNumber.toUpperCase(),
    entryType,
    materialType: entryType === 'Sales' ? materialType : null,
    units: unitsValue,
    ratePerUnit: ratePerUnitValue,
    entryTime, // set by backend
    entryDate, // set by backend
    notes: notes || '',
    truckImage: req.file ? req.file.path : null, // Cloudinary URL
  });

  // Populate user info
  await truckEntry.populate('userId', 'username email');

  console.log('✅ Truck entry created successfully:', truckEntry._id);

  res.status(201).json({
    success: true,
    message: 'Truck entry created successfully',
    data: {
      truckEntry,
    },
  });
});

// @desc    Get truck entries with filtering
// @route   GET /api/truck-entries
// @access  Private
const getTruckEntries = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    entryType,
    materialType,
    truckNumber,
    startDate,
    endDate,
    userId,
  } = req.query;

  // Build filter object
  const filter = { status: 'active' };

  // Role-based filtering
  if (req.user.role !== 'owner') {
    filter.userId = req.user.id;
  } else if (userId) {
    filter.userId = userId;
  }

  if (entryType) filter.entryType = entryType;
  if (materialType) filter.materialType = materialType;
  if (truckNumber) filter.truckNumber = truckNumber.toUpperCase();

  // Date range filtering
  if (startDate || endDate) {
    filter.entryDate = {};
    if (startDate) {
      const startDateTime = new Date(startDate);
      startDateTime.setHours(0, 0, 0, 0);
      filter.entryDate.$gte = startDateTime;
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      filter.entryDate.$lte = endDateTime;
    }
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Execute query
  const [entries, total] = await Promise.all([
    TruckEntry.find(filter)
      .populate('userId', 'username email')
      .sort({ entryDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    TruckEntry.countDocuments(filter),
  ]);

  // Calculate pagination info
  const totalPages = Math.ceil(total / parseInt(limit));
  const hasNextPage = parseInt(page) < totalPages;
  const hasPrevPage = parseInt(page) > 1;

  res.json({
    success: true,
    data: {
      entries,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalEntries: total,
        entriesPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage,
      },
    },
  });
});

// @desc    Get single truck entry
// @route   GET /api/truck-entries/:id
// @access  Private
const getTruckEntry = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const truckEntry = await TruckEntry.findById(id).populate(
    'userId',
    'username email',
  );

  if (!truckEntry) {
    throw new AppError('Truck entry not found', 404, 'NOT_FOUND');
  }

  // Check ownership (non-owners can only see their own entries)
  if (
    req.user.role !== 'owner' &&
    truckEntry.userId._id.toString() !== req.user.id
  ) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  res.json({
    success: true,
    data: {
      truckEntry,
    },
  });
});

// @desc    Update truck entry
// @route   PUT /api/truck-entries/:id
// @access  Private
const updateTruckEntry = asyncHandler(async (req, res) => {
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

  const { id } = req.params;
  const updateData = req.body;

  const truckEntry = await TruckEntry.findById(id);

  if (!truckEntry) {
    throw new AppError('Truck entry not found', 404, 'NOT_FOUND');
  }

  // Check ownership (non-owners can only update their own entries)
  if (
    req.user.role !== 'owner' &&
    truckEntry.userId.toString() !== req.user.id
  ) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Validate material type for Sales entries
  const newEntryType = updateData.entryType || truckEntry.entryType;
  const newMaterialType = updateData.materialType || truckEntry.materialType;

  if (newEntryType === 'Sales' && !newMaterialType) {
    throw new AppError(
      'Material type is required for Sales entries',
      400,
      'VALIDATION_ERROR',
    );
  }

  // Handle image update
  if (req.file) {
    // Delete old image if exists
    if (truckEntry.truckImage) {
      const oldPublicId = extractPublicId(truckEntry.truckImage);
      await deleteImage(oldPublicId);
    }
    // Set new image
    truckEntry.truckImage = req.file.path;
  }

  // Update fields
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined && key !== 'truckImage') {
      if (key === 'truckNumber') {
        truckEntry[key] = updateData[key].toUpperCase();
      } else {
        truckEntry[key] = updateData[key];
      }
    }
  });

  // Clear material type for Raw Stone entries
  if (newEntryType === 'Raw Stone') {
    truckEntry.materialType = null;
  }

  await truckEntry.save();
  await truckEntry.populate('userId', 'username email');

  res.json({
    success: true,
    message: 'Truck entry updated successfully',
    data: {
      truckEntry,
    },
  });
});

// @desc    Delete truck entry (soft delete)
// @route   DELETE /api/truck-entries/:id
// @access  Private
const deleteTruckEntry = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const truckEntry = await TruckEntry.findById(id);

  if (!truckEntry) {
    throw new AppError('Truck entry not found', 404, 'NOT_FOUND');
  }

  // Check ownership (non-owners can only delete their own entries)
  if (
    req.user.role !== 'owner' &&
    truckEntry.userId.toString() !== req.user.id
  ) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  // Delete image from Cloudinary if exists
  if (truckEntry.truckImage) {
    const publicId = extractPublicId(truckEntry.truckImage);
    await deleteImage(publicId);
  }

  await truckEntry.softDelete();

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
  getTruckEntries,
  getTruckEntry,
  updateTruckEntry,
  deleteTruckEntry,
  getTruckEntriesSummary,
  createTruckEntryValidation,
  updateTruckEntryValidation,
};
