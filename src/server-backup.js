const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
require('dotenv').config();

// Force deployment with updated environment variables
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const truckEntryRoutes = require('./routes/truckEntryRoutes');
const materialRateRoutes = require('./routes/materialRateRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const configRoutes = require('./routes/configRoutes');
const reportRoutes = require('./routes/reportRoutes');

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
    // Don't exit in serverless environment - just log the error
  }
};

// Initialize server but don't block startup
initializeServer().catch(error => {
  console.error('❌ Server initialization error:', error);
});

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

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'], // Allow all origins for testing
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

// Test MongoDB connection endpoint
app.get('/test-db', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      res.status(200).json({
        success: true,
        message: 'MongoDB connection successful',
        database: mongoose.connection.name,
        state: mongoose.connection.readyState,
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'MongoDB connection failed',
        state: mongoose.connection.readyState,
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Database test failed',
      error: error.message,
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/truck-entries', truckEntryRoutes);
app.use('/api/material-rates', materialRateRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/config', configRoutes);
app.use('/api/reports', reportRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

const PORT = process.env.PORT || 3000;

// For Vercel serverless functions
if (process.env.NODE_ENV === 'production') {
  // Export for Vercel
  module.exports = app;
} else {
  // Start server for local development
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CrusherMate API Server Started!`);
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
  });
}
