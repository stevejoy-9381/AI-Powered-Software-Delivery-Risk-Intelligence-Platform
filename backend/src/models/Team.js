const mongoose = require('mongoose');

/**
 * Team Model
 * Represents a development team within an organization.
 * Teams own projects and are assigned members.
 */
const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      maxlength: [100, 'Team name cannot exceed 100 characters'],
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        role: {
          type: String,
          enum: ['lead', 'senior', 'mid', 'junior', 'intern'],
          default: 'mid',
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    githubRepos: [
      {
        type: String,
        trim: true,
      },
    ],
    techStack: [
      {
        type: String,
        trim: true,
      },
    ],
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Virtual: member count ──────────────────────────────────
teamSchema.virtual('memberCount').get(function () {
  return this.members ? this.members.length : 0;
});

// Ensure virtuals are included in JSON output
teamSchema.set('toJSON', { virtuals: true });
teamSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Team', teamSchema);
