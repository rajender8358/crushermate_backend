const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { body, validationResult } = require('express-validator');
const { requireOwnerRole } = require('../middleware/auth');

// Validation rules
const updateProfileValidation = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .trim()
    .withMessage('Username must be between 3-30 characters'),
  body('mobileNumber')
    .optional()
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit mobile number'),
];

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json({
    success: true,
    data: {
      user,
    },
  });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = asyncHandler(async (req, res) => {
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

  const { username, mobileNumber } = req.body;

  const user = await User.findById(req.user.id);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Check if username is already taken by another user
  if (username && username !== user.username) {
    const existingUser = await User.findOne({
      username,
      _id: { $ne: req.user.id },
    });

    if (existingUser) {
      throw new AppError('Username already taken', 400, 'USERNAME_EXISTS');
    }
  }

  // Update fields
  if (username) user.username = username;
  if (mobileNumber) user.mobileNumber = mobileNumber;

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user,
    },
  });
});

// @desc    Get all users (Owner only)
// @route   GET /api/users
// @access  Private (Owner only)
const getAllUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search, role } = req.query;

  // Build filter
  const filter = {};

  if (search) {
    filter.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  if (role) {
    filter.role = role;
  }

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Execute query
  const [users, total] = await Promise.all([
    User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments(filter),
  ]);

  // Calculate pagination info
  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalUsers: total,
        usersPerPage: parseInt(limit),
      },
    },
  });
});

// @desc    Get user by ID (Owner only)
// @route   GET /api/users/:id
// @access  Private (Owner only)
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).select('-password');

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json({
    success: true,
    data: {
      user,
    },
  });
});

// @desc    Update user status (Owner only)
// @route   PUT /api/users/:id/status
// @access  Private (Owner only)
const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const user = await User.findById(id);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Prevent owner from deactivating themselves
  if (id === req.user.id && isActive === false) {
    throw new AppError(
      'You cannot deactivate your own account',
      400,
      'INVALID_OPERATION',
    );
  }

  user.isActive = isActive;
  await user.save();

  res.json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        isActive: user.isActive,
      },
    },
  });
});

// @desc    Delete user (Owner only)
// @route   DELETE /api/users/:id
// @access  Private (Owner only)
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  // Prevent owner from deleting themselves
  if (id === req.user.id) {
    throw new AppError(
      'You cannot delete your own account',
      400,
      'INVALID_OPERATION',
    );
  }

  await User.findByIdAndDelete(id);

  res.json({
    success: true,
    message: 'User deleted successfully',
    data: null,
  });
});

// Routes
router.get('/profile', getProfile);
router.put('/profile', updateProfileValidation, updateProfile);

// Owner-only routes
router.get('/', requireOwnerRole, getAllUsers);
router.get('/:id', requireOwnerRole, getUserById);
router.put('/:id/status', requireOwnerRole, updateUserStatus);
router.delete('/:id', requireOwnerRole, deleteUser);

module.exports = router;
