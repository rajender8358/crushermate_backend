// Load environment variables
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const MaterialRate = require('../models/MaterialRate');
const TruckEntry = require('../models/TruckEntry');
const Organization = require('../models/Organization');
const OtherExpense = require('../models/OtherExpense');

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
        materialType: '1 1/2 Metal',
        currentRate: 28000,
        notes: 'Market rate for 1 1/2 Metal per unit',
      },
      {
        materialType: '3/4 Jalli',
        currentRate: 22000,
        notes: 'Market rate for 3/4 Jalli per unit',
      },
      {
        materialType: '1/2 Jalli',
        currentRate: 20000,
        notes: 'Market rate for 1/2 Jalli per unit',
      },
      {
        materialType: '1/4 Kuranai',
        currentRate: 18000,
        notes: 'Market rate for 1/4 Kuranai per unit',
      },
      {
        materialType: 'Dust',
        currentRate: 15000,
        notes: 'Market rate for Dust per unit',
      },
      {
        materialType: 'Wetmix',
        currentRate: 25000,
        notes: 'Market rate for Wetmix per unit',
      },
      {
        materialType: 'M sand',
        currentRate: 22000,
        notes: 'Market rate for M sand per unit',
      },
      {
        materialType: 'P sand',
        currentRate: 20000,
        notes: 'Market rate for P sand per unit',
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
        truckName: 'Ramesh Kumar',
        entryType: 'Sales',
        materialType: 'M sand',
        units: 10,
        ratePerUnit: 22000,
        entryTime: '09:30',
        entryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
        notes: 'Sample M sand sales entry',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA02CD5678',
        truckName: 'Suresh Patel',
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
        truckName: 'Mohan Singh',
        entryType: 'Sales',
        materialType: 'P sand',
        units: 8,
        ratePerUnit: 20000,
        entryTime: '11:45',
        entryDate: new Date(), // Today
        notes: 'Sample P sand sales',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA04GH3456',
        truckName: 'Rajesh Kumar',
        entryType: 'Sales',
        materialType: '1 1/2 Metal',
        units: 12,
        ratePerUnit: 24000,
        entryTime: '16:20',
        entryDate: new Date(), // Today
        notes: 'Sample 1 1/2 Metal sales',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA05IJ7890',
        truckName: 'Amit Sharma',
        entryType: 'Sales',
        materialType: '3/4 Jalli',
        units: 6,
        ratePerUnit: 25000,
        entryTime: '10:30',
        entryDate: new Date(), // Today
        notes: 'Sample 3/4 Jalli sales',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA06KL2345',
        truckName: 'Vikram Singh',
        entryType: 'Sales',
        materialType: '1/2 Jalli',
        units: 15,
        ratePerUnit: 18000,
        entryTime: '13:45',
        entryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        notes: 'Sample 1/2 Jalli sales',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA07MN6789',
        truckName: 'Deepak Verma',
        entryType: 'Sales',
        materialType: '1/4 Kuranai',
        units: 20,
        ratePerUnit: 16000,
        entryTime: '15:20',
        entryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        notes: 'Sample 1/4 Kuranai sales',
      },
      {
        userId: adminUser._id,
        organization: adminUser.organization,
        truckNumber: 'KA08OP0123',
        truckName: 'Sanjay Gupta',
        entryType: 'Sales',
        materialType: 'Dust',
        units: 10,
        ratePerUnit: 20000,
        entryTime: '12:00',
        entryDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        notes: 'Sample Dust sales',
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
      OtherExpense.deleteMany({}),
    ]);
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
  }
};

// Clear all data except MaterialRates
const clearExceptMaterialRates = async () => {
  try {
    await connectDB();

    await Promise.all([
      User.deleteMany({}),
      TruckEntry.deleteMany({}),
      Organization.deleteMany({}),
      OtherExpense.deleteMany({}),
    ]);

    console.log('✅ Cleared all data except MaterialRates');
  } catch (error) {
    console.error('❌ Error clearing database:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
  }
};

// Seed custom organizations and users
const seedCustomData = async () => {
  try {
    await connectDB();

    console.log('🏢 Creating organizations...');

    const organizations = [
      { name: 'C001' },
      { name: 'C002' },
      { name: 'Test' },
    ];

    const createdOrganizations = [];

    // Create organizations with their owners
    for (let i = 0; i < organizations.length; i++) {
      const orgData = organizations[i];
      const existingOrg = await Organization.findOne({ name: orgData.name });

      if (existingOrg) {
        console.log(`📝 Organization ${orgData.name} already exists`);
        createdOrganizations.push(existingOrg);
      } else {
        // Create owner user first
        const ownerUsername = `${orgData.name}_owner`;
        const password = 'password123';
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 12);

        const ownerUser = await User.create({
          username: ownerUsername,
          password: hashedPassword,
          role: 'owner',
          isActive: true,
        });

        // Create organization with owner
        const organization = await Organization.create({
          name: orgData.name,
          owner: ownerUser._id,
          members: [ownerUser._id],
        });

        // Update owner user with organization
        ownerUser.organization = organization._id;
        await ownerUser.save();

        console.log(
          `✅ Created organization: ${orgData.name} with owner: ${ownerUsername}`,
        );
        createdOrganizations.push(organization);
      }
    }

    console.log('👥 Creating additional users...');

    const users = [
      { username: 'C001_user', role: 'user', orgIndex: 0 },
      { username: 'C002_user', role: 'user', orgIndex: 1 },
      { username: 'test_user', role: 'user', orgIndex: 2 },
    ];

    const password = 'password123';
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    for (const userData of users) {
      const existingUser = await User.findOne({ username: userData.username });

      if (existingUser) {
        console.log(`📝 User ${userData.username} already exists`);
      } else {
        const user = await User.create({
          username: userData.username,
          password: hashedPassword,
          role: userData.role,
          organization: createdOrganizations[userData.orgIndex]._id,
          isActive: true,
        });

        // Add user to organization members
        createdOrganizations[userData.orgIndex].members.push(user._id);
        await createdOrganizations[userData.orgIndex].save();

        console.log(
          `✅ Created user: ${userData.username} (${userData.role}) in ${
            createdOrganizations[userData.orgIndex].name
          }`,
        );
      }
    }

    console.log('✅ Custom data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding custom data:', error.message);
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
  case 'clear-except-rates':
    clearExceptMaterialRates();
    break;
  case 'custom':
    seedCustomData();
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
  clearExceptMaterialRates,
  seedCustomData,
  seedOrganizationAndAdmin,
  seedMaterialRates,
  seedSampleTruckEntries,
};
