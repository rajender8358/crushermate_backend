// Update passwords for specific usernames using the model's hashing
require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
});

const mongoose = require('mongoose');
const path = require('path');
const User = require(path.join(__dirname, '..', 'src', 'models', 'User'));

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI missing in backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('✅ Connected to MongoDB');
}

async function updatePasswords(usernames, newPassword) {
  for (const username of usernames) {
    const user = await User.findOne({ username });
    if (!user) {
      console.log(`ℹ️ User not found: ${username}`);
      continue;
    }
    user.password = newPassword; // pre-save hook will hash
    await user.save();
    console.log(`🔐 Updated password for ${username}`);
  }
}

async function main() {
  try {
    const targetUsers = ['SKP_owner', 'SKP_user', 'SRK_owner'];
    const newPassword = 'password123';
    await connectDB();
    await updatePasswords(targetUsers, newPassword);
    console.log('🎉 Password updates complete');
  } catch (e) {
    console.error('❌ Failed to update passwords:', e);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log('📴 Database connection closed');
  }
}

main();
