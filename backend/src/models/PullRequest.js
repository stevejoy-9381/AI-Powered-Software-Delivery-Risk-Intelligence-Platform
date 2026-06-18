const mongoose = require('mongoose');

/**
 * PullRequest Model
 * Represents a GitHub-style pull request with AI-generated analysis.
 * Risk flags and LLM summaries are populated by the ML service.
 */
const pullRequestSchema = new mongoose.Schema(
  {
    sprintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sprint',
      required: [true, 'Sprint is required'],
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project is required'],
    },
    githubPrNumber: {
      type: Number,
      required: [true, 'GitHub PR number is required'],
    },
    title: {
      type: String,
      required: [true, 'PR title is required'],
      trim: true,
      maxlength: [300, 'Title cannot exceed 300 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
    },
    filesChanged: [
      {
        filename: { type: String, trim: true },
        additions: { type: Number, default: 0 },
        deletions: { type: Number, default: 0 },
        changeType: {
          type: String,
          enum: ['added', 'modified', 'deleted', 'renamed'],
          default: 'modified',
        },
      },
    ],
    additions: {
      type: Number,
      default: 0,
      min: 0,
    },
    deletions: {
      type: Number,
      default: 0,
      min: 0,
    },
    reviewers: [
      {
        name: { type: String, trim: true },
        status: {
          type: String,
          enum: ['pending', 'approved', 'changes_requested', 'commented'],
          default: 'pending',
        },
        reviewedAt: { type: Date },
      },
    ],
    reviewLagHours: {
      type: Number, // Time from PR creation to first review
      default: null,
    },
    mergedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['open', 'merged', 'closed', 'draft'],
      default: 'open',
    },

    // ── AI/ML generated fields (populated by ML service) ─
    riskFlags: [
      {
        type: String,
        trim: true,
        // e.g., "large-diff", "no-tests", "touches-auth", "security-sensitive"
      },
    ],
    llmSummary: {
      type: String,
      trim: true,
      default: '',
    },
    sentimentScore: {
      type: Number, // -1.0 to 1.0
      default: null,
    },

    // ── Computed boolean flags ────────────────────────────
    touchesAuthLogic: {
      type: Boolean,
      default: false,
    },
    hasTests: {
      type: Boolean,
      default: false,
    },
    isLargeDiff: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ── Pre-save: auto-compute derived flags ───────────────────
pullRequestSchema.pre('save', function (next) {
  // Detect large diffs (>500 lines changed)
  this.isLargeDiff = (this.additions + this.deletions) > 500;

  // Detect if PR touches auth-related files
  if (this.filesChanged && this.filesChanged.length > 0) {
    const authPatterns = /auth|login|session|token|password|permission|rbac|oauth/i;
    this.touchesAuthLogic = this.filesChanged.some((f) =>
      authPatterns.test(f.filename)
    );

    // Detect if PR includes test files
    const testPatterns = /\.(test|spec)\.(js|ts|py|jsx|tsx)$|__tests__|test_/i;
    this.hasTests = this.filesChanged.some((f) =>
      testPatterns.test(f.filename)
    );
  }

  next();
});

// ── Indexes ────────────────────────────────────────────────
pullRequestSchema.index({ sprintId: 1 });
pullRequestSchema.index({ projectId: 1, status: 1 });
pullRequestSchema.index({ projectId: 1 });
pullRequestSchema.index({ status: 1 });
pullRequestSchema.index({ author: 1 });
pullRequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PullRequest', pullRequestSchema);
