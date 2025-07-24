const express = require('express');
const router = express.Router();
const {
  register,
  login,
  verifyToken,
  logout,
  getProfile,
} = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.get('/verify-token', authenticateToken, verifyToken);
router.post('/logout', authenticateToken, logout);
router.get('/profile', authenticateToken, getProfile);

module.exports = router;
