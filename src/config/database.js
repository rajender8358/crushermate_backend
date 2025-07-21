const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Use environment variable or fallback to Atlas connection
    const mongoURI =
      process.env.MONGODB_URI ||
      'mongodb+srv://rajenderreddygarlapalli:MacBook%408358%249154@crushermate.utrbdfv.mongodb.net/CrusherMate?retryWrites=true&w=majority';

    console.log('🔗 Connecting to MongoDB...');
    console.log('🌐 URI:', mongoURI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials in logs

    // Simplified connection options for better compatibility
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Increased timeout
      socketTimeoutMS: 45000,
    });

    console.log('✅ MongoDB connected successfully');
    console.log('📊 Database:', mongoose.connection.name);

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
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('🔍 Error details:', error);
    console.error('🔍 Error stack:', error.stack);
    // Don't throw error - just log it and continue
    console.log('⚠️ Continuing without MongoDB connection...');
  }
};

module.exports = connectDB;
