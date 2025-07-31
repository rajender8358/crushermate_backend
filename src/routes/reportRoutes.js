const express = require('express');
const router = express.Router();
const {
  getReportData,
  generateExportData,
  getReportTemplates,
  generateBrowserDownload,
  downloadWithToken,
  testDatabaseData,
} = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

// Apply auth middleware individually to secure routes
router.get('/templates', authenticateToken, getReportTemplates);
router.get('/data', authenticateToken, getReportData);
router.post('/export', authenticateToken, generateExportData); // Add auth for PDF download
router.get('/export', authenticateToken, generateExportData); // Add auth for GET route

// Browser download routes
router.post('/browser-download', authenticateToken, generateBrowserDownload);
router.get('/download/:token', downloadWithToken); // Public route for browser downloads

// Test route for debugging (no auth required)
router.get('/test-data', testDatabaseData);

module.exports = router;
