const express = require('express');
const router = express.Router();
const {
  getAppConfig,
  calculateTotal,
  getCurrentRates,
  validateTruckEntry,
} = require('../controllers/configController');

// All routes are protected by auth middleware (applied in server.js)

// Configuration routes
router.get('/app', getAppConfig);
router.get('/rates', getCurrentRates);
router.post('/calculate', calculateTotal);
router.post('/validate', validateTruckEntry);

module.exports = router;
