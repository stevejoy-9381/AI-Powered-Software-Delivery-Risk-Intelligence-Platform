const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Model
 * Represents a platform user with local or GitHub OAuth authentication.
 * Roles: admin, manager, developer
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't return password in queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'manager', 'developer'],
      default: 'developer',
    },
    githubId: {
      type: String,
      unique: true,
      sparse: true, // Allow null values while maintaining uniqueness
    },
    githubUsername: {
      type: String,
      trim: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// ── Pre-save hook: Hash password before saving ─────────────
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ── Instance method: Compare password for login ────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance method: Return safe user object (no password) ─
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
