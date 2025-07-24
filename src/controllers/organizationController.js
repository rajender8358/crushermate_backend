const Organization = require('../models/Organization');

exports.getAllOrganizations = async (req, res, next) => {
  try {
    const organizations = await Organization.find().select('name');
    res.json(organizations);
  } catch (error) {
    next(error);
  }
};

exports.createOrganization = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Organization name is required' });
    }
    const newOrganization = new Organization({ name });
    await newOrganization.save();
    res.status(201).json(newOrganization);
  } catch (error) {
    next(error);
  }
};
