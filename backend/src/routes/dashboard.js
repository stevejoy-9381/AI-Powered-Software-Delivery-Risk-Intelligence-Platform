/**
 * Dashboard Routes
 * Lightweight summary endpoints for the frontend dashboard widgets.
 */
const express = require('express');
const router = express.Router();
const Sprint = require('../models/Sprint');
const Team = require('../models/Team');
const Project = require('../models/Project');
const PullRequest = require('../models/PullRequest');
const { verifyToken } = require('../middleware/auth');

router.use(verifyToken);

// ── GET /api/dashboard/summary ─────────────────────────────
router.get('/summary', async (req, res, next) => {
  try {
    const orgId = req.user.organizationId;
    const query = orgId ? { organizationId: orgId } : {};

    const [teams, projects] = await Promise.all([
      Team.find({ ...query, isActive: true }),
      Project.find({ isActive: true }),
    ]);

    const teamIds = teams.map((t) => t._id);
    const projectIds = projects
      .filter((p) => teamIds.some((tid) => tid.equals(p.teamId)))
      .map((p) => p._id);

    const activeSprints = await Sprint.find({
      projectId: { $in: projectIds },
      status: 'active',
    });

    const atRisk = activeSprints.filter((s) =>
      s.riskLevel === 'high' || s.riskLevel === 'critical'
    ).length;

    const recentPRs = await PullRequest.find({
      projectId: { $in: projectIds },
      status: 'open',
    }).sort({ createdAt: -1 }).limit(5);

    res.json({
      success: true,
      data: {
        teamCount: teams.length,
        projectCount: projects.length,
        activeSprintCount: activeSprints.length,
        atRiskCount: atRisk,
        recentOpenPRs: recentPRs.map((pr) => ({
          id: pr._id,
          title: pr.title,
          author: pr.author,
          riskFlags: pr.riskFlags,
          createdAt: pr.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
