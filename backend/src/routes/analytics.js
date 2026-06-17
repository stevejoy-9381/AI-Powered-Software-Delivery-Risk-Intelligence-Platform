/**
 * Analytics Routes
 * Dashboard summaries, benchmarking, risk timelines, and release readiness.
 */
const express = require('express');
const router = express.Router();
const Sprint = require('../models/Sprint');
const Project = require('../models/Project');
const Team = require('../models/Team');
const PullRequest = require('../models/PullRequest');
const { verifyToken } = require('../middleware/auth');
const mlService = require('../services/mlService');
const { getPostgresPool } = require('../config/db');
const cache = require('../services/cacheService');

router.use(verifyToken);

// ── GET /api/analytics/dashboard/:organizationId ───────────
router.get('/dashboard/:organizationId', async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const cacheKey = `dashboard:${organizationId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData });
    }

    // Find all teams in this org
    const teams = await Team.find({ organizationId, isActive: true });
    const teamIds = teams.map((t) => t._id);

    // Find all projects for these teams
    const projects = await Project.find({
      teamId: { $in: teamIds },
      isActive: true,
    });
    const projectIds = projects.map((p) => p._id);

    // Find active sprints
    const activeSprints = await Sprint.find({
      projectId: { $in: projectIds },
      status: 'active',
    }).populate('teamId', 'name').populate('projectId', 'name');

    // Count sprints by risk level
    const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0, unscored: 0 };
    for (const sprint of activeSprints) {
      if (sprint.riskLevel) {
        riskDistribution[sprint.riskLevel]++;
      } else {
        riskDistribution.unscored++;
      }
    }

    // Find top 3 most critical sprints
    const criticalSprints = activeSprints
      .filter((s) => s.riskScore !== null && s.riskScore !== undefined)
      .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
      .slice(0, 3)
      .map((s) => ({
        sprintId: s._id,
        name: s.name,
        team: s.teamId?.name || 'Unknown',
        project: s.projectId?.name || 'Unknown',
        riskScore: s.riskScore,
        riskLevel: s.riskLevel,
        daysRemaining: s.daysRemaining,
      }));

    // Compute average health score
    const scoredSprints = activeSprints.filter((s) => s.riskScore != null);
    const avgRiskScore = scoredSprints.length > 0
      ? Math.round(scoredSprints.reduce((sum, s) => sum + s.riskScore, 0) / scoredSprints.length)
      : 0;
    // Health score is inverse of risk score (high risk = low health)
    const avgHealthScore = Math.max(0, 100 - avgRiskScore);

    const resultData = {
      totalActiveSprints: activeSprints.length,
      riskDistribution,
      avgHealthScore,
      avgRiskScore,
      criticalSprints,
      teamCount: teams.length,
      projectCount: projects.length,
    };

    cache.set(cacheKey, resultData, 300); // 5 min TTL

    res.json({
      success: true,
      data: resultData,
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/analytics/team/:teamId/benchmark ──────────────
router.get('/team/:teamId/benchmark', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const cacheKey = `benchmark:${teamId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData });
    }

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team not found.' },
      });
    }

    // Get recent completed sprints for this team
    const recentSprints = await Sprint.find({
      teamId: team._id,
      status: 'completed',
    }).sort({ endDate: -1 }).limit(10);

    // Compute team metrics for benchmark
    const totalCompleted = recentSprints.reduce((s, sp) => s + (sp.completedPoints || 0), 0);
    const totalPlanned = recentSprints.reduce((s, sp) => s + (sp.plannedPoints || 0), 0);
    const completionRate = totalPlanned > 0 ? totalCompleted / totalPlanned : 0;

    // Get PR metrics
    const recentPRs = await PullRequest.find({
      sprintId: { $in: recentSprints.map((s) => s._id) },
    });
    const avgCycleTime = recentPRs.length > 0
      ? recentPRs.reduce((s, pr) => {
          if (pr.mergedAt && pr.createdAt) {
            return s + (new Date(pr.mergedAt) - new Date(pr.createdAt)) / (1000 * 60 * 60);
          }
          return s;
        }, 0) / recentPRs.length
      : 24;
    const avgReviewLag = recentPRs.length > 0
      ? recentPRs.reduce((s, pr) => s + (pr.reviewLagHours || 0), 0) / recentPRs.length
      : 12;

    // Compute dynamic ticket ratio metrics
    let totalTickets = 0;
    let blockedTickets = 0;
    let scopeCreepTickets = 0;
    let reopenedTickets = 0;

    for (const sprint of recentSprints) {
      if (sprint.tickets && sprint.tickets.length > 0) {
        for (const ticket of sprint.tickets) {
          totalTickets++;
          if (ticket.status === 'blocked') {
            blockedTickets++;
          }
          if (ticket.addedMidSprint) {
            scopeCreepTickets++;
          }
          if (ticket.reopenedCount > 0 || ticket.status === 'reopened') {
            reopenedTickets++;
          }
        }
      }
    }

    const blockedTicketRatio = totalTickets > 0 ? blockedTickets / totalTickets : 0.0;
    const scopeCreepRatio = totalTickets > 0 ? scopeCreepTickets / totalTickets : 0.0;
    const reopenRate = totalTickets > 0 ? reopenedTickets / totalTickets : 0.0;

    // Compute average churn rate
    const totalChurn = recentSprints.reduce((sum, sp) => sum + (sp.codeChurnRate || 0), 0);
    const avgChurnRate = recentSprints.length > 0 ? totalChurn / recentSprints.length : 0.1;

    // Fetch average test coverage of the team's projects from PostgreSQL
    const teamProjects = await Project.find({ teamId: team._id, isActive: true });
    const projectIds = teamProjects.map((p) => p._id.toString());
    let avgTestCoverage = null;

    if (projectIds.length > 0) {
      try {
        const pool = getPostgresPool();
        const pgResult = await pool.query(
          `SELECT AVG(test_coverage_percent) as avg_coverage
           FROM codebase_hotspots
           WHERE project_id = ANY($1)`,
          [projectIds]
        );
        if (pgResult.rows && pgResult.rows[0] && pgResult.rows[0].avg_coverage !== null) {
          avgTestCoverage = parseFloat(pgResult.rows[0].avg_coverage);
        }
      } catch (pgError) {
        console.warn('⚠️ Failed to fetch average test coverage from PostgreSQL:', pgError.message);
      }
    }

    // Compute organization-wide averages for percentile calculations
    let orgAvgCompletionRate = null;
    let orgAvgPrCycleTime = null;
    let orgAvgChurn = null;

    try {
      const orgTeams = await Team.find({ organizationId: team.organizationId, isActive: true });
      const orgTeamIds = orgTeams.map(t => t._id);

      const orgSprints = await Sprint.find({
        teamId: { $in: orgTeamIds },
        status: 'completed',
      });

      if (orgSprints.length > 0) {
        const orgTotalCompleted = orgSprints.reduce((s, sp) => s + (sp.completedPoints || 0), 0);
        const orgTotalPlanned = orgSprints.reduce((s, sp) => s + (sp.plannedPoints || 0), 0);
        orgAvgCompletionRate = orgTotalPlanned > 0 ? orgTotalCompleted / orgTotalPlanned : null;

        const orgTotalChurn = orgSprints.reduce((s, sp) => s + (sp.codeChurnRate || 0), 0);
        orgAvgChurn = orgTotalChurn / orgSprints.length;

        // Fetch PRs for all these sprints
        const orgPRs = await PullRequest.find({
          sprintId: { $in: orgSprints.map(s => s._id) },
        });
        if (orgPRs.length > 0) {
          orgAvgPrCycleTime = orgPRs.reduce((s, pr) => {
            if (pr.mergedAt && pr.createdAt) {
              return s + (new Date(pr.mergedAt) - new Date(pr.createdAt)) / (1000 * 60 * 60);
            }
            return s;
          }, 0) / orgPRs.length;
        }
      }
    } catch (orgErr) {
      console.warn('⚠️ Failed to compute organization averages:', orgErr.message);
    }

    // Compute PR merge rate
    const mergedPRsCount = recentPRs.filter(pr => pr.status === 'merged').length;
    const prMergeRate = recentPRs.length > 0 ? mergedPRsCount / recentPRs.length : null;

    const benchmarkInput = {
      velocity_points_completed: totalCompleted,
      velocity_points_planned: Math.max(totalPlanned, 1),
      sprint_completion_rate: completionRate,
      avg_pr_cycle_time_hours: avgCycleTime,
      avg_pr_review_lag_hours: avgReviewLag,
      pr_merge_rate: prMergeRate,
      code_churn_rate: avgChurnRate,
      test_coverage_percent: avgTestCoverage,
      team_size: team.members?.length || 1,
      blocked_ticket_ratio: blockedTicketRatio,
      scope_creep_ratio: scopeCreepRatio,
      reopen_rate: reopenRate,
      org_avg_completion_rate: orgAvgCompletionRate,
      org_avg_pr_cycle_time_hours: orgAvgPrCycleTime,
      org_avg_churn_rate: orgAvgChurn,
    };

    // Call ML service
    const result = await mlService.computeBenchmark(benchmarkInput);

    // Save to PostgreSQL
    if (result) {
      try {
        const pool = getPostgresPool();
        const now = new Date();
        const period = `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`;

        await pool.query(
          `INSERT INTO team_benchmarks
            (team_id, organization_id, period, on_time_delivery_rate, sprints_completed,
             avg_pr_cycle_time_hours, delivery_health_score, percentile_rank)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (team_id, period)
           DO UPDATE SET delivery_health_score = $7, percentile_rank = $8`,
          [
            team._id.toString(),
            team.organizationId?.toString() || '',
            period,
            completionRate,
            recentSprints.length,
            avgCycleTime,
            result.health_score || 0,
            result.percentile_vs_org || 50,
          ]
        );
      } catch (pgError) {
        console.warn('⚠️ Failed to save benchmark to PostgreSQL:', pgError.message);
      }
    }

    // Get historical benchmarks from PostgreSQL
    let history = [];
    try {
      const pool = getPostgresPool();
      const historyResult = await pool.query(
        `SELECT period, delivery_health_score, percentile_rank
         FROM team_benchmarks WHERE team_id = $1
         ORDER BY period DESC LIMIT 4`,
        [teamId]
      );
      history = historyResult.rows;
    } catch (pgError) {
      console.warn('⚠️ Could not fetch benchmark history:', pgError.message);
    }

    const resultData = {
      healthScore: result?.health_score || 0,
      healthGrade: result?.health_grade || 'N/A',
      percentile: result?.percentile_vs_org || null,
      breakdown: result?.breakdown || [],
      recommendations: result?.recommendations || [],
      history,
    };

    cache.set(cacheKey, resultData, 600); // 10 min TTL

    res.json({
      success: true,
      data: resultData,
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/analytics/org/:organizationId/skill-heatmap ───
router.get('/org/:organizationId/skill-heatmap', async (req, res, next) => {
  try {
    const { organizationId } = req.params;

    // Find all teams and projects in this org
    const teams = await Team.find({ organizationId });
    const teamIds = teams.map((t) => t._id);
    const projects = await Project.find({ teamId: { $in: teamIds } });

    // Aggregate tech stacks and their delay rates
    const techStackStats = {};
    for (const project of projects) {
      const sprints = await Sprint.find({ projectId: project._id, status: 'completed' });

      for (const tech of (project.techStack || [])) {
        if (!techStackStats[tech]) {
          techStackStats[tech] = { total: 0, delayed: 0, totalRisk: 0, scored: 0 };
        }
        for (const sprint of sprints) {
          techStackStats[tech].total++;
          if (sprint.wasDelayed) techStackStats[tech].delayed++;
          if (sprint.riskScore != null) {
            techStackStats[tech].totalRisk += sprint.riskScore;
            techStackStats[tech].scored++;
          }
        }
      }
    }

    const heatmap = Object.entries(techStackStats).map(([tech, stats]) => ({
      techStack: tech,
      delayRate: stats.total > 0 ? +(stats.delayed / stats.total).toFixed(3) : 0,
      avgRiskScore: stats.scored > 0 ? +(stats.totalRisk / stats.scored).toFixed(1) : 0,
      sprintCount: stats.total,
    })).sort((a, b) => b.avgRiskScore - a.avgRiskScore);

    res.json({ success: true, data: { heatmap } });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/analytics/sprint/:sprintId/risk-timeline ──────
router.get('/sprint/:sprintId/risk-timeline', async (req, res, next) => {
  try {
    const pool = getPostgresPool();
    const result = await pool.query(
      `SELECT predicted_risk_score, predicted_delay, confidence,
              risk_factors, created_at
       FROM risk_predictions
       WHERE sprint_id = $1
       ORDER BY created_at ASC`,
      [req.params.sprintId]
    );

    res.json({
      success: true,
      data: {
        timeline: result.rows.map((r) => ({
          riskScore: r.predicted_risk_score,
          predictedDelay: r.predicted_delay,
          confidence: r.confidence,
          riskFactors: r.risk_factors,
          timestamp: r.created_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/analytics/release-readiness/:projectId ────────
router.get('/release-readiness/:projectId', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found.' },
      });
    }

    // Get active sprint risk
    const activeSprint = await Sprint.findOne({
      projectId: project._id,
      status: 'active',
    });

    const sprintRisk = activeSprint?.riskScore || 0;

    // Get hotspot count from PostgreSQL
    let hotspotCount = 0;
    try {
      const pool = getPostgresPool();
      const result = await pool.query(
        `SELECT COUNT(*) FROM codebase_hotspots
         WHERE project_id = $1 AND flagged = true`,
        [project._id.toString()]
      );
      hotspotCount = parseInt(result.rows[0]?.count || '0');
    } catch {
      // PostgreSQL might not be available
    }

    // Get open critical PRs
    const criticalPRs = await PullRequest.find({
      projectId: project._id,
      status: 'open',
      $or: [
        { touchesAuthLogic: true },
        { isLargeDiff: true },
      ],
    });

    // Compute readiness score (inverse of risk signals)
    const blockers = [];
    let riskPoints = 0;

    if (sprintRisk > 50) {
      riskPoints += 30;
      blockers.push(`Active sprint at ${activeSprint?.riskLevel || 'high'} risk (score: ${sprintRisk})`);
    }
    if (hotspotCount > 5) {
      riskPoints += 20;
      blockers.push(`${hotspotCount} codebase hotspots flagged`);
    }
    if (criticalPRs.length > 0) {
      riskPoints += 15 * Math.min(criticalPRs.length, 3);
      blockers.push(`${criticalPRs.length} open critical PR(s) need review`);
    }
    if (activeSprint && activeSprint.daysRemaining <= 2) {
      riskPoints += 15;
      blockers.push(`Only ${activeSprint.daysRemaining} day(s) remaining in sprint`);
    }

    const readinessScore = Math.max(0, 100 - riskPoints);

    let recommendation;
    if (readinessScore >= 80) {
      recommendation = 'Release looks good — no major blockers detected.';
    } else if (readinessScore >= 50) {
      recommendation = 'Some risks identified — review blockers before releasing.';
    } else {
      recommendation = 'High risk — address critical blockers before considering release.';
    }

    res.json({
      success: true,
      data: {
        readinessScore,
        blockers,
        recommendation,
        sprintRiskScore: sprintRisk,
        hotspotCount,
        openCriticalPRs: criticalPRs.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/analytics/leaderboard/:organizationId ──────────
router.get('/leaderboard/:organizationId', async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const teams = await Team.find({ organizationId, isActive: true });
    const teamMap = {};
    teams.forEach((t) => { teamMap[t._id.toString()] = t.name; });
    const teamIds = Object.keys(teamMap);

    if (teamIds.length === 0) {
      return res.json({ success: true, data: { leaderboard: [] } });
    }

    const pool = getPostgresPool();
    const result = await pool.query(
      `SELECT DISTINCT ON (team_id) team_id, delivery_health_score, percentile_rank, period
       FROM team_benchmarks
       WHERE team_id = ANY($1)
       ORDER BY team_id, period DESC`,
      [teamIds]
    );

    const leaderboard = result.rows.map((row) => ({
      teamId: row.team_id,
      name: teamMap[row.team_id] || 'Unknown Team',
      healthScore: row.delivery_health_score,
      percentileRank: row.percentile_rank,
      period: row.period
    })).sort((a, b) => b.healthScore - a.healthScore);

    res.json({ success: true, data: { leaderboard } });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/analytics/staffing-history/:teamId ──────────────
router.get('/staffing-history/:teamId', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const pool = getPostgresPool();
    const result = await pool.query(
      `SELECT * FROM staffing_predictions
       WHERE team_id = $1
       ORDER BY created_at DESC LIMIT 10`,
      [teamId]
    );

    res.json({
      success: true,
      data: { staffingHistory: result.rows },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
