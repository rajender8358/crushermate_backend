const express = require('express');
const router = express.Router();
const {
  getReportData,
  generateExportData,
  getReportTemplates,
} = require('../controllers/reportController');

// All routes are protected by auth middleware (applied in server.js)

// Report routes
router.get('/templates', getReportTemplates);
router.get('/data', getReportData);
router.post('/export', generateExportData);

module.exports = router;
