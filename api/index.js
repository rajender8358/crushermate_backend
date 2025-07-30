const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
require('dotenv').config();

// Import middleware and routes
const connectDB = require('../src/config/database');
const { errorHandler } = require('../src/middleware/errorHandler');
const { authenticateToken } = require('../src/middleware/auth');

// Import routes
const authRoutes = require('../src/routes/authRoutes');
const userRoutes = require('../src/routes/userRoutes');
const truckEntryRoutes = require('../src/routes/truckEntryRoutes');
const materialRateRoutes = require('../src/routes/materialRateRoutes');
const organizationRoutes = require('../src/routes/organizationRoutes');
const dashboardRoutes = require('../src/routes/dashboardRoutes');
const configRoutes = require('../src/routes/configRoutes');
const reportRoutes = require('../src/routes/reportRoutes');

const app = express();

// Connect to MongoDB with better error handling
const initializeServer = async () => {
  try {
    console.log('🚀 Starting server initialization...');
    await connectDB();
    console.log('✅ Server initialization complete');
  } catch (error) {
    console.error('❌ Server initialization failed:', error.message);
    console.error('🔍 Full error:', error);
  }
};

// Initialize server but don't block startup
setTimeout(() => {
  initializeServer().catch(error => {
    console.error('❌ Server initialization error:', error);
  });
}, 100);

// Security middleware
app.use(helmet());

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use(limiter);

// CORS configuration for production
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['*'], // Allow all origins for production
    credentials: process.env.CORS_CREDENTIALS === 'true' || true,
  }),
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CrusherMate API Server is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    database:
      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Simple health check without database dependency
app.get('/ping', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Pong! Server is responding',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authenticateToken, userRoutes);
app.use('/api/truck-entries', authenticateToken, truckEntryRoutes);
app.use('/api/material-rates', authenticateToken, materialRateRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/config', authenticateToken, configRoutes);
app.use('/api/reports', authenticateToken, reportRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus =
      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const uptime = process.uptime();

    res.json({
      success: true,
      message: 'Server is healthy',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor(
          (uptime % 3600) / 60,
        )}m ${Math.floor(uptime % 60)}s`,
        database: {
          status: dbStatus,
          name: mongoose.connection.name || 'unknown',
          host: mongoose.connection.host || 'unknown',
        },
        environment: process.env.NODE_ENV || 'production',
        version: '1.0.0',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message,
    });
  }
});

// Database connectivity test endpoint
app.get('/api/health/db', async (req, res) => {
  try {
    // Test database connection with timeout
    const testQuery = Promise.race([
      mongoose.connection.db.admin().ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database ping timeout')), 5000),
      ),
    ]);

    await testQuery;

    res.json({
      success: true,
      message: 'Database connection is healthy',
      data: {
        status: 'connected',
        timestamp: new Date().toISOString(),
        database: mongoose.connection.name,
        host: mongoose.connection.host,
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
      data: {
        status: 'disconnected',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Export for Vercel serverless
module.exports = app;
