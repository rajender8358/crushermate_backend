const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Simple health check
app.get('/ping', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Pong! Minimal server is working',
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Minimal server is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

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
    console.log(`🚀 Minimal Server Started!`);
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🏥 Health: http://localhost:${PORT}/health`);
  });
}
