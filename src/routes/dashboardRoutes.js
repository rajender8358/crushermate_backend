const express = require('express');
const router = express.Router();
const {
  getDashboardSummary,
  getFinancialMetrics,
  getDashboardStats,
} = require('../controllers/dashboardController');
const { requireOwnerRole } = require('../middleware/auth');

// All routes are protected by auth middleware (applied in server.js)

// General dashboard routes (accessible by all authenticated users)
router.get('/summary', getDashboardSummary);
router.get('/financial', getFinancialMetrics);

// Owner-only routes
router.get('/stats', requireOwnerRole, getDashboardStats);

module.exports = router;
