const express = require('express');
const router = express.Router();
const {
  createTruckEntry,
  getAllTruckEntries,
  getTruckEntry,
  updateTruckEntry,
  deleteTruckEntry,
  getTruckEntriesSummary,
  createTruckEntryValidation,
  updateTruckEntryValidation,
} = require('../controllers/truckEntryController');
const { handleImageUpload } = require('../middleware/uploadImage');

// All routes are protected by auth middleware (applied in server.js)

// Get summary first (before :id route)
router.get('/summary', getTruckEntriesSummary);

// CRUD operations
router.post(
  '/',
  handleImageUpload, // Handle multipart form data first
  createTruckEntryValidation, // Then validate
  createTruckEntry,
);
router.get('/', getAllTruckEntries);
router.get('/:id', getTruckEntry);
router.put(
  '/:id',
  handleImageUpload, // Handle multipart form data first
  updateTruckEntryValidation, // Then validate
  updateTruckEntry,
);
router.delete('/:id', deleteTruckEntry);

module.exports = router;
