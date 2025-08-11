const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: false, // Made optional for initial setup
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [50, 'Username cannot exceed 50 characters'], // Increased for email support
      index: true, // Add index for faster queries
    },
    email: {
      type: String,
      required: false, // Optional for backward compatibility
      unique: true,
      sparse: true, // Allow multiple null values
      trim: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: ['owner', 'user'],
      default: 'user',
      index: true, // Add index for role-based queries
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true, // Add index for active user queries
    },
    lastLogin: {
      type: Date,
      default: null,
      index: true, // Add index for login tracking
    },
    profileImage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound indexes for better query performance
userSchema.index({ username: 1, isActive: 1 });
userSchema.index({ email: 1, isActive: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ organization: 1, isActive: 1 });

// Virtual for user's full display name
userSchema.virtual('displayName').get(function () {
  return this.username || 'User';
});

// Pre-save middleware for password hashing
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare entered password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Update last login with optimized save
userSchema.methods.updateLastLogin = function () {
  this.lastLogin = new Date();
  return this.save({ validateBeforeSave: false, lean: true });
};

// Static method to get active users with optimized query
userSchema.statics.getActiveUsers = function () {
  return this.find({ isActive: true })
    .select('-password')
    .lean() // Use lean queries for better performance
    .exec();
};

// Optimized findOne method for login - supports both username and email
userSchema.statics.findByUsernameForLogin = function (usernameOrEmail) {
  // Check if input looks like an email
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usernameOrEmail);

  let query = { isActive: true };

  if (isEmail) {
    // If it's an email, search by both email and username fields
    query.$or = [
      { email: { $regex: new RegExp(`^${usernameOrEmail}$`, 'i') } },
      { username: { $regex: new RegExp(`^${usernameOrEmail}$`, 'i') } }
    ];
  } else {
    // If it's a username, search by username
    query.username = { $regex: new RegExp(`^${usernameOrEmail}$`, 'i') };
  }

  return this.findOne(query)
    .populate('organization')
    .select('+password')
    .lean()
    .exec();
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  return userObject;
};

// Use 'UsersList' to match your existing collection name
module.exports = mongoose.model('User', userSchema, 'UsersList');
