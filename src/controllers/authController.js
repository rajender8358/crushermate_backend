const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { body, validationResult } = require('express-validator');

// Validation rules
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('username')
    .isLength({ min: 3, max: 30 })
    .trim()
    .withMessage('Username must be between 3-30 characters'),
  body('mobileNumber')
    .matches(/^[0-9]{10}$/)
    .withMessage('Please provide a valid 10-digit mobile number'),
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
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

  const { email, password, username, mobileNumber, role = 'user' } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [{ email: email.toLowerCase() }, { username: username }],
  });

  if (existingUser) {
    throw new AppError(
      existingUser.email === email.toLowerCase()
        ? 'Email already registered'
        : 'Username already taken',
      400,
      'USER_EXISTS',
    );
  }

  // Create user
  const user = await User.create({
    email: email.toLowerCase(),
    password,
    username,
    mobileNumber,
    role: role === 'owner' ? 'owner' : 'user', // Only allow owner if explicitly set
  });

  // Generate token
  const token = generateToken(user._id, user.email, user.role);

  // Update last login
  await user.updateLastLogin();

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        mobileNumber: user.mobileNumber,
        role: user.role,
      },
      token,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    },
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
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

  const { email, password } = req.body;

  // Find user and include password for comparison
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+password',
  );

  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
  }

  // Check password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  // Generate token
  const token = generateToken(user._id, user.email, user.role);

  // Update last login
  await user.updateLastLogin();

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        mobileNumber: user.mobileNumber,
        role: user.role,
        lastLogin: user.lastLogin,
      },
      token,
      expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
    },
  });
});

// @desc    Verify JWT token
// @route   GET /api/auth/verify-token
// @access  Private
const verifyToken = asyncHandler(async (req, res) => {
  // User info is already available from auth middleware
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        mobileNumber: user.mobileNumber,
        role: user.role,
        lastLogin: user.lastLogin,
        isActive: user.isActive,
      },
    },
  });
});

// @desc    Logout user (client-side token removal)
// @route   POST /api/auth/logout
// @access  Private
const logout = asyncHandler(async (req, res) => {
  // In a stateless JWT system, logout is mainly handled client-side
  // by removing the token. We can log this event.

  console.log(
    `User ${req.user.email} logged out at ${new Date().toISOString()}`,
  );

  res.json({
    success: true,
    message: 'Logout successful. Please remove the token from client storage.',
    data: null,
  });
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    throw new AppError('User not found', 404, 'USER_NOT_FOUND');
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        mobileNumber: user.mobileNumber,
        role: user.role,
        lastLogin: user.lastLogin,
        profileImage: user.profileImage,
        createdAt: user.createdAt,
        isActive: user.isActive,
      },
    },
  });
});

module.exports = {
  register,
  login,
  verifyToken,
  logout,
  getProfile,
  registerValidation,
  loginValidation,
};
