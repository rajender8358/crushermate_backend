const express = require('express');
const router = express.Router();
const {
  downloadWithToken,
  generatePublicDownload,
  testDatabaseData,
} = require('../controllers/reportController');

// Public download generation (no authentication required)
router.post('/generate', generatePublicDownload);

// Public download route (no authentication required)
router.get('/:token', downloadWithToken);

// Test route for debugging (no auth required)
router.get('/test-data', testDatabaseData);

module.exports = router;
