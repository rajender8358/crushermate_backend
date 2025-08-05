const mongoose = require('mongoose');
const MaterialRate = require('../models/MaterialRate');
require('dotenv').config();

const defaultRates = [
  { materialType: '1 1/2 Metal', currentRate: 1200 },
  { materialType: '3/4 Jalli', currentRate: 1100 },
  { materialType: '1/2 Jalli', currentRate: 1000 },
  { materialType: '1/4 Kuranai', currentRate: 900 },
  { materialType: 'Dust', currentRate: 800 },
  { materialType: 'Wetmix', currentRate: 1300 },
  { materialType: 'M sand', currentRate: 1400 },
  { materialType: 'P sand', currentRate: 1500 },
  { materialType: 'Raw Stone', currentRate: 600 },
];

async function migrateMaterialRates() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Clear all existing material rates
    console.log('Clearing existing material rates...');
    await MaterialRate.deleteMany({});
    console.log('All existing material rates cleared');

    // Create new global material rates
    console.log('Creating new global material rates...');
    const createdRates = await MaterialRate.insertMany(defaultRates);
    console.log(`Created ${createdRates.length} material rates:`);

    createdRates.forEach(rate => {
      console.log(`- ${rate.materialType}: ₹${rate.currentRate}`);
    });

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateMaterialRates();
}

module.exports = { migrateMaterialRates }; 