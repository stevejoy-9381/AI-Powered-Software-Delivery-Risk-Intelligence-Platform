/**
 * Project Routes
 * CRUD operations for projects.
 */
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);

// ── GET /api/projects ──────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { organizationId, status, teamId } = req.query;
    const query = {};
    if (organizationId) query.organizationId = organizationId;
    if (status) query.status = status;
    if (teamId) query.teamId = teamId;

    const projects = await Project.find(query)
      .populate('teamId', 'name')
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: { projects } });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/projects/:id ──────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('teamId', 'name members')
      .populate('sprints');

    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found.' },
      });
    }

    res.json({ success: true, data: { project } });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/projects ─────────────────────────────────────
router.post('/', requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const project = await Project.create(req.body);
    res.status(201).json({ success: true, data: { project } });
  } catch (error) {
    next(error);
  }
});

// ── PUT /api/projects/:id ──────────────────────────────────
router.put('/:id', requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found.' },
      });
    }

    res.json({ success: true, data: { project } });
  } catch (error) {
    next(error);
  }
});

// ── DELETE /api/projects/:id ───────────────────────────────
router.delete('/:id', requireRole(['admin']), async (req, res, next) => {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found.' },
      });
    }
    res.json({ success: true, data: { message: 'Project deleted.' } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
