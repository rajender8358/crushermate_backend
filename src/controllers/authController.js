const { asyncHandler, AppError } = require('../middleware/errorHandler');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { generateToken } = require('../middleware/auth');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const { username, password, organizationId, role = 'user' } = req.body;

  if (!username || !password || !organizationId) {
    throw new AppError(
      'Username, password, and organization are required',
      400,
      'VALIDATION_ERROR',
    );
  }

  const organization = await Organization.findById(organizationId);
  if (!organization) {
    throw new AppError('Invalid organization', 400, 'VALIDATION_ERROR');
  }

  const existingUser = await User.findOne({ username: username.toLowerCase() });
  if (existingUser) {
    throw new AppError('Username already exists', 400, 'USER_EXISTS');
  }

  const user = await User.create({
    username: username.toLowerCase(),
    password,
    organization: organizationId,
    role: role,
  });

  const token = generateToken(
    user._id,
    user.username,
    user.role,
    user.organization,
  );

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        organization: user.organization,
      },
      token,
    },
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new AppError(
      'Username and password are required',
      401,
      'INVALID_CREDENTIALS',
    );
  }

  const user = await User.findOne({ username: username.toLowerCase() })
    .populate('organization')
    .select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError(
      'Invalid username or password',
      401,
      'INVALID_CREDENTIALS',
    );
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
  }

  const token = generateToken(
    user._id,
    user.username,
    user.role,
    user.organization._id,
  );

  await user.updateLastLogin();

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        organization: user.organization,
        lastLogin: user.lastLogin,
      },
      token,
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
        username: user.username,
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
    `User ${req.user.username} logged out at ${new Date().toISOString()}`,
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
        username: user.username,
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
};
