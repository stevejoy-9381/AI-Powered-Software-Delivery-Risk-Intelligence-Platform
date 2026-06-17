const mongoose = require('mongoose');

/**
 * Project Model
 * Represents a software project owned by a team.
 * Projects contain multiple sprints and are linked to GitHub repos.
 */
const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [200, 'Project name cannot exceed 200 characters'],
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team is required'],
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization is required'],
    },
    type: {
      type: String,
      enum: ['service', 'product', 'library', 'infrastructure', 'internal-tool'],
      default: 'service',
    },
    domain: {
      type: String,
      trim: true,
      default: '',
    },
    githubRepo: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    targetEndDate: {
      type: Date,
    },
    actualEndDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['planning', 'active', 'completed', 'cancelled', 'on-hold'],
      default: 'planning',
    },
    sprints: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Sprint',
      },
    ],
    techStack: [
      {
        type: String,
        trim: true,
      },
    ],
    clientName: {
      type: String,
      trim: true,
      default: '',
    },
    criticality: {
      type: Number,
      min: 1,
      max: 5,
      default: 3, // 1 = low, 5 = mission-critical
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

// ── Indexes ────────────────────────────────────────────────
projectSchema.index({ teamId: 1 });
projectSchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.model('Project', projectSchema);
