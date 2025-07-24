const express = require('express');
const router = express.Router();
const {
  getReportData,
  generateExportData,
  getReportTemplates,
  downloadExportedFile,
} = require('../controllers/reportController');
const { authenticateToken } = require('../middleware/auth');

// Apply auth middleware individually to secure routes
router.get('/templates', authenticateToken, getReportTemplates);
router.get('/data', authenticateToken, getReportData);
router.post('/export', authenticateToken, generateExportData);

// This route is public but secured by a one-time token
router.get('/download/:fileId', downloadExportedFile);

module.exports = router;
