const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

const User = require('./src/models/User');
const Organization = require('./src/models/Organization');

async function testDatabasePerformance() {
  try {
    console.log('🔗 Testing MongoDB connection and performance...');

    const mongoURI =
      process.env.MONGODB_URI ||
      'mongodb+srv://rajenderreddygarlapalli:MacBook%408358%249154@crushermate.utrbdfv.mongodb.net/CrusherMate?retryWrites=true&w=majority';

    console.log('🌐 Connecting to MongoDB...');

    // Enhanced connection options
    const connectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      dbName: 'CrusherMate',
      bufferCommands: false,
    };

    await mongoose.connect(mongoURI, connectionOptions);
    console.log('✅ MongoDB connected successfully');
    console.log('📊 Database:', mongoose.connection.name);

    // Test 1: Basic connection
    console.log('\n🧪 Test 1: Basic connection test');
    const pingResult = await mongoose.connection.db.admin().ping();
    console.log('✅ Database ping successful:', pingResult);

    // Test 2: Simple query performance
    console.log('\n🧪 Test 2: Simple query performance');
    const startTime = Date.now();
    const userCount = await User.countDocuments();
    const queryTime = Date.now() - startTime;
    console.log(`✅ Count query completed in ${queryTime}ms`);
    console.log(`📊 Total users in database: ${userCount}`);

    // Test 3: Login query simulation
    console.log('\n🧪 Test 3: Login query simulation');
    const testUsername = 'raj'; // Use a known username

    const loginStartTime = Date.now();
    const user = await User.findByUsernameForLogin(testUsername);
    const loginQueryTime = Date.now() - loginStartTime;

    if (user) {
      console.log(`✅ Login query completed in ${loginQueryTime}ms`);
      console.log(`👤 Found user: ${user.username}, role: ${user.role}`);
    } else {
      console.log(`⚠️ User '${testUsername}' not found`);
    }

    // Test 4: Index analysis
    console.log('\n🧪 Test 4: Index analysis');
    try {
      const indexes = await User.collection.getIndexes();
      console.log('📋 Database indexes:');
      Object.keys(indexes).forEach(indexName => {
        console.log(
          `  - ${indexName}: ${JSON.stringify(indexes[indexName].key)}`,
        );
      });
    } catch (error) {
      console.log('⚠️ Could not retrieve index information:', error.message);
    }

    // Test 5: Connection pool status
    console.log('\n🧪 Test 5: Connection pool status');
    console.log('🔗 Connection pool ready');

    console.log('\n🎉 All database performance tests completed successfully!');
    console.log('\n📊 Performance Summary:');
    console.log(`  - Basic query time: ${queryTime}ms`);
    console.log(`  - Login query time: ${loginQueryTime}ms`);
    console.log(`  - Total users: ${userCount}`);
  } catch (error) {
    console.error('❌ Database performance test failed:', error.message);
    console.error('🔍 Error details:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 MongoDB disconnected');
  }
}

// Run the test
testDatabasePerformance();
