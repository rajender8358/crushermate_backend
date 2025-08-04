const OtherExpense = require('../models/OtherExpense');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { body, validationResult } = require('express-validator');

// @desc    Create a new other expense
// @route   POST /api/other-expenses
// @access  Private
const createOtherExpense = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { expensesName, amount, others, notes, date } = req.body;
  const { organizationId, id: userId } = req.user;

  const otherExpense = await OtherExpense.create({
    expensesName,
    amount: parseFloat(amount),
    others,
    notes,
    date: date ? new Date(date) : new Date(),
    organization: organizationId,
    user: userId,
  });

  await otherExpense.populate('user', 'username fullName');

  res.status(201).json({
    success: true,
    message: 'Other expense created successfully',
    data: otherExpense,
  });
});

// @desc    Get all other expenses for organization
// @route   GET /api/other-expenses
// @access  Private
const getOtherExpenses = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;
  const { startDate, endDate, limit = 50, page = 1 } = req.query;

  const query = { organization: organizationId, isActive: true };

  // Date filtering
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [otherExpenses, total] = await Promise.all([
    OtherExpense.find(query)
      .populate('user', 'username fullName')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    OtherExpense.countDocuments(query),
  ]);

  res.json({
    success: true,
    data: otherExpenses,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
});

// @desc    Get other expense by ID
// @route   GET /api/other-expenses/:id
// @access  Private
const getOtherExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;

  const otherExpense = await OtherExpense.findOne({
    _id: id,
    organization: organizationId,
    isActive: true,
  }).populate('user', 'username fullName');

  if (!otherExpense) {
    throw new AppError('Other expense not found', 404);
  }

  res.json({
    success: true,
    data: otherExpense,
  });
});

// @desc    Update other expense
// @route   PUT /api/other-expenses/:id
// @access  Private
const updateOtherExpense = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }

  const { id } = req.params;
  const { organizationId } = req.user;
  const { expensesName, amount, others, notes, date } = req.body;

  const otherExpense = await OtherExpense.findOne({
    _id: id,
    organization: organizationId,
    isActive: true,
  });

  if (!otherExpense) {
    throw new AppError('Other expense not found', 404);
  }

  // Update fields
  if (expensesName !== undefined) otherExpense.expensesName = expensesName;
  if (amount !== undefined) otherExpense.amount = parseFloat(amount);
  if (others !== undefined) otherExpense.others = others;
  if (notes !== undefined) otherExpense.notes = notes;
  if (date !== undefined) otherExpense.date = new Date(date);

  await otherExpense.save();
  await otherExpense.populate('user', 'username fullName');

  res.json({
    success: true,
    message: 'Other expense updated successfully',
    data: otherExpense,
  });
});

// @desc    Delete other expense (soft delete)
// @route   DELETE /api/other-expenses/:id
// @access  Private
const deleteOtherExpense = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { organizationId } = req.user;

  const otherExpense = await OtherExpense.findOne({
    _id: id,
    organization: organizationId,
    isActive: true,
  });

  if (!otherExpense) {
    throw new AppError('Other expense not found', 404);
  }

  otherExpense.isActive = false;
  await otherExpense.save();

  res.json({
    success: true,
    message: 'Other expense deleted successfully',
  });
});

// @desc    Get other expenses summary for dashboard
// @route   GET /api/other-expenses/summary
// @access  Private
const getOtherExpensesSummary = asyncHandler(async (req, res) => {
  const { organizationId } = req.user;
  const { startDate, endDate } = req.query;

  const query = { organization: organizationId, isActive: true };

  // Date filtering
  if (startDate || endDate) {
    query.date = {};
    if (startDate) query.date.$gte = new Date(startDate);
    if (endDate) query.date.$lte = new Date(endDate + 'T23:59:59.999Z');
  }

  const [totalAmount, totalCount, recentExpenses] = await Promise.all([
    OtherExpense.aggregate([
      { $match: query },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    OtherExpense.countDocuments(query),
    OtherExpense.find(query)
      .sort({ date: -1 })
      .limit(5)
      .populate('user', 'username fullName'),
  ]);

  res.json({
    success: true,
    data: {
      totalAmount: totalAmount[0]?.total || 0,
      totalCount,
      recentExpenses,
    },
  });
});

// Validation middleware
const createOtherExpenseValidation = [
  body('expensesName')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Expenses name is required and cannot exceed 100 characters'),
  body('amount')
    .isFloat({ min: 0, max: 10000000 })
    .withMessage('Amount must be a valid number between 0 and 10,000,000'),
  body('others')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Others field cannot exceed 500 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO date'),
];

const updateOtherExpenseValidation = [
  body('expensesName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Expenses name cannot exceed 100 characters'),
  body('amount')
    .optional()
    .isFloat({ min: 0, max: 10000000 })
    .withMessage('Amount must be a valid number between 0 and 10,000,000'),
  body('others')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Others field cannot exceed 500 characters'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes cannot exceed 1000 characters'),
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO date'),
];

module.exports = {
  createOtherExpense,
  getOtherExpenses,
  getOtherExpense,
  updateOtherExpense,
  deleteOtherExpense,
  getOtherExpensesSummary,
  createOtherExpenseValidation,
  updateOtherExpenseValidation,
};
