const errorHandler = (err, req, res, next) => {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
  });

  // Default error
  let error = {
    success: false,
    message: err.message || 'Internal Server Error',
    error: 'INTERNAL_ERROR',
  };

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(error => error.message);
    error = {
      success: false,
      message: 'Validation Error',
      errors: messages,
      error: 'VALIDATION_ERROR',
    };
    return res.status(400).json(error);
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    error = {
      success: false,
      message: `${field} '${value}' already exists`,
      error: 'DUPLICATE_ERROR',
    };
    return res.status(400).json(error);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error = {
      success: false,
      message: 'Invalid ID format',
      error: 'INVALID_ID',
    };
    return res.status(400).json(error);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      success: false,
      message: 'Invalid token',
      error: 'INVALID_TOKEN',
    };
    return res.status(401).json(error);
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      success: false,
      message: 'Token expired',
      error: 'TOKEN_EXPIRED',
    };
    return res.status(401).json(error);
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      success: false,
      message: 'File size too large',
      error: 'FILE_TOO_LARGE',
    };
    return res.status(400).json(error);
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error = {
      success: false,
      message: 'Too many files uploaded',
      error: 'TOO_MANY_FILES',
    };
    return res.status(400).json(error);
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = {
      success: false,
      message: 'Unexpected file field',
      error: 'UNEXPECTED_FILE',
    };
    return res.status(400).json(error);
  }

  // Custom application errors
  if (err.statusCode) {
    error = {
      success: false,
      message: err.message,
      error: err.error || 'APPLICATION_ERROR',
    };
    return res.status(err.statusCode).json(error);
  }

  // MongoDB connection errors
  if (
    err.name === 'MongoNetworkError' ||
    err.name === 'MongooseServerSelectionError'
  ) {
    error = {
      success: false,
      message: 'Database connection error',
      error: 'DATABASE_ERROR',
    };
    return res.status(503).json(error);
  }

  // Rate limiting errors
  if (err.status === 429) {
    error = {
      success: false,
      message: 'Too many requests, please try again later',
      error: 'RATE_LIMIT_EXCEEDED',
    };
    return res.status(429).json(error);
  }

  // Development vs Production error responses
  if (process.env.NODE_ENV === 'development') {
    error.stack = err.stack;
    error.details = {
      name: err.name,
      code: err.code,
      statusCode: err.statusCode,
    };
  }

  // Default to 500 server error
  res.status(500).json(error);
};

// Not found middleware
const notFound = (req, res, next) => {
  const error = new Error(`Not found - ${req.originalUrl}`);
  error.statusCode = 404;
  error.error = 'NOT_FOUND';
  next(error);
};

// Async error wrapper
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, error = 'APPLICATION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.error = error;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
  AppError,
};
