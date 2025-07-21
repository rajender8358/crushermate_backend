const express = require('express');
const router = express.Router();
const {
  getCurrentRates,
  updateMaterialRate,
  getRateHistory,
  getMaterialRate,
  bulkUpdateRates,
  getRateStatistics,
  updateRateValidation,
} = require('../controllers/materialRateController');
const { requireOwnerRole } = require('../middleware/auth');

// All routes are protected by auth middleware (applied in server.js)

// Public rates routes (accessible by all authenticated users)
router.get('/', getCurrentRates);
router.get('/:materialType', getMaterialRate);
router.get('/history/:materialType', getRateHistory);

// Owner-only routes
router.post('/', requireOwnerRole, updateRateValidation, updateMaterialRate);
router.put('/bulk', requireOwnerRole, bulkUpdateRates);
router.get('/admin/stats', requireOwnerRole, getRateStatistics);

module.exports = router;
