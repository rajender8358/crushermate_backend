const express = require('express');
const router = express.Router();
const {
  getMaterialRates,
  updateRate,
} = require('../controllers/materialRateController');
const { requireOwnerRole } = require('../middleware/auth');

// All routes are protected by auth middleware (applied in server.js)

// Public rates routes (accessible by all authenticated users)
router.get('/', getMaterialRates);

// Owner-only routes
router.post('/', requireOwnerRole, updateRate);

module.exports = router;
