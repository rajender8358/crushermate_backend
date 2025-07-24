const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

// JWT secret key
const JWT_SECRET =
  process.env.JWT_SECRET ||
  'crushermate_super_secret_key_2024_change_in_production';

// Generate JWT token
const generateToken = (userId, username, role, organizationId) => {
  const payload = {
    user: {
      id: userId,
      username,
      role,
      organizationId,
    },
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

// Verify JWT token middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError(
        'Authentication token is missing or invalid',
        401,
        'AUTH_TOKEN_MISSING',
      ),
    );
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user; // Attach user payload to the request
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('Token has expired', 401, 'TOKEN_EXPIRED'));
    }
    return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
  }
};

const requireOwnerRole = (req, res, next) => {
  if (req.user && req.user.role === 'owner') {
    return next();
  }
  return next(
    new AppError(
      'This action requires owner privileges.',
      403,
      'ACCESS_DENIED',
    ),
  );
};

// User role authorization middleware (owner or user)
const requireUserRole = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'NOT_AUTHENTICATED',
    });
  }

  if (!['owner', 'user'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'User access required',
      error: 'INSUFFICIENT_PERMISSIONS',
    });
  }

  next();
};

// Check if user can access resource (own data or owner)
const requireSelfOrOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'NOT_AUTHENTICATED',
    });
  }

  const targetUserId = req.params.userId || req.params.id;
  const isOwner = req.user.role === 'owner';
  const isSelf = req.user.id.toString() === targetUserId;

  if (!isOwner && !isSelf) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only access your own data.',
      error: 'ACCESS_DENIED',
    });
  }

  next();
};

// Verify token without requiring authentication (for optional auth)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : null;

    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');

      if (user && user.isActive) {
        req.user = {
          id: user._id,
          username: user.username,
          role: user.role,
        };
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

module.exports = {
  generateToken,
  authenticateToken,
  requireOwnerRole,
  requireUserRole,
  requireSelfOrOwner,
  optionalAuth,
};
