const Organization = require('../models/Organization');

exports.getAllOrganizations = async (req, res, next) => {
  try {
    const organizations = await Organization.find().select('name _id');

    res.json({
      success: true,
      message: 'Organizations retrieved successfully',
      data: organizations,
    });
  } catch (error) {
    console.error('❌ Error fetching organizations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organizations',
      error: error.message,
    });
  }
};

exports.createOrganization = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Organization name is required',
      });
    }

    const newOrganization = new Organization({ name });
    await newOrganization.save();

    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: newOrganization,
    });
  } catch (error) {
    console.error('❌ Error creating organization:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create organization',
      error: error.message,
    });
  }
};
