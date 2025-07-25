const express = require('express');
const router = express.Router();
const organizationController = require('../controllers/organizationController');

router.get('/', organizationController.getAllOrganizations);
router.post('/', organizationController.createOrganization);

module.exports = router;
