// Production Database Seeding Script
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('./src/models/User');
const MaterialRate = require('./src/models/MaterialRate');
const Organization = require('./src/models/Organization');

// Connect to production MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to production MongoDB');
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
    const existingAdmin = await User.findOne({ username: adminUsername });

    if (existingAdmin) {
      console.log(`👤 Admin user already exists: ${adminUsername}`);
      return existingAdmin;
    }

    // Create admin user first (without organization)
    const adminUser = await User.create({
      username: adminUsername,
      password: adminPassword,
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

    console.log(`✅ Admin user created: ${adminUsername}`);
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
        materialType: '1 1/2" Metal',
        currentRate: 28000,
        notes: 'Market rate for 1 1/2" Metal per unit',
      },
      {
        materialType: '3/4" Jalli',
        currentRate: 22000,
        notes: 'Market rate for 3/4" Jalli per unit',
      },
      {
        materialType: '1/2" Jalli',
        currentRate: 20000,
        notes: 'Market rate for 1/2" Jalli per unit',
      },
      {
        materialType: '1/4" Kuranai',
        currentRate: 18000,
        notes: 'Market rate for 1/4" Kuranai per unit',
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

// Main seeding function
const seedProductionDatabase = async () => {
  try {
    console.log('🌱 Starting production database seeding...');

    await connectDB();

    // Seed admin user and organization
    const adminUser = await seedOrganizationAndAdmin();

    // Seed material rates
    await seedMaterialRates(adminUser);

    console.log('🎉 Production database seeding completed successfully!');
    console.log('\n📋 Summary:');
    console.log(
      `👤 Admin User: ${adminUser.username} (role: ${adminUser.role})`,
    );

    console.log('\n🔐 Login Credentials:');
    console.log(
      `Username: ${adminUser.username} / Password: ${
        process.env.ADMIN_PASSWORD || 'Test@123'
      }`,
    );
  } catch (error) {
    console.error('❌ Production database seeding failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
  }
};

// Run the seeding
seedProductionDatabase();
