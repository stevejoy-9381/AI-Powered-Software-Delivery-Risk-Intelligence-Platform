const mongoose = require('mongoose');

/**
 * Organization Model
 * Represents a company or organization that owns teams, projects, and users.
 */
const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      unique: true,
      trim: true,
      maxlength: [150, 'Organization name cannot exceed 150 characters'],
    },
    industry: {
      type: String,
      trim: true,
      enum: [
        'technology',
        'finance',
        'healthcare',
        'e-commerce',
        'saas',
        'consulting',
        'media',
        'other',
      ],
      default: 'technology',
    },
    size: {
      type: String,
      enum: ['startup', 'small', 'medium', 'large', 'enterprise'],
      default: 'medium',
    },
    githubOrg: {
      type: String,
      trim: true,
      default: '',
    },
    jiraWorkspace: {
      type: String,
      trim: true,
      default: '',
    },
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

module.exports = mongoose.model('Organization', organizationSchema);
