const express = require('express');
const router = express.Router();
const {
  getRates,
  updateRate,
} = require('../controllers/materialRateController');
const { requireOwnerRole } = require('../middleware/auth');

// All routes are protected by auth middleware
router.get('/', getRates);
router.post('/', requireOwnerRole, updateRate);

module.exports = router;
