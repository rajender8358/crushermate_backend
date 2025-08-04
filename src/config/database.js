const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Use environment variable or fallback to Atlas connection
    const mongoURI =
      process.env.MONGODB_URI ||
      'mongodb+srv://rajenderreddygarlapalli:MacBook%408358%249154@crushermate.utrbdfv.mongodb.net/CrusherMate?retryWrites=true&w=majority';

    

    // Enhanced connection options for better performance and reliability
    const connectionOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS:
        parseInt(process.env.DB_SERVER_SELECTION_TIMEOUT) || 15000, // Increased timeout
      socketTimeoutMS: parseInt(process.env.DB_SOCKET_TIMEOUT) || 45000,
      connectTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT) || 30000,
      maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE) || 10,
      minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE) || 2,
      maxIdleTimeMS: 30000,
      dbName: 'CrusherMate', // Explicitly set database name
      bufferCommands: true, // Enable mongoose buffering to prevent connection issues
    };

    await mongoose.connect(mongoURI, connectionOptions);

    console.log('✅ MongoDB connected successfully');
    console.log('📊 Database:', mongoose.connection.name);
    console.log('🔧 Connection Options:', {
      serverSelectionTimeoutMS: connectionOptions.serverSelectionTimeoutMS,
      socketTimeoutMS: connectionOptions.socketTimeoutMS,
      connectTimeoutMS: connectionOptions.connectTimeoutMS,
      maxPoolSize: connectionOptions.maxPoolSize,
      minPoolSize: connectionOptions.minPoolSize,
    });

    // Handle connection events
    mongoose.connection.on('error', err => {
      console.error('❌ MongoDB connection error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });

    // Monitor connection pool
    mongoose.connection.on('connected', () => {
      console.log('🔗 MongoDB connection pool ready');
    });
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('🔍 Error details:', error);
    console.error('🔍 Error stack:', error.stack);

    // Handle database case sensitivity error
    if (error.message.includes('db already exists with different case')) {
      console.log('🔄 Attempting to connect with correct database case...');
      try {
        // Try with the correct case
        const correctedURI = mongoURI.replace('/crushermate', '/CrusherMate');
        await mongoose.connect(correctedURI, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          serverSelectionTimeoutMS: 15000,
          socketTimeoutMS: 45000,
          connectTimeoutMS: 30000,
          maxPoolSize: 10,
          minPoolSize: 2,
          maxIdleTimeMS: 30000,
          dbName: 'CrusherMate',
          bufferCommands: true, // Enable buffering
        });
        console.log('✅ MongoDB connected successfully with corrected case');
        console.log('📊 Database:', mongoose.connection.name);
      } catch (retryError) {
        console.error('❌ Retry connection failed:', retryError.message);
        console.log('⚠️ Continuing without MongoDB connection...');
      }
    } else {
      // Don't throw error - just log it and continue
      console.log('⚠️ Continuing without MongoDB connection...');
    }
  }
};

module.exports = connectDB;
