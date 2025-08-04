const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  createOtherExpense,
  getOtherExpenses,
  getOtherExpense,
  updateOtherExpense,
  deleteOtherExpense,
  getOtherExpensesSummary,
  createOtherExpenseValidation,
  updateOtherExpenseValidation,
} = require('../controllers/otherExpenseController');

// All routes require authentication
router.use(authenticateToken);

// Create other expense
router.post('/', createOtherExpenseValidation, createOtherExpense);

// Get all other expenses
router.get('/', getOtherExpenses);

// Get other expense summary for dashboard
router.get('/summary', getOtherExpensesSummary);

// Get specific other expense
router.get('/:id', getOtherExpense);

// Update other expense
router.put('/:id', updateOtherExpenseValidation, updateOtherExpense);

// Delete other expense
router.delete('/:id', deleteOtherExpense);

module.exports = router; 