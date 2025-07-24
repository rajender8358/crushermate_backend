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
    console.log('✅ MongoDB connected for seeding');
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
      console.log(`👤 Admin user already exists: ${adminEmail}`);
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

    console.log(`✅ Organization created: ${organization.name}`);

    // Update admin user with organization
    adminUser.organization = organization._id;
    await adminUser.save();

    console.log(`✅ Admin user created: ${adminEmail}`);
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
        materialType: 'Blue Metal',
        currentRate: 24000,
        notes: 'Market rate for Blue Metal per unit',
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
      console.log(
        `📊 Sample truck entries already exist: ${existingEntries} entries`,
      );
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
        notes: 'Sample sales entry',
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
        materialType: 'Blue Metal',
        units: 12,
        ratePerUnit: 24000,
        entryTime: '16:20',
        entryDate: new Date(), // Today
        notes: 'Sample Blue Metal sales',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA05IJ7890',
        entryType: 'Raw Stone',
        materialType: null,
        units: 20,
        ratePerUnit: 17000,
        entryTime: '08:00',
        entryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        notes: 'Sample raw material purchase',
      },
    ];

    await TruckEntry.insertMany(sampleEntries);
    console.log(`✅ Created ${sampleEntries.length} sample truck entries`);
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
      console.log(`👤 Test user already exists: ${testEmail}`);
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

    console.log(`✅ Test user created: ${testEmail}`);
    return testUser;
  } catch (error) {
    console.error('❌ Error creating test user:', error.message);
    throw error;
  }
};

// Main seeding function
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    await connectDB();

    // Seed admin user and organization
    const adminUser = await seedOrganizationAndAdmin();

    // Seed test user
    const testUser = await seedTestUser(adminUser);

    // Seed material rates
    await seedMaterialRates(adminUser);

    // Seed sample truck entries
    await seedSampleTruckEntries(adminUser);

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`👤 Admin User: ${adminUser.email} (role: ${adminUser.role})`);
    console.log(`👤 Test User: ${testUser.email} (role: ${testUser.role})`);

    const materialRates = await MaterialRate.find({ isActive: true });
    console.log(`💰 Material Rates: ${materialRates.length} rates configured`);

    const truckEntries = await TruckEntry.countDocuments({ status: 'active' });
    console.log(`🚛 Truck Entries: ${truckEntries} sample entries`);

    console.log('\n🔐 Login Credentials:');
    console.log(
      `Owner: ${adminUser.email} / ${process.env.ADMIN_PASSWORD || 'Test@123'}`,
    );
    console.log(`User: ${testUser.email} / test123`);
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
    console.log('🗑️  Clearing database...');

    await connectDB();

    await Promise.all([
      User.deleteMany({}),
      MaterialRate.deleteMany({}),
      TruckEntry.deleteMany({}),
      Organization.deleteMany({}),
    ]);

    console.log('✅ Database cleared successfully');
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
    console.log('Usage: node seedData.js [seed|clear|reset]');
    console.log('  seed  - Populate database with initial data');
    console.log('  clear - Remove all data from database');
    console.log('  reset - Clear and then seed database');
    process.exit(1);
}

module.exports = {
  seedDatabase,
  clearDatabase,
  seedOrganizationAndAdmin,
  seedMaterialRates,
  seedSampleTruckEntries,
};
