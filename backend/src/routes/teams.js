/**
 * Team Routes
 * CRUD operations for teams.
 */
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);

// ── GET /api/teams ─────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { organizationId } = req.query;
    const query = {};
    if (organizationId) query.organizationId = organizationId;

    const teams = await Team.find(query)
      .populate('managerId', 'name email')
      .populate('members.userId', 'name email githubUsername')
      .sort({ name: 1 });

    res.json({ success: true, data: { teams } });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/teams/:id ─────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('managerId', 'name email')
      .populate('members.userId', 'name email githubUsername avatar');

    if (!team) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team not found.' },
      });
    }

    res.json({ success: true, data: { team } });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/teams ────────────────────────────────────────
router.post('/', requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const team = await Team.create(req.body);
    res.status(201).json({ success: true, data: { team } });
  } catch (error) {
    next(error);
  }
});

// ── PUT /api/teams/:id ─────────────────────────────────────
router.put('/:id', requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const team = await Team.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!team) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team not found.' },
      });
    }

    res.json({ success: true, data: { team } });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/teams/:id/members ────────────────────────────
router.post('/:id/members', requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const { userId, role } = req.body;
    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: { message: 'Team not found.' },
      });
    }

    // Check if member already exists
    const existing = team.members.find(
      (m) => m.userId?.toString() === userId
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { message: 'User is already a member of this team.' },
      });
    }

    team.members.push({ userId, role: role || 'mid' });
    await team.save();

    res.json({ success: true, data: { team } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
