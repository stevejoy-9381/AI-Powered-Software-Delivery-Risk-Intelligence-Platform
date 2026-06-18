/**
 * GitHub Integration Routes
 * Handles syncing GitHub data, analyzing PRs, and hotspot detection.
 */
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Sprint = require('../models/Sprint');
const PullRequest = require('../models/PullRequest');
const { verifyToken, requireRole } = require('../middleware/auth');
const GitHubService = require('../services/githubService');
const mlService = require('../services/mlService');
const { getPostgresPool } = require('../config/db');

router.use(verifyToken);

/**
 * Parse "owner/repo" from a GitHub repo string.
 */
function parseRepo(repoStr) {
  if (!repoStr) return null;
  // Handle full URLs or owner/repo format
  const match = repoStr.match(/(?:github\.com\/)?([^/]+)\/([^/\s]+)/);
  if (match) return { owner: match[1], repo: match[2].replace('.git', '') };
  return null;
}

// ── POST /api/github/sync/:projectId ───────────────────────
router.post('/sync/:projectId', requireRole(['admin', 'manager']), async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found.' },
      });
    }

    const parsed = parseRepo(project.githubRepo);
    if (!parsed) {
      return res.status(400).json({
        success: false,
        error: { message: 'Project has no valid GitHub repo configured.' },
      });
    }

    // Get the user's GitHub token (from OAuth or request header)
    let githubToken = req.headers['x-github-token'] || req.user?.githubAccessToken;
    if (!githubToken && process.env.NODE_ENV === 'development') {
      githubToken = 'dummy-token';
    }
    if (!githubToken) {
      return res.status(400).json({
        success: false,
        error: { message: 'GitHub access token required. Provide via x-github-token header.' },
      });
    }

    const { owner, repo } = parsed;

    // Find the active sprint for this project
    const activeSprint = await Sprint.findOne({
      projectId: project._id,
      status: 'active',
    });

    if (!activeSprint) {
      return res.status(404).json({
        success: false,
        error: { message: 'No active sprint found for this project.' },
      });
    }

    let commits = [];
    let prs = [];

    if (githubToken === 'dummy-token') {
      // Mock GitHub API data in development
      const authorName = req.user?.githubUsername || 'developer-demo';
      commits = [
        {
          sha: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0',
          author: authorName,
          message: 'feat: implement oauth login logic and check tokens',
          additions: 120,
          deletions: 15,
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
          sha: 'b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1',
          author: authorName,
          message: 'fix: billing webhook signature verification error',
          additions: 45,
          deletions: 2,
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        },
        {
          sha: 'c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1b2',
          author: 'senior-dev-demo',
          message: 'test: add unit tests for authentication logic',
          additions: 85,
          deletions: 5,
          date: new Date(Date.now() - 12 * 60 * 60 * 1000)
        },
        {
          sha: 'd4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0a1b2c3',
          author: authorName,
          message: 'refactor: extract api client to a shared module',
          additions: 250,
          deletions: 180,
          date: new Date(Date.now() - 2 * 60 * 60 * 1000)
        }
      ];

      prs = [
        {
          number: 101,
          title: 'feat: implement oauth login logic and check tokens',
          body: 'Adds passport strategies for oauth integration. Touches auth logic and db models.',
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          mergedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          closedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          additions: 120,
          deletions: 15,
          changedFiles: 3,
          state: 'merged',
          author: authorName,
          reviewers: ['senior-dev-demo'],
          _mockFiles: [
            { filename: 'src/auth/login.js', additions: 90, deletions: 5, status: 'modified' },
            { filename: 'src/routes/auth.js', additions: 15, deletions: 2, status: 'modified' },
            { filename: 'src/services/payment.js', additions: 15, deletions: 8, status: 'modified' }
          ],
          _mockReviews: [
            { name: 'senior-dev-demo', status: 'approved', reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
          ]
        },
        {
          number: 102,
          title: 'fix: billing webhook signature verification error',
          body: 'Corrects key retrieval for checking payment signatures.',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          mergedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
          closedAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
          additions: 45,
          deletions: 2,
          changedFiles: 2,
          state: 'merged',
          author: authorName,
          reviewers: ['lead-dev-demo'],
          _mockFiles: [
            { filename: 'src/routes/billing.js', additions: 40, deletions: 2, status: 'modified' },
            { filename: 'src/services/payment.js', additions: 5, deletions: 0, status: 'modified' }
          ],
          _mockReviews: [
            { name: 'lead-dev-demo', status: 'approved', reviewedAt: new Date(Date.now() - 21 * 60 * 60 * 1000) }
          ]
        },
        {
          number: 103,
          title: 'refactor: extract api client to a shared module',
          body: 'Improves reusability of http client and sets proper authorization header.',
          createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          mergedAt: null,
          closedAt: null,
          additions: 250,
          deletions: 180,
          changedFiles: 4,
          state: 'open',
          author: authorName,
          reviewers: ['senior-dev-demo'],
          _mockFiles: [
            { filename: 'src/utils/api.ts', additions: 150, deletions: 10, status: 'modified' },
            { filename: 'src/pages/AnalyticsPage.tsx', additions: 40, deletions: 80, status: 'modified' },
            { filename: 'src/pages/SettingsPage.tsx', additions: 30, deletions: 60, status: 'modified' },
            { filename: 'src/pages/DashboardPage.tsx', additions: 30, deletions: 30, status: 'modified' }
          ],
          _mockReviews: []
        }
      ];
    } else {
      const github = new GitHubService(githubToken);

      // Fetch commits since sprint start
      commits = await github.getRepoCommits(
        owner, repo,
        activeSprint.startDate.toISOString(),
        activeSprint.endDate.toISOString()
      );

      // Fetch PRs since sprint start
      prs = await github.getRepoPullRequests(
        owner, repo, 'all',
        activeSprint.startDate.toISOString()
      );
    }

    // Update sprint with commits
    let commitsAdded = 0;
    for (const commit of commits) {
      const exists = activeSprint.commits.some((c) => c.sha === commit.sha);
      if (!exists) {
        activeSprint.commits.push({
          sha: commit.sha,
          author: commit.author,
          message: commit.message,
          additions: commit.additions,
          deletions: commit.deletions,
          filesChanged: 0,
          timestamp: commit.date || new Date(),
        });
        commitsAdded++;
      }
    }

    // Update sprint with PRs + create/update PullRequest documents
    let prsAdded = 0;
    for (const pr of prs) {
      const existingPR = await PullRequest.findOne({
        projectId: project._id,
        githubPrNumber: pr.number,
      });

      // Fetch files changed in this PR
      let filesChanged = [];
      let reviews = [];

      if (pr._mockFiles) {
        filesChanged = pr._mockFiles.map((f) => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          changeType: f.status,
        }));
        reviews = pr._mockReviews || [];
      } else {
        const github = new GitHubService(githubToken);
        const files = await github.getPRFiles(owner, repo, pr.number);
        filesChanged = files.map((f) => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          changeType: f.status,
        }));
        reviews = await github.getPRReviews(owner, repo, pr.number);
      }

      // Calculate real review lag (hours from creation to first review)
      let reviewLagHours = null;
      if (reviews && reviews.length > 0) {
        const sortedReviews = [...reviews].sort((a, b) => new Date(a.reviewedAt) - new Date(b.reviewedAt));
        const firstReview = sortedReviews[0];
        const created = new Date(pr.createdAt);
        const firstReviewDate = new Date(firstReview.reviewedAt);
        reviewLagHours = Math.max(0, (firstReviewDate - created) / (1000 * 60 * 60));
      } else if (pr.mergedAt) {
        // Fallback to merge time if no review comments exist
        const created = new Date(pr.createdAt);
        const merged = new Date(pr.mergedAt);
        reviewLagHours = (merged - created) / (1000 * 60 * 60);
      }

      if (!existingPR) {
        const newPR = await PullRequest.create({
          sprintId: activeSprint._id,
          projectId: project._id,
          githubPrNumber: pr.number,
          title: pr.title,
          description: pr.body || '',
          author: pr.author,
          additions: pr.additions,
          deletions: pr.deletions,
          status: pr.state,
          mergedAt: pr.mergedAt,
          closedAt: pr.closedAt,
          reviewLagHours,
          filesChanged,
          reviewers: reviews,
        });

        // Add PR summary to sprint
        activeSprint.pullRequests.push({
          prId: newPR._id,
          title: pr.title,
          status: pr.state,
          author: pr.author,
        });
        prsAdded++;
      } else {
        // Update existing PR
        existingPR.status = pr.state;
        existingPR.additions = pr.additions;
        existingPR.deletions = pr.deletions;
        existingPR.mergedAt = pr.mergedAt;
        existingPR.closedAt = pr.closedAt;
        existingPR.filesChanged = filesChanged;
        existingPR.reviewers = reviews;
        if (reviewLagHours !== null) existingPR.reviewLagHours = reviewLagHours;
        await existingPR.save();
      }
    }

    // Recompute sprint metrics
    activeSprint.commitFrequency =
      activeSprint.commits.length /
      Math.max(
        Math.ceil((new Date() - new Date(activeSprint.startDate)) / (1000 * 60 * 60 * 24)),
        1
      );

    const totalAdditions = activeSprint.commits.reduce((s, c) => s + (c.additions || 0), 0);
    const totalDeletions = activeSprint.commits.reduce((s, c) => s + (c.deletions || 0), 0);
    activeSprint.codeChurnRate = (totalAdditions + totalDeletions) / Math.max(totalAdditions, 1);

    await activeSprint.save();

    res.json({
      success: true,
      data: {
        synced: true,
        commitsAdded,
        prsAdded,
        totalCommits: activeSprint.commits.length,
        totalPRs: activeSprint.pullRequests.length,
        lastSyncAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/github/analyze-pr/:prId ──────────────────────
router.post('/analyze-pr/:prId', async (req, res, next) => {
  try {
    const pr = await PullRequest.findById(req.params.prId);
    if (!pr) {
      return res.status(404).json({
        success: false,
        error: { message: 'Pull request not found.' },
      });
    }

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

    // Call ML service
    const summary = await mlService.analyzePR(prData);

    if (summary) {
      // Update PR document with LLM analysis
      pr.llmSummary = summary.summary || '';
      pr.riskFlags = summary.risk_flags || [];
      pr.touchesAuthLogic = summary.touches_auth || false;
      await pr.save();
    }

    res.json({
      success: true,
      data: {
        summary: summary?.summary || 'Analysis unavailable.',
        riskLevel: summary?.risk_level || 'unknown',
        riskFlags: summary?.risk_flags || [],
        touchesAuth: summary?.touches_auth || false,
        touchesPayments: summary?.touches_payments || false,
        scopeAssessment: summary?.scope_assessment || 'unknown',
        reviewerNote: summary?.reviewer_note || '',
        cached: summary?.cached || false,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/github/analyze-hotspots/:projectId ───────────
router.get('/analyze-hotspots/:projectId', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: { message: 'Project not found.' },
      });
    }

    // Get files from recent PRs for this project
    const recentPRs = await PullRequest.find({
      projectId: project._id,
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    // Aggregate file data
    const fileMap = {};
    for (const pr of recentPRs) {
      for (const file of (pr.filesChanged || [])) {
        const path = file.filename;
        if (!fileMap[path]) {
          fileMap[path] = {
            file_path: path,
            churn_count: 0,
            has_tests: false,
            test_coverage_percent: null,
            authors_count: 0,
            is_critical_path: false,
            last_modified_days_ago: 30,
            _authors: new Set(),
            _additions: 0,
            _deletions: 0,
          };
        }
        fileMap[path].churn_count++;
        fileMap[path]._authors.add(pr.author);
        fileMap[path]._additions += file.additions || 0;
        fileMap[path]._deletions += file.deletions || 0;
 
        // Detect critical path files
        const criticalPattern = /auth|payment|billing|security|session|token|core/i;
        if (criticalPattern.test(path)) {
          fileMap[path].is_critical_path = true;
        }
 
        // Detect test files
        const testPattern = /\.(test|spec)\.(js|ts|py|jsx|tsx)$|__tests__|test_/i;
        if (testPattern.test(path)) {
          fileMap[path].has_tests = true;
        }
      }
    }

    // Call real GitHub API if available
    const parsed = parseRepo(project.githubRepo);
    let githubToken = req.headers['x-github-token'] || req.user?.githubAccessToken;
    if (!githubToken && process.env.NODE_ENV === 'development') {
      githubToken = 'dummy-token';
    }

    if (parsed && githubToken && githubToken !== 'dummy-token') {
      try {
        const github = new GitHubService(githubToken);
        const { owner, repo } = parsed;
        const churnData = await github.getChurnData(owner, repo, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        for (const file of churnData) {
          const path = file.filename;
          if (!fileMap[path]) {
            fileMap[path] = {
              file_path: path,
              churn_count: file.commitsCount,
              has_tests: false,
              test_coverage_percent: null,
              authors_count: 1,
              is_critical_path: false,
              last_modified_days_ago: 5,
              _authors: new Set(['developer']),
              _additions: file.additions,
              _deletions: file.deletions,
            };
          } else {
            fileMap[path].churn_count = Math.max(fileMap[path].churn_count, file.commitsCount);
            fileMap[path]._additions += file.additions;
            fileMap[path]._deletions += file.deletions;
          }

          // Detect critical path files
          const criticalPattern = /auth|payment|billing|security|session|token|core/i;
          if (criticalPattern.test(path)) {
            fileMap[path].is_critical_path = true;
          }

          // Detect test files
          const testPattern = /\.(test|spec)\.(js|ts|py|jsx|tsx)$|__tests__|test_/i;
          if (testPattern.test(path)) {
            fileMap[path].has_tests = true;
          }
        }
      } catch (err) {
        console.warn('⚠️ Real GitHub churn integration failed:', err.message);
      }
    }
 
    // Finalize file data
    const filesData = Object.values(fileMap).map((f) => {
      f.authors_count = f._authors.size;
      
      // Heuristic Complexity Score Calculation (0-100)
      let baseComplexity = 10; // default for config/text files
      const codePattern = /\.(js|ts|py|go|java|cpp|h|cs|rs|rb|php|scala)$/i;
      const isCodeFile = codePattern.test(f.file_path);
      
      if (isCodeFile) {
        baseComplexity = 30; // base score for code files
        // scale based on total additions (approximates file size/volume of changes)
        const sizeFactor = Math.min(50, (f._additions || 0) / 10);
        baseComplexity += sizeFactor;
      }
      
      // Add folder nesting depth factor: depth * 5 (up to 20)
      const pathParts = f.file_path.split('/');
      const nestingDepth = Math.max(0, pathParts.length - 1);
      const nestingFactor = Math.min(20, nestingDepth * 5);
      
      f.complexity_score = baseComplexity + nestingFactor;

      delete f._authors;
      delete f._additions;
      delete f._deletions;
      return f;
    });
 
    if (filesData.length === 0) {
      return res.json({
        success: true,
        data: { hotspots: [], message: 'No file data available for analysis.' },
      });
    }
 
    // Call ML service
    const result = await mlService.analyzeHotspots(filesData);
 
    // Save hotspots to PostgreSQL
    if (result?.hotspots) {
      try {
        const pool = getPostgresPool();
        for (const hotspot of result.hotspots.slice(0, 50)) {
          await pool.query(
            `INSERT INTO codebase_hotspots
              (project_id, file_path, churn_count, has_tests, test_coverage_percent,
               authors_count, hotspot_score, complexity_score, flagged)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT DO NOTHING`,
            [
              project._id.toString(),
              hotspot.file_path,
              hotspot.breakdown?.churn_score ? Math.round(hotspot.breakdown.churn_score) : 0,
              hotspot.breakdown?.test_penalty === 0,
              null,
              Math.round(hotspot.breakdown?.authors_score || 0),
              hotspot.hotspot_score,
              hotspot.breakdown?.complexity_score || 0,
              hotspot.is_hotspot,
            ]
          );
        }
      } catch (pgError) {
        console.warn('⚠️ Failed to save hotspots to PostgreSQL:', pgError.message);
      }
    }

    // Return top 10
    const top10 = (result?.hotspots || []).slice(0, 10);

    res.json({
      success: true,
      data: {
        totalFilesAnalyzed: result?.total_files_analyzed || 0,
        hotspotCount: result?.hotspot_count || 0,
        hotspots: top10,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
