const mongoose = require('mongoose');

/**
 * Sprint Model
 * Represents a development sprint (typically 2 weeks).
 * Contains embedded ticket, commit, and PR summary objects for fast reads.
 * Risk scoring is computed by the ML service and stored here.
 */
const ticketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'in_review', 'done', 'blocked', 'reopened'],
      default: 'todo',
    },
    assignee: { type: String, trim: true },
    storyPoints: { type: Number, default: 0, min: 0 },
    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      default: 'medium',
    },
    labels: [{ type: String, trim: true }],
    addedMidSprint: { type: Boolean, default: false }, // Scope creep indicator
    reopenedCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { _id: false }
);

const commitSummarySchema = new mongoose.Schema(
  {
    sha: { type: String, required: true },
    author: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    filesChanged: { type: Number, default: 0 },
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    timestamp: { type: Date, required: true },
  },
  { _id: false }
);

const prSummarySchema = new mongoose.Schema(
  {
    prId: { type: mongoose.Schema.Types.ObjectId, ref: 'PullRequest' },
    title: { type: String, trim: true },
    status: {
      type: String,
      enum: ['open', 'merged', 'closed', 'draft'],
      default: 'open',
    },
    author: { type: String, trim: true },
  },
  { _id: false }
);

const sprintSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Sprint name is required'],
      trim: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team is required'],
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    status: {
      type: String,
      enum: ['planning', 'active', 'completed', 'cancelled'],
      default: 'planning',
    },
    plannedPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ── Embedded data for fast reads ─────────────────────
    tickets: [ticketSchema],
    commits: [commitSummarySchema],
    pullRequests: [prSummarySchema],

    // ── Risk assessment (populated by ML service) ────────
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    riskLevel: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical', null],
      default: null,
    },
    riskFactors: [
      {
        type: String,
        trim: true,
      },
    ],

    // ── Outcome tracking ─────────────────────────────────
    actualShipDate: {
      type: Date,
    },
    wasDelayed: {
      type: Boolean,
      default: false,
    },
    delayDays: {
      type: Number,
      default: 0,
    },

    // ── Computed metrics (for ML feature extraction) ─────
    commitFrequency: {
      type: Number, // commits per day
      default: 0,
    },
    codeChurnRate: {
      type: Number, // (additions + deletions) / total lines
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes for common queries ─────────────────────────────
sprintSchema.index({ teamId: 1, status: 1 });
sprintSchema.index({ projectId: 1, startDate: -1 });

// ── Virtual: completion percentage ─────────────────────────
sprintSchema.virtual('completionPercentage').get(function () {
  if (this.plannedPoints === 0) return 0;
  return Math.round((this.completedPoints / this.plannedPoints) * 100);
});

// ── Virtual: days remaining ────────────────────────────────
sprintSchema.virtual('daysRemaining').get(function () {
  const now = new Date();
  const end = new Date(this.endDate);
  const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
});

sprintSchema.set('toJSON', { virtuals: true });
sprintSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Sprint', sprintSchema);
