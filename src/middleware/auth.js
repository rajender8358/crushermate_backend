const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT secret key
const JWT_SECRET =
  process.env.JWT_SECRET ||
  'crushermate_super_secret_key_2024_change_in_production';

// Generate JWT token
const generateToken = (userId, email, role) => {
  return jwt.sign({ userId, email, role }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: 'crushermate-api',
    audience: 'crushermate-app',
  });
};

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required',
        error: 'MISSING_TOKEN',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if user still exists and is active
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated',
        error: 'ACCOUNT_DEACTIVATED',
      });
    }

    // Add user info to request
    req.user = {
      id: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      mobileNumber: user.mobileNumber,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token',
        error: 'INVALID_TOKEN',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired',
        error: 'TOKEN_EXPIRED',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: 'AUTH_ERROR',
    });
  }
};

// Owner role authorization middleware
const requireOwnerRole = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'NOT_AUTHENTICATED',
    });
  }

  if (req.user.role !== 'owner') {
    return res.status(403).json({
      success: false,
      message: 'Owner access required',
      error: 'INSUFFICIENT_PERMISSIONS',
    });
  }

  next();
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
          email: user.email,
          username: user.username,
          role: user.role,
          mobileNumber: user.mobileNumber,
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
