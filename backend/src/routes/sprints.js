/**
 * Sprint Routes
 * CRUD operations for sprints + the main /analyze endpoint
 * that triggers the full AI risk assessment pipeline.
 */
const express = require('express');
const router = express.Router();
const Sprint = require('../models/Sprint');
const PullRequest = require('../models/PullRequest');
const Team = require('../models/Team');
const { verifyToken } = require('../middleware/auth');
const mlService = require('../services/mlService');
const { getPostgresPool } = require('../config/db');

// All sprint routes require authentication
router.use(verifyToken);

// ── GET /api/sprints/:sprintId ─────────────────────────────
router.get('/:sprintId', async (req, res, next) => {
  try {
    const sprint = await Sprint.findById(req.params.sprintId)
      .populate('teamId', 'name members')
      .populate('projectId', 'name githubRepo');

    if (!sprint) {
      return res.status(404).json({
        success: false,
        error: { message: 'Sprint not found.' },
      });
    }

    // Include associated full PR documents
    const pullRequests = await PullRequest.find({ sprintId: sprint._id });

    res.json({
      success: true,
      data: { sprint, pullRequests },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/sprints/team/:teamId ──────────────────────────
router.get('/team/:teamId', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { teamId: req.params.teamId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Sprint.countDocuments(query);
    const sprints = await Sprint.find(query)
      .sort({ startDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('projectId', 'name');

    res.json({
      success: true,
      data: {
        sprints,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/sprints/:sprintId/analyze ────────────────────
// MAIN ENDPOINT — triggers full AI analysis
router.post('/:sprintId/analyze', async (req, res, next) => {
  try {
    const sprint = await Sprint.findById(req.params.sprintId)
      .populate('teamId', 'name members');

    if (!sprint) {
      return res.status(404).json({
        success: false,
        error: { message: 'Sprint not found.' },
      });
    }

    const team = sprint.teamId;
    const teamSize = team?.members?.length || 1;

    // ── Build sprint features for ML service ──────────────
    const sprintData = {
      sprintId: sprint._id.toString(),
      sprintName: sprint.name,
      sprintGoal: sprint.name, // Use name as goal if no explicit goal
      sprintDays: Math.ceil(
        (new Date(sprint.endDate) - new Date(sprint.startDate)) / (1000 * 60 * 60 * 24)
      ),
      daysRemaining: sprint.daysRemaining || 7,
      teamSize,
      plannedPoints: sprint.plannedPoints || 0,
      completedPoints: sprint.completedPoints || 0,
      tickets: (sprint.tickets || []).map((t) => ({
        title: t.title,
        description: t.title, // Use title as fallback description
        status: t.status,
        addedMidSprint: t.addedMidSprint || false,
        reopenedCount: t.reopenedCount || 0,
      })),
      commits: (sprint.commits || []).map((c) => ({
        message: c.message,
        author: c.author,
        additions: c.additions || 0,
        deletions: c.deletions || 0,
        files: [],
      })),
      pullRequests: (sprint.pullRequests || []).map((pr) => ({
        title: pr.title,
        status: pr.status,
        reviewLagHours: null,
      })),
    };

    // Enrich PR data with full PR documents (review lag)
    const fullPRs = await PullRequest.find({ sprintId: sprint._id });
    if (fullPRs.length > 0) {
      sprintData.pullRequests = fullPRs.map((pr) => ({
        title: pr.title,
        status: pr.status,
        reviewLagHours: pr.reviewLagHours,
        additions: pr.additions,
        deletions: pr.deletions,
      }));
    }

    // ── Call ML service: Risk Score ────────────────────────
    const riskResult = await mlService.analyzeSprintRisk(sprintData);

    // ── Call ML service: Staffing Analysis ─────────────────
    const staffingData = {
      team_size: teamSize,
      senior_dev_count: (team?.members || []).filter(
        (m) => m.role === 'senior' || m.role === 'lead'
      ).length,
      open_prs: fullPRs.filter((pr) => pr.status === 'open').length,
      open_tickets: (sprint.tickets || []).filter(
        (t) => t.status !== 'done'
      ).length,
      avg_pr_review_lag_hours:
        fullPRs.reduce((sum, pr) => sum + (pr.reviewLagHours || 0), 0) /
        Math.max(fullPRs.length, 1),
      changed_files: [],
      commits: (sprint.commits || []).map((c) => ({
        author: c.author,
        message: c.message,
      })),
    };

    const staffingResult = await mlService.analyzeStaffing(staffingData, []);

    // ── Save prediction to PostgreSQL ─────────────────────
    try {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO risk_predictions
          (sprint_id, predicted_risk_score, predicted_delay, confidence, risk_factors, staffing_recommendation, model_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          sprint._id.toString(),
          riskResult?.risk_score || 0,
          riskResult?.predicted_delay || false,
          riskResult?.confidence || 0,
          JSON.stringify(riskResult?.risk_factors || []),
          staffingResult?.staffing_recommendation || '',
          'v1.0',
        ]
      );
    } catch (pgError) {
      console.warn('⚠️ Failed to save to PostgreSQL:', pgError.message);
    }

    // ── Update sprint in MongoDB ──────────────────────────
    if (riskResult) {
      sprint.riskScore = riskResult.risk_score;
      sprint.riskLevel = riskResult.risk_level;
      sprint.riskFactors = (riskResult.risk_factors || []).map(
        (f) => `${f.factor}: ${f.description}`
      );
      await sprint.save();
    }

    res.json({
      success: true,
      data: {
        riskScore: riskResult?.risk_score || null,
        riskLevel: riskResult?.risk_level || null,
        riskFactors: riskResult?.risk_factors || [],
        predictedDelay: riskResult?.predicted_delay || false,
        confidence: riskResult?.confidence || 0,
        staffingSignals: staffingResult || null,
        features: riskResult?.features || null,
        nlpAnalysis: riskResult?.nlp_analysis || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/sprints/:sprintId/risk-history ────────────────
router.get('/:sprintId/risk-history', async (req, res, next) => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query(
      `SELECT * FROM risk_predictions
       WHERE sprint_id = $1
       ORDER BY created_at DESC`,
      [req.params.sprintId]
    );

    res.json({
      success: true,
      data: { predictions: result.rows },
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/sprints ──────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { name, teamId, projectId, startDate, endDate, plannedPoints } = req.body;

    if (!name || !teamId || !projectId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: { message: 'name, teamId, projectId, startDate, endDate are required.' },
      });
    }

    const sprint = await Sprint.create({
      name,
      teamId,
      projectId,
      startDate,
      endDate,
      plannedPoints: plannedPoints || 0,
      status: 'planning',
    });

    res.status(201).json({
      success: true,
      data: { sprint },
    });
  } catch (error) {
    next(error);
  }
});

// ── PUT /api/sprints/:sprintId ─────────────────────────────
router.put('/:sprintId', async (req, res, next) => {
  try {
    const allowedUpdates = [
      'name', 'status', 'plannedPoints', 'completedPoints',
      'tickets', 'commits', 'pullRequests',
      'actualShipDate', 'wasDelayed', 'delayDays',
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    const sprint = await Sprint.findByIdAndUpdate(
      req.params.sprintId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!sprint) {
      return res.status(404).json({
        success: false,
        error: { message: 'Sprint not found.' },
      });
    }

    res.json({
      success: true,
      data: { sprint },
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/sprints/:sprintId/batch-pr-analyze ───────────
router.post('/:sprintId/batch-pr-analyze', async (req, res, next) => {
  try {
    const { sprintId } = req.params;
    const pullRequests = await PullRequest.find({ sprintId });

    if (pullRequests.length === 0) {
      return res.json({ success: true, data: { message: 'No pull requests found to analyze.' } });
    }

    const analyzedPRs = [];
    for (const pr of pullRequests) {
      // Build PR data for ML service
      const prData = {
        title: pr.title,
        description: pr.description || '',
        files_changed: (pr.filesChanged || []).map((f) => f.filename),
        additions: pr.additions,
        deletions: pr.deletions,
        has_tests: pr.hasTests,
        githubPrNumber: pr.githubPrNumber,
      };

      try {
        const summary = await mlService.analyzePR(prData);
        if (summary) {
          pr.llmSummary = summary.summary || '';
          pr.riskFlags = summary.risk_flags || [];
          pr.touchesAuthLogic = summary.touches_auth || false;
          await pr.save();
          analyzedPRs.push(pr);
        }
      } catch (err) {
        console.warn(`⚠️ Batch analysis failed for PR #${pr.githubPrNumber}:`, err.message);
      }
    }

    res.json({
      success: true,
      data: {
        message: `Successfully analyzed ${analyzedPRs.length} pull request(s).`,
        count: analyzedPRs.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/sprints/:sprintId/analyze-all-prs ────────────
router.post('/:sprintId/analyze-all-prs', async (req, res, next) => {
  try {
    const { sprintId } = req.params;
    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      return res.status(404).json({
        success: false,
        error: { message: 'Sprint not found.' },
      });
    }

    const pullRequests = await PullRequest.find({ sprintId });
    if (pullRequests.length === 0) {
      return res.json({
        success: true,
        data: {
          message: 'No pull requests found to analyze.',
          count: 0,
          patternsDetected: 'No pull requests found.',
          riskLevel: 'low',
        },
      });
    }

    // Map PRs for ML service batch endpoint
    const batchInput = pullRequests.map((pr) => ({
      title: pr.title,
      description: pr.description || '',
      files_changed: (pr.filesChanged || []).map((f) => f.filename),
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      has_tests: pr.hasTests || false,
      githubPrNumber: pr.githubPrNumber,
    }));

    // Call ML batch endpoint
    const batchResult = await mlService.analyzePRsBatch(batchInput);
    
    const summarizedDetails = [];

    if (batchResult && batchResult.summaries) {
      for (let i = 0; i < pullRequests.length; i++) {
        const pr = pullRequests[i];
        const summary = batchResult.summaries[i];
        if (summary) {
          pr.llmSummary = summary.summary || '';
          pr.riskFlags = summary.risk_flags || [];
          pr.touchesAuthLogic = summary.touches_auth || false;
          await pr.save();

          summarizedDetails.push({
            githubPrNumber: pr.githubPrNumber,
            title: pr.title,
            summary: pr.llmSummary,
            risk_flags: pr.riskFlags,
            touches_auth: pr.touchesAuthLogic,
            touches_payments: summary.touches_payments || false,
            files_changed: (pr.filesChanged || []).map((f) => f.filename),
          });
        }
      }
    }

    // Call ML pattern detection endpoint
    let patternResult = null;
    if (summarizedDetails.length > 0) {
      patternResult = await mlService.detectRiskPatterns(summarizedDetails, sprint.name);
      if (patternResult) {
        sprint.prPatterns = patternResult.patterns_detected || '';
        if (patternResult.has_critical_patterns) {
          sprint.riskLevel = 'critical';
          sprint.riskScore = Math.max(sprint.riskScore || 0, 85);
        }
        await sprint.save();
      }
    }

    res.json({
      success: true,
      data: {
        message: `Successfully analyzed ${summarizedDetails.length} pull request(s) and ran pattern detection.`,
        count: summarizedDetails.length,
        patternsDetected: patternResult?.patterns_detected || 'No significant patterns detected.',
        riskLevel: patternResult?.risk_level || 'low',
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
