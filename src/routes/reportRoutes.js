const express = require('express');
const router = express.Router();
const {
  getReportData,
  generateExportData,
  getReportTemplates,
} = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

// Apply auth middleware individually to secure routes
router.get('/templates', authenticateToken, getReportTemplates);
router.get('/data', authenticateToken, getReportData);
router.post('/export', generateExportData); // Remove auth for PDF download
router.get('/export', generateExportData); // GET route for browser download

module.exports = router;
