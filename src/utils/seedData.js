// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const MaterialRate = require('../models/MaterialRate');
const TruckEntry = require('../models/TruckEntry');
const Organization = require('../models/Organization');

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/crushermate';
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

// Seed organization and admin user
const seedOrganizationAndAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'raj@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Test@123';
    const adminUsername = process.env.ADMIN_USERNAME || 'raj';

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      return existingAdmin;
    }

    // Create admin user first (without organization)
    const adminUser = await User.create({
      email: adminEmail,
      password: adminPassword,
      username: adminUsername,
      mobileNumber: '9876543210',
      role: 'owner',
    });

    // Create organization with owner
    const organization = await Organization.create({
      name: 'CrusherMate Operations',
      owner: adminUser._id,
      members: [adminUser._id],
    });

    // Update admin user with organization
    adminUser.organization = organization._id;
    await adminUser.save();

    return adminUser;
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    throw error;
  }
};

// Seed material rates
const seedMaterialRates = async adminUser => {
  try {
    const defaultRates = [
      {
        materialType: 'M-Sand',
        currentRate: 22000,
        notes: 'Market rate for M-Sand per unit',
      },
      {
        materialType: 'P-Sand',
        currentRate: 20000,
        notes: 'Market rate for P-Sand per unit',
      },
      {
        materialType: 'Blue Metal 0.5in',
        currentRate: 24000,
        notes: 'Market rate for Blue Metal 0.5in per unit',
      },
      {
        materialType: 'Blue Metal 0.75in',
        currentRate: 25000,
        notes: 'Market rate for Blue Metal 0.75in per unit',
      },
      {
        materialType: 'Jally',
        currentRate: 18000,
        notes: 'Market rate for Jally per unit',
      },
      {
        materialType: 'Kurunai',
        currentRate: 16000,
        notes: 'Market rate for Kurunai per unit',
      },
      {
        materialType: 'Mixed',
        currentRate: 20000,
        notes: 'Market rate for Mixed materials per unit',
      },
    ];

    for (const rate of defaultRates) {
      const existingRate = await MaterialRate.findOne({
        materialType: rate.materialType,
        organization: adminUser.organization,
      });

      if (!existingRate) {
        await MaterialRate.create({
          ...rate,
          organization: adminUser.organization,
          updatedBy: adminUser._id,
          effectiveDate: new Date(),
        });
        console.log(
          `✅ Created rate for ${rate.materialType}: ₹${rate.currentRate}`,
        );
      } else {
        console.log(
          `📝 Rate already exists for ${rate.materialType}: ₹${existingRate.currentRate}`,
        );
      }
    }
  } catch (error) {
    console.error('❌ Error seeding material rates:', error.message);
    throw error;
  }
};

// Seed sample truck entries
const seedSampleTruckEntries = async adminUser => {
  try {
    const existingEntries = await TruckEntry.countDocuments({
      status: 'active',
    });

    if (existingEntries > 0) {
      return;
    }

    const sampleEntries = [
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA01AB1234',
        entryType: 'Sales',
        materialType: 'M-Sand',
        units: 10,
        ratePerUnit: 22000,
        entryTime: '09:30',
        entryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
        notes: 'Sample M-Sand sales entry',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA02CD5678',
        entryType: 'Raw Stone',
        materialType: null,
        units: 15,
        ratePerUnit: 18000,
        entryTime: '14:15',
        entryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
        notes: 'Sample raw stone entry',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA03EF9012',
        entryType: 'Sales',
        materialType: 'P-Sand',
        units: 8,
        ratePerUnit: 20000,
        entryTime: '11:45',
        entryDate: new Date(), // Today
        notes: 'Sample P-Sand sales',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA04GH3456',
        entryType: 'Sales',
        materialType: 'Blue Metal 0.5in',
        units: 12,
        ratePerUnit: 24000,
        entryTime: '16:20',
        entryDate: new Date(), // Today
        notes: 'Sample Blue Metal 0.5in sales',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA05IJ7890',
        entryType: 'Sales',
        materialType: 'Blue Metal 0.75in',
        units: 6,
        ratePerUnit: 25000,
        entryTime: '10:30',
        entryDate: new Date(), // Today
        notes: 'Sample Blue Metal 0.75in sales',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA06KL2345',
        entryType: 'Sales',
        materialType: 'Jally',
        units: 15,
        ratePerUnit: 18000,
        entryTime: '13:45',
        entryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        notes: 'Sample Jally sales',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA07MN6789',
        entryType: 'Sales',
        materialType: 'Kurunai',
        units: 20,
        ratePerUnit: 16000,
        entryTime: '15:20',
        entryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        notes: 'Sample Kurunai sales',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA08OP0123',
        entryType: 'Sales',
        materialType: 'Mixed',
        units: 10,
        ratePerUnit: 20000,
        entryTime: '12:00',
        entryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        notes: 'Sample Mixed materials sales',
      },
    ];

    await TruckEntry.insertMany(sampleEntries);
  } catch (error) {
    console.error('❌ Error seeding sample truck entries:', error.message);
    throw error;
  }
};

// Create a test user
const seedTestUser = async adminUser => {
  try {
    const testEmail = 'test@example.com';

    const existingUser = await User.findOne({ email: testEmail });

    if (existingUser) {
      return existingUser;
    }

    const testUser = await User.create({
      email: testEmail,
      password: 'test123',
      username: 'testuser',
      mobileNumber: '9123456789',
      role: 'user',
      organization: adminUser.organization,
    });

    return testUser;
  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    throw error;
  }
};

// Main seeding function
const seedDatabase = async () => {
  try {
    await connectDB();

    // Seed admin user and organization
    const adminUser = await seedOrganizationAndAdmin();

    // Seed test user
    const testUser = await seedTestUser(adminUser);

    // Seed material rates
    await seedMaterialRates(adminUser);

    // Seed sample truck entries
    await seedSampleTruckEntries(adminUser);
  } catch (error) {
    console.error('❌ Database seeding failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
  }
};

// Clear all data (for testing)
const clearDatabase = async () => {
  try {
    await connectDB();

    await Promise.all([
      User.deleteMany({}),
      MaterialRate.deleteMany({}),
      TruckEntry.deleteMany({}),
      Organization.deleteMany({}),
    ]);
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
  }
};

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'seed':
    seedDatabase();
    break;
  case 'clear':
    clearDatabase();
    break;
  case 'reset':
    clearDatabase().then(() => seedDatabase());
    break;
  default:
    process.exit(1);
}

module.exports = {
  seedDatabase,
  clearDatabase,
  seedOrganizationAndAdmin,
  seedMaterialRates,
  seedSampleTruckEntries,
};
