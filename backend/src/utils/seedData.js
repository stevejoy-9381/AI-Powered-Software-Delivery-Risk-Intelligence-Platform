/**
 * Synthetic Data Generator — seedData.js
 * 
 * Generates and inserts realistic fake data into MongoDB and PostgreSQL:
 *   - 3 organizations
 *   - 5 teams per organization (15 total)
 *   - 3-5 projects per team
 *   - 8-12 sprints per project (mix of completed + 1 active)
 *   - 5-15 pull requests per sprint
 *   - Realistic ML feature data into PostgreSQL
 * 
 * Usage: npm run seed
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env.example') });

const mongoose = require('mongoose');
const { Pool } = require('pg');

// Import models
const Organization = require('../models/Organization');
const Team = require('../models/Team');
const User = require('../models/User');
const Project = require('../models/Project');
const Sprint = require('../models/Sprint');
const PullRequest = require('../models/PullRequest');

// ═══════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/delivery_risk_db';
const POSTGRES_URI = process.env.POSTGRES_URI || 'postgresql://drp_user:drp_secret_2024@localhost:5432/ml_feature_store';

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/** Get random integer between min and max (inclusive) */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Get random float between min and max */
function randFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

/** Pick random element from array */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick N random elements from array */
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(n, arr.length));
}

/** Generate random SHA-like hash */
function randomSha() {
  return Array.from({ length: 40 }, () =>
    '0123456789abcdef'[Math.floor(Math.random() * 16)]
  ).join('');
}

/** Add days to a date */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Introduce 5% null values to simulate missing data */
function maybeMissing(value, missingRate = 0.05) {
  return Math.random() < missingRate ? null : value;
}

// ═══════════════════════════════════════════════════════════
// SEED DATA DEFINITIONS
// ═══════════════════════════════════════════════════════════

const ORG_DEFS = [
  {
    name: 'TechCorp',
    industry: 'technology',
    size: 'large',
    githubOrg: 'techcorp',
    jiraWorkspace: 'techcorp-jira',
    description: 'Enterprise software solutions company specializing in cloud infrastructure',
  },
  {
    name: 'CloudSystems',
    industry: 'saas',
    size: 'medium',
    githubOrg: 'cloudsystems',
    jiraWorkspace: 'cloudsystems-jira',
    description: 'Cloud-native SaaS platform for business automation',
  },
  {
    name: 'DataWorks',
    industry: 'technology',
    size: 'medium',
    githubOrg: 'dataworks',
    jiraWorkspace: 'dataworks-jira',
    description: 'Data analytics and machine learning platform',
  },
];

const TEAM_NAMES = [
  'Platform Core', 'Frontend Experience', 'Data Pipeline', 'Mobile Squad', 'DevOps & SRE',
  'API Gateway', 'Search & Discovery', 'Payments', 'Auth & Security', 'Growth Engineering',
  'Infrastructure', 'AI/ML Platform', 'Notifications', 'Analytics', 'Developer Tools',
];

const FIRST_NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Drew',
  'Jamie', 'Avery', 'Skyler', 'Dakota', 'Cameron', 'Reese', 'Emerson',
  'Blake', 'Hayden', 'Parker', 'Sage', 'Rowan', 'Charlie', 'Sam', 'Max',
  'Jesse', 'Kai', 'Phoenix', 'River', 'Ash', 'Robin', 'Lee',
  'Priya', 'Ananya', 'Ravi', 'Wei', 'Yuki', 'Omar', 'Fatima', 'Ines',
  'Liam', 'Emma', 'Noah', 'Olivia', 'Lucas', 'Sophia', 'Aiden', 'Mia',
];

const LAST_NAMES = [
  'Chen', 'Patel', 'Kim', 'Singh', 'Mueller', 'Santos', 'Anderson', 'Thompson',
  'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee',
  'Walker', 'Hall', 'Young', 'Allen', 'Wright', 'Lopez', 'Green', 'Adams',
  'Baker', 'Nelson', 'Hill', 'Moore', 'Jackson', 'Martin', 'White',
];

const TECH_STACKS = [
  ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
  ['Python', 'FastAPI', 'Redis', 'MongoDB'],
  ['Go', 'gRPC', 'Kubernetes', 'PostgreSQL'],
  ['React Native', 'TypeScript', 'GraphQL', 'DynamoDB'],
  ['Java', 'Spring Boot', 'Kafka', 'MySQL'],
  ['Vue.js', 'Python', 'Django', 'PostgreSQL'],
  ['Rust', 'WebAssembly', 'Node.js', 'ClickHouse'],
  ['Swift', 'Kotlin', 'Firebase', 'Cloud Functions'],
];

const PROJECT_NAMES = [
  'User Dashboard Redesign', 'Payment Gateway v2', 'Search Indexer', 'Auth Service',
  'Mobile App Rewrite', 'Data Pipeline Refactor', 'API Rate Limiter', 'CDN Integration',
  'Notification Hub', 'Analytics Engine', 'ML Feature Store', 'CI/CD Pipeline',
  'Customer Portal', 'Admin Console', 'Metrics Collector', 'Event Streaming',
  'Recommendation Engine', 'A/B Testing Framework', 'Billing Microservice', 'Chat Integration',
  'File Storage Service', 'Workflow Automation', 'Compliance Dashboard', 'Performance Monitor',
];

const PROJECT_DOMAINS = [
  'payments', 'infrastructure', 'user-experience', 'data', 'security',
  'mobile', 'devops', 'analytics', 'communication', 'compliance',
];

const COMMIT_MESSAGES = [
  'feat: add user authentication flow',
  'fix: resolve race condition in data processing',
  'refactor: extract service layer from controller',
  'chore: update dependencies to latest versions',
  'feat: implement real-time notifications',
  'fix: handle edge case in payment processing',
  'docs: update API documentation',
  'test: add unit tests for auth middleware',
  'feat: add rate limiting to public endpoints',
  'fix: memory leak in websocket handler',
  'refactor: migrate to new database schema',
  'feat: implement search autocomplete',
  'fix: correct timezone handling in reports',
  'perf: optimize database query performance',
  'feat: add CSV export functionality',
  'fix: resolve CORS issue in staging',
  'chore: configure CI pipeline for staging',
  'feat: implement role-based access control',
  'fix: prevent duplicate webhook deliveries',
  'feat: add dark mode support',
  'fix: handle concurrent updates safely',
  'refactor: simplify error handling logic',
  'feat: implement audit logging',
  'fix: correct pagination offset calculation',
  'test: add integration tests for payment flow',
  'feat: add two-factor authentication',
  'fix: resolve session timeout issues',
  'perf: add caching layer for frequent queries',
  'feat: implement file upload with progress',
  'fix: sanitize user input for XSS prevention',
];

const TICKET_TITLES = [
  'Implement user registration form', 'Fix login redirect loop', 'Add password reset flow',
  'Create dashboard overview page', 'Design team settings page', 'Build notification preferences',
  'Fix broken pagination on search results', 'Add export to CSV feature', 'Implement dark mode toggle',
  'Set up CI/CD pipeline for staging', 'Add request rate limiting', 'Fix memory leak in worker process',
  'Write API documentation for v2', 'Create database migration script', 'Add health check endpoint',
  'Implement webhook retry logic', 'Fix date formatting in reports', 'Add unit tests for auth service',
  'Build admin user management page', 'Fix race condition in order processing',
  'Implement SSO integration', 'Add audit trail for admin actions', 'Fix broken mobile layout',
  'Optimize image loading performance', 'Create onboarding wizard', 'Add search filters and sorting',
  'Implement data retention policy', 'Fix CORS configuration for CDN', 'Add error tracking integration',
  'Build team analytics dashboard',
];

const PR_TITLES = [
  'feat: implement OAuth2 authentication flow',
  'fix: resolve database connection pooling issue',
  'refactor: modularize payment processing pipeline',
  'feat: add real-time dashboard updates via WebSocket',
  'fix: patch XSS vulnerability in user input handling',
  'feat: implement role-based access control system',
  'chore: upgrade Node.js to v20 LTS',
  'feat: add comprehensive audit logging',
  'fix: correct calculation in billing summary',
  'feat: implement file upload with chunked transfer',
  'refactor: migrate from REST to GraphQL for internal APIs',
  'fix: handle concurrent write conflicts gracefully',
  'feat: add multi-tenant support to data layer',
  'test: add E2E tests for critical user flows',
  'feat: implement automated backup system',
  'fix: resolve memory leak in event listener',
  'feat: add SSO support with SAML 2.0',
  'perf: optimize query performance with materialized views',
  'feat: implement webhook delivery system',
  'fix: correct timezone handling across services',
];

const FILE_PATHS = [
  'src/controllers/authController.js', 'src/services/paymentService.js',
  'src/models/User.js', 'src/middleware/auth.js', 'src/routes/api.js',
  'src/utils/validators.js', 'src/config/database.js', 'src/workers/emailWorker.js',
  'src/services/notificationService.js', 'src/controllers/orderController.js',
  'tests/auth.test.js', 'tests/payment.test.js', 'src/utils/crypto.js',
  'src/middleware/rateLimit.js', 'src/services/cacheService.js',
  'src/models/Order.js', 'src/controllers/userController.js', 'src/config/redis.js',
  'src/services/searchService.js', 'src/utils/logger.js',
  'src/components/Dashboard.tsx', 'src/components/LoginForm.tsx',
  'src/hooks/useAuth.ts', 'src/pages/Settings.tsx', 'src/types/api.ts',
];

const RISK_FACTORS = [
  'High percentage of tickets still in "To Do" with sprint ending soon',
  'PR review lag has increased 60% compared to team average',
  'Scope creep detected: 5 tickets added mid-sprint',
  'Key contributor has been reassigned to another project',
  'Commit frequency dropped sharply in the last 3 days',
  'Multiple tickets have been reopened after testing',
  'Critical dependency on external team not yet delivered',
  'Code churn rate is abnormally high (35%) indicating instability',
  'No unit tests added for new features in this sprint',
  'Sprint velocity is 40% below the team\'s 3-sprint average',
  'Blocked tickets account for 25% of planned story points',
  'Team capacity reduced due to PTO/sick leave',
  'Complex database migration required before feature freeze',
  'Integration tests failing on staging environment',
  'Technical debt items consuming 30% of sprint capacity',
];

const REVIEWER_NAMES = [
  'alex-chen', 'jordan-patel', 'taylor-kim', 'morgan-singh', 'casey-mueller',
  'riley-santos', 'quinn-anderson', 'drew-thompson', 'jamie-garcia', 'avery-martinez',
];

// ═══════════════════════════════════════════════════════════
// DATA GENERATION FUNCTIONS
// ═══════════════════════════════════════════════════════════

/** Generate users for a team */
function generateUsers(orgId, orgName, count) {
  const users = [];
  const usedNames = new Set();

  for (let i = 0; i < count; i++) {
    let firstName, lastName, fullName;
    do {
      firstName = pick(FIRST_NAMES);
      lastName = pick(LAST_NAMES);
      fullName = `${firstName} ${lastName}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);

    const domain = orgName.toLowerCase().replace(/[^a-z0-9]/g, '');

    users.push({
      name: fullName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}.com`,
      password: 'hashedpassword123', // Will be hashed by pre-save hook
      role: i === 0 ? 'manager' : pick(['developer', 'developer', 'developer', 'admin']),
      githubUsername: `${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}${lastName}`,
      organizationId: orgId,
    });
  }
  return users;
}

/** Generate tickets for a sprint */
function generateTickets(teamMembers, sprintStatus, plannedPoints) {
  const ticketCount = randInt(6, 15);
  const tickets = [];
  const avgPoints = Math.max(1, Math.round(plannedPoints / ticketCount));

  for (let i = 0; i < ticketCount; i++) {
    const points = Math.max(1, avgPoints + randInt(-2, 3));
    let status;

    if (sprintStatus === 'completed') {
      // 70-90% done, rest in various states
      const roll = Math.random();
      if (roll < 0.75) status = 'done';
      else if (roll < 0.85) status = 'in_review';
      else if (roll < 0.92) status = 'in_progress';
      else status = pick(['blocked', 'reopened', 'todo']);
    } else if (sprintStatus === 'active') {
      // Active sprint: mix of statuses
      status = pick(['todo', 'todo', 'in_progress', 'in_progress', 'in_progress', 'in_review', 'done', 'done', 'blocked']);
    } else {
      status = 'todo';
    }

    const addedMidSprint = Math.random() < 0.15; // 15% scope creep
    const reopenedCount = Math.random() < 0.1 ? randInt(1, 3) : 0;

    tickets.push({
      ticketId: `TICK-${randInt(1000, 9999)}`,
      title: pick(TICKET_TITLES),
      status,
      assignee: teamMembers.length > 0 ? pick(teamMembers) : 'unassigned',
      storyPoints: points,
      priority: pick(['critical', 'high', 'high', 'medium', 'medium', 'medium', 'low']),
      labels: pickN(['frontend', 'backend', 'database', 'devops', 'bug', 'feature', 'tech-debt', 'security'], randInt(1, 3)),
      addedMidSprint,
      reopenedCount,
      createdAt: new Date(),
      completedAt: status === 'done' ? new Date() : undefined,
    });
  }
  return tickets;
}

/** Generate commits for a sprint */
function generateCommits(teamMembers, startDate, endDate, isDelayed) {
  const sprintDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  // Delayed sprints often have commit drops mid-sprint
  const commitsPerDay = isDelayed ? randInt(2, 6) : randInt(5, 15);
  const totalCommits = commitsPerDay * sprintDays;
  const commits = [];

  for (let i = 0; i < Math.min(totalCommits, 80); i++) { // cap at 80 per sprint
    const dayOffset = randInt(0, sprintDays - 1);
    const commitDate = addDays(startDate, dayOffset);

    // Simulate commit drop mid-sprint for delayed sprints
    if (isDelayed && dayOffset > sprintDays * 0.6 && Math.random() < 0.4) {
      continue; // Skip some commits to create a drop pattern
    }

    commits.push({
      sha: randomSha(),
      author: teamMembers.length > 0 ? pick(teamMembers) : 'unknown',
      message: pick(COMMIT_MESSAGES),
      filesChanged: randInt(1, 12),
      additions: randInt(5, 300),
      deletions: randInt(0, 150),
      timestamp: commitDate,
    });
  }
  return commits;
}

/** Generate pull requests for a sprint */
function generatePullRequests(sprintId, projectId, teamMembers, startDate, endDate, sprintStatus) {
  const prCount = randInt(5, 15);
  const prs = [];

  for (let i = 0; i < prCount; i++) {
    const author = teamMembers.length > 0 ? pick(teamMembers) : 'unknown-dev';
    const createdAt = addDays(startDate, randInt(0, 12));
    const filesCount = randInt(1, 8);

    // Generate changed files
    const filesChanged = pickN(FILE_PATHS, filesCount).map((fp) => ({
      filename: fp,
      additions: randInt(5, 200),
      deletions: randInt(0, 100),
      changeType: pick(['modified', 'modified', 'modified', 'added', 'deleted']),
    }));

    const additions = filesChanged.reduce((sum, f) => sum + f.additions, 0);
    const deletions = filesChanged.reduce((sum, f) => sum + f.deletions, 0);

    // Determine PR status based on sprint status
    let prStatus;
    if (sprintStatus === 'completed') {
      prStatus = Math.random() < 0.85 ? 'merged' : pick(['closed', 'open']);
    } else {
      prStatus = pick(['open', 'open', 'merged', 'draft']);
    }

    // Generate reviewers (some PRs have no reviewers — realistic gap)
    const hasReviewers = Math.random() > 0.12; // 12% have no reviewers
    const reviewers = hasReviewers
      ? pickN(REVIEWER_NAMES, randInt(1, 3)).map((name) => ({
          name,
          status: pick(['approved', 'approved', 'changes_requested', 'pending', 'commented']),
          reviewedAt: addDays(createdAt, randInt(0, 3)),
        }))
      : [];

    const reviewLagHours = hasReviewers ? randFloat(1, 72) : null;

    // Risk flags
    const riskFlags = [];
    if (additions + deletions > 500) riskFlags.push('large-diff');
    if (!filesChanged.some((f) => /test|spec/.test(f.filename))) riskFlags.push('no-tests');
    if (filesChanged.some((f) => /auth|login|session|token/.test(f.filename))) riskFlags.push('touches-auth');
    if (filesChanged.some((f) => /password|crypto|secret/.test(f.filename))) riskFlags.push('security-sensitive');
    if (additions + deletions > 800) riskFlags.push('mega-diff');

    prs.push({
      sprintId,
      projectId,
      githubPrNumber: randInt(100, 9999),
      title: pick(PR_TITLES),
      description: `This PR ${pick(['implements', 'fixes', 'refactors', 'adds', 'updates'])} ${pick(['the', 'our', 'a'])} ${pick(['authentication', 'payment', 'notification', 'search', 'data processing', 'API', 'dashboard', 'logging'])} ${pick(['system', 'module', 'service', 'component', 'pipeline'])}.`,
      author,
      filesChanged,
      additions,
      deletions,
      reviewers,
      reviewLagHours: maybeMissing(reviewLagHours),
      mergedAt: prStatus === 'merged' ? addDays(createdAt, randInt(1, 5)) : null,
      status: prStatus,
      riskFlags,
      llmSummary: '', // Will be generated by ML service later
      createdAt,
    });
  }
  return prs;
}

// ═══════════════════════════════════════════════════════════
// POSTGRESQL SEEDING
// ═══════════════════════════════════════════════════════════

async function seedPostgres(pgPool, sprints, teams, orgs, projects) {
  console.log('\n📊 Seeding PostgreSQL feature store...');

  // ── Sprint Features ────────────────────────────────────
  for (const sprint of sprints) {
    const isDelayed = sprint.wasDelayed;
    const commitFreq = isDelayed ? randFloat(2, 6) : randFloat(6, 15);
    const commitFreqChange = isDelayed ? randFloat(-50, -10) : randFloat(-15, 30);
    const prCycleTime = isDelayed ? randFloat(24, 96) : randFloat(4, 36);
    const prReviewLag = isDelayed ? randFloat(12, 72) : randFloat(2, 24);
    const prReviewLagChange = isDelayed ? randFloat(10, 80) : randFloat(-30, 20);
    const codeChurn = isDelayed ? randFloat(0.2, 0.45) : randFloat(0.05, 0.25);
    const ticketsReopened = isDelayed ? randInt(2, 6) : randInt(0, 2);
    const ticketsAddedMidSprint = isDelayed ? randInt(3, 8) : randInt(0, 3);
    const scopeCreep = ticketsAddedMidSprint > 3;
    const teamSize = randInt(4, 12);
    const velocityTrend = isDelayed ? randFloat(0.5, 0.85) : randFloat(0.85, 1.2);
    const blockedCount = isDelayed ? randInt(2, 5) : randInt(0, 2);
    const sentimentScore = isDelayed ? randFloat(-0.4, 0.1) : randFloat(0.1, 0.7);
    const riskScore = isDelayed ? randFloat(55, 95) : randFloat(5, 45);

    try {
      await pgPool.query(
        `INSERT INTO sprint_features 
         (sprint_id, team_id, commit_frequency, commit_frequency_change, 
          pr_cycle_time_avg_hours, pr_review_lag_avg_hours, pr_review_lag_change,
          code_churn_rate, tickets_reopened_count, tickets_added_mid_sprint,
          scope_creep_detected, team_size, planned_points, days_remaining,
          velocity_trend, blocked_tickets_count, sentiment_score, risk_score, was_delayed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (sprint_id) DO NOTHING`,
        [
          sprint._id.toString(), sprint.teamId.toString(),
          commitFreq, commitFreqChange, prCycleTime, prReviewLag, prReviewLagChange,
          codeChurn, ticketsReopened, ticketsAddedMidSprint, scopeCreep,
          teamSize, sprint.plannedPoints, 0, velocityTrend,
          blockedCount, sentimentScore, riskScore, isDelayed,
        ]
      );
    } catch (err) {
      console.warn(`  ⚠️ Sprint feature insert failed: ${err.message}`);
    }
  }
  console.log(`  ✅ Inserted ${sprints.length} sprint feature rows`);

  // ── Codebase Hotspots ──────────────────────────────────
  let hotspotCount = 0;
  for (const project of projects) {
    const fileCount = randInt(8, 20);
    for (let i = 0; i < fileCount; i++) {
      const churnCount = randInt(1, 45);
      const hasCoverage = Math.random() > 0.3;
      const coverage = hasCoverage ? randFloat(10, 95) : 0;
      const authorsCount = randInt(1, 8);
      // Hotspot score: higher churn + lower coverage + more authors = riskier
      const hotspotScore = Math.min(100,
        (churnCount / 45) * 40 + ((100 - coverage) / 100) * 35 + (authorsCount / 8) * 25
      );
      const flagged = hotspotScore > 60;

      try {
        await pgPool.query(
          `INSERT INTO codebase_hotspots 
           (project_id, file_path, churn_count, last_modified, has_tests, 
            test_coverage_percent, authors_count, hotspot_score, flagged)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            project._id.toString(), pick(FILE_PATHS),
            churnCount, addDays(new Date(), -randInt(1, 30)),
            hasCoverage, coverage, authorsCount,
            parseFloat(hotspotScore.toFixed(2)), flagged,
          ]
        );
        hotspotCount++;
      } catch (err) {
        // Ignore duplicate errors
      }
    }
  }
  console.log(`  ✅ Inserted ${hotspotCount} codebase hotspot rows`);

  // ── Team Benchmarks ────────────────────────────────────
  const periods = ['2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4', '2025-Q1', '2025-Q2'];
  let benchmarkCount = 0;

  for (const team of teams) {
    const orgId = team.organizationId.toString();
    for (const period of periods) {
      const deliveryScore = randFloat(40, 95);
      try {
        await pgPool.query(
          `INSERT INTO team_benchmarks 
           (team_id, organization_id, period, avg_sprint_delay_days, 
            on_time_delivery_rate, sprints_completed, avg_pr_cycle_time_hours,
            avg_churn_rate, avg_code_review_turnaround, delivery_health_score, percentile_rank)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           ON CONFLICT (team_id, period) DO NOTHING`,
          [
            team._id.toString(), orgId, period,
            randFloat(0, 5), randFloat(0.55, 0.98), randInt(2, 6),
            randFloat(4, 48), randFloat(0.05, 0.35), randFloat(2, 36),
            deliveryScore, randFloat(10, 95),
          ]
        );
        benchmarkCount++;
      } catch (err) {
        // Ignore duplicates
      }
    }
  }
  console.log(`  ✅ Inserted ${benchmarkCount} team benchmark rows`);

  // ── Risk Predictions ───────────────────────────────────
  let predictionCount = 0;
  for (const sprint of sprints) {
    const riskScore = sprint.wasDelayed ? randFloat(60, 98) : randFloat(5, 50);
    const confidence = randFloat(0.6, 0.95);
    const factors = sprint.wasDelayed
      ? pickN(RISK_FACTORS, randInt(2, 5)).map((f) => ({
          factor: f.split(':')[0] || f.substring(0, 30),
          severity: pick(['high', 'high', 'medium', 'critical']),
          description: f,
        }))
      : pickN(RISK_FACTORS, randInt(0, 2)).map((f) => ({
          factor: f.split(':')[0] || f.substring(0, 30),
          severity: pick(['low', 'medium']),
          description: f,
        }));

    try {
      await pgPool.query(
        `INSERT INTO risk_predictions 
         (sprint_id, predicted_risk_score, predicted_delay, confidence, risk_factors, staffing_recommendation)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [
          sprint._id.toString(), riskScore, sprint.wasDelayed,
          confidence, JSON.stringify(factors),
          sprint.wasDelayed
            ? pick([
                'Consider adding 1-2 developers to unblock critical path items',
                'Recommend splitting remaining work into a follow-up sprint',
                'Assign a senior engineer to mentor and unblock junior contributors',
                'Reduce scope by deferring non-critical features to next sprint',
              ])
            : 'No staffing changes needed — sprint is on track',
        ]
      );
      predictionCount++;
    } catch (err) {
      // Ignore errors
    }
  }
  console.log(`  ✅ Inserted ${predictionCount} risk prediction rows`);

  // ── Staffing Predictions ───────────────────────────────
  let staffingCount = 0;
  for (const team of teams) {
    const currentCapacity = randInt(4, 10);
    const requiredCapacity = currentCapacity + randInt(-1, 4);
    const shortage = Math.max(0, requiredCapacity - currentCapacity);

    try {
      await pgPool.query(
        `INSERT INTO staffing_predictions 
         (team_id, organization_id, current_capacity, required_capacity, 
          predicted_shortage, bottleneck_role, timeframe, confidence, recommendation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          team._id.toString(), team.organizationId.toString(),
          currentCapacity, requiredCapacity, shortage,
          shortage > 0 ? pick(['senior backend', 'frontend', 'DevOps', 'QA', 'full-stack']) : '',
          pick(['next sprint', 'next 2 sprints', 'next quarter']),
          randFloat(0.55, 0.92),
          shortage > 0
            ? `Team needs ${shortage} additional ${pick(['backend', 'frontend', 'full-stack'])} engineer(s) to meet upcoming commitments`
            : 'Team capacity is sufficient for planned work',
        ]
      );
      staffingCount++;
    } catch (err) {
      // Ignore errors
    }
  }
  console.log(`  ✅ Inserted ${staffingCount} staffing prediction rows`);
}

// ═══════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════

async function seed() {
  console.log('🌱 Starting data seed process...\n');

  // ── Connect to MongoDB ─────────────────────────────────
  console.log('📡 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('  ✅ MongoDB connected\n');

  // ── Connect to PostgreSQL ──────────────────────────────
  console.log('📡 Connecting to PostgreSQL...');
  const pgPool = new Pool({ connectionString: POSTGRES_URI });
  await pgPool.query('SELECT 1'); // Test connection
  console.log('  ✅ PostgreSQL connected\n');

  // ── Clear existing data ────────────────────────────────
  console.log('🗑️  Clearing existing data...');
  await Organization.deleteMany({});
  await Team.deleteMany({});
  await User.deleteMany({});
  await Project.deleteMany({});
  await Sprint.deleteMany({});
  await PullRequest.deleteMany({});
  await pgPool.query('TRUNCATE sprint_features, codebase_hotspots, team_benchmarks, risk_predictions, staffing_predictions CASCADE');
  console.log('  ✅ Existing data cleared\n');

  const allSprints = [];
  const allTeams = [];
  const allProjects = [];

  // ── Create Organizations ───────────────────────────────
  console.log('🏢 Creating organizations...');
  const orgs = await Organization.insertMany(ORG_DEFS);
  console.log(`  ✅ Created ${orgs.length} organizations`);

  let teamIndex = 0;
  let projectNameIndex = 0;

  for (const org of orgs) {
    // ── Create Users for this org ────────────────────────
    const userCount = randInt(20, 35);
    const userData = generateUsers(org._id, org.name, userCount);
    // Skip password hashing for seed data (use pre-hashed value)
    const users = await User.insertMany(
      userData.map((u) => ({ ...u, password: '$2a$12$LJ3EKNLHRkLfQ4Bp1VJ.2u3VhDqjKCv5TxE0kpUy6Y0XvXj4KFHGK' }))
    );
    console.log(`\n👥 Created ${users.length} users for ${org.name}`);

    // Create default demo admin user for local development login
    if (org.name === 'TechCorp') {
      await User.create({
        name: 'Demo Admin',
        email: 'admin@demo.com',
        password: 'Demo@123',
        role: 'admin',
        githubUsername: 'admin-demo',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DemoAdmin',
        organizationId: org._id,
      });
      console.log('🔑 Created default demo admin user: admin@demo.com / Demo@123');
    }

    const userNames = users.map((u) => u.githubUsername || u.name);

    // ── Create Teams ─────────────────────────────────────
    const teamsPerOrg = 5;
    for (let t = 0; t < teamsPerOrg; t++) {
      const teamMemberCount = randInt(4, 10);
      const teamUsers = pickN(users, teamMemberCount);

      const team = await Team.create({
        name: TEAM_NAMES[teamIndex % TEAM_NAMES.length],
        organizationId: org._id,
        managerId: teamUsers[0]._id,
        members: teamUsers.map((u, idx) => ({
          userId: u._id,
          role: idx === 0 ? 'lead' : pick(['senior', 'senior', 'mid', 'mid', 'mid', 'junior']),
          joinedAt: addDays(new Date(), -randInt(30, 365)),
        })),
        githubRepos: [`${org.githubOrg}/${TEAM_NAMES[teamIndex % TEAM_NAMES.length].toLowerCase().replace(/\s+/g, '-')}`],
        techStack: pick(TECH_STACKS),
        description: `${TEAM_NAMES[teamIndex % TEAM_NAMES.length]} team at ${org.name}`,
      });

      allTeams.push(team);
      console.log(`  🏗️  Team: ${team.name} (${teamMemberCount} members)`);

      const teamMemberNames = teamUsers.map((u) => u.githubUsername || u.name);

      // ── Create Projects ────────────────────────────────
      const projectsPerTeam = randInt(3, 5);
      for (let p = 0; p < projectsPerTeam; p++) {
        const projectStartDate = addDays(new Date(), -randInt(120, 400));
        const projectName = PROJECT_NAMES[projectNameIndex % PROJECT_NAMES.length];
        projectNameIndex++;

        const project = await Project.create({
          name: projectName,
          teamId: team._id,
          organizationId: org._id,
          type: pick(['service', 'product', 'library', 'infrastructure', 'internal-tool']),
          domain: pick(PROJECT_DOMAINS),
          githubRepo: `${org.githubOrg}/${projectName.toLowerCase().replace(/\s+/g, '-')}`,
          description: `${projectName} — a key ${pick(['initiative', 'project', 'deliverable'])} for the ${team.name} team`,
          startDate: projectStartDate,
          targetEndDate: addDays(projectStartDate, randInt(90, 300)),
          status: pick(['active', 'active', 'active', 'completed']),
          techStack: pick(TECH_STACKS),
          clientName: Math.random() < 0.4 ? pick(['Acme Corp', 'Globex Inc', 'Initech', 'Umbrella Co', 'Wayne Enterprises']) : '',
          criticality: randInt(1, 5),
        });

        allProjects.push(project);

        // ── Create Sprints ─────────────────────────────
        const sprintCount = randInt(8, 12);
        const sprintIds = [];
        let sprintStart = new Date(projectStartDate);

        for (let s = 0; s < sprintCount; s++) {
          const isLastSprint = s === sprintCount - 1;
          const sprintEnd = addDays(sprintStart, 14); // 2-week sprints
          const isActive = isLastSprint;
          const status = isActive ? 'active' : 'completed';

          // 30% of completed sprints were delayed
          const wasDelayed = !isActive && Math.random() < 0.3;
          const plannedPoints = randInt(20, 60);
          const completedPoints = isActive
            ? randInt(0, Math.floor(plannedPoints * 0.6))
            : wasDelayed
              ? randInt(Math.floor(plannedPoints * 0.5), Math.floor(plannedPoints * 0.85))
              : randInt(Math.floor(plannedPoints * 0.8), plannedPoints);

          const tickets = generateTickets(teamMemberNames, status, plannedPoints);
          const commits = generateCommits(teamMemberNames, sprintStart, sprintEnd, wasDelayed);

          // Compute sprint-level metrics
          const totalAdditions = commits.reduce((sum, c) => sum + c.additions, 0);
          const totalDeletions = commits.reduce((sum, c) => sum + c.deletions, 0);
          const sprintDays = 14;
          const commitFrequency = parseFloat((commits.length / sprintDays).toFixed(2));
          const codeChurnRate = parseFloat(
            ((totalAdditions + totalDeletions) / Math.max(1, totalAdditions)).toFixed(3)
          );

          // Risk scoring
          let riskScore = 0;
          if (wasDelayed) riskScore = randInt(55, 95);
          else if (isActive) riskScore = randInt(15, 65);
          else riskScore = randInt(5, 40);

          const riskLevel =
            riskScore >= 75 ? 'critical' :
            riskScore >= 50 ? 'high' :
            riskScore >= 25 ? 'medium' : 'low';

          const riskFactors = wasDelayed || riskScore > 50
            ? pickN(RISK_FACTORS, randInt(2, 4))
            : riskScore > 25
              ? pickN(RISK_FACTORS, randInt(0, 2))
              : [];

          const sprint = await Sprint.create({
            name: `Sprint ${s + 1}`,
            teamId: team._id,
            projectId: project._id,
            startDate: sprintStart,
            endDate: sprintEnd,
            status,
            plannedPoints,
            completedPoints,
            tickets,
            commits,
            pullRequests: [], // Will add PR refs after PR creation
            riskScore: maybeMissing(riskScore),
            riskLevel,
            riskFactors,
            actualShipDate: wasDelayed ? addDays(sprintEnd, randInt(1, 7)) : (isActive ? null : sprintEnd),
            wasDelayed,
            delayDays: wasDelayed ? randInt(1, 7) : 0,
            commitFrequency,
            codeChurnRate,
          });

          allSprints.push(sprint);
          sprintIds.push(sprint._id);

          // ── Create PRs for this sprint ─────────────
          const prDocs = generatePullRequests(
            sprint._id, project._id, teamMemberNames,
            sprintStart, sprintEnd, status
          );
          const insertedPRs = await PullRequest.insertMany(prDocs);

          // Update sprint with PR references
          await Sprint.findByIdAndUpdate(sprint._id, {
            pullRequests: insertedPRs.map((pr) => ({
              prId: pr._id,
              title: pr.title,
              status: pr.status,
              author: pr.author,
            })),
          });

          // Move to next sprint start
          sprintStart = addDays(sprintEnd, 1); // 1-day gap between sprints
        }

        // Update project with sprint IDs
        await Project.findByIdAndUpdate(project._id, { sprints: sprintIds });
        console.log(`    📋 Project: ${project.name} — ${sprintCount} sprints, ${sprintIds.length * randInt(5, 15)} PRs`);
      }

      teamIndex++;
    }
  }

  // ── Seed PostgreSQL ────────────────────────────────────
  await seedPostgres(pgPool, allSprints, allTeams, orgs, allProjects);

  // ── Summary ────────────────────────────────────────────
  const orgCount = await Organization.countDocuments();
  const teamCount = await Team.countDocuments();
  const userCount_final = await User.countDocuments();
  const projectCount = await Project.countDocuments();
  const sprintCount = await Sprint.countDocuments();
  const prCount = await PullRequest.countDocuments();

  console.log('\n' + '═'.repeat(50));
  console.log('🎉 SEED COMPLETE — Data Summary:');
  console.log('═'.repeat(50));
  console.log(`  Organizations:  ${orgCount}`);
  console.log(`  Teams:          ${teamCount}`);
  console.log(`  Users:          ${userCount_final}`);
  console.log(`  Projects:       ${projectCount}`);
  console.log(`  Sprints:        ${sprintCount}`);
  console.log(`  Pull Requests:  ${prCount}`);
  console.log('═'.repeat(50));

  // ── Cleanup ────────────────────────────────────────────
  await pgPool.end();
  await mongoose.connection.close();
  console.log('\n✅ Database connections closed. Seed complete!\n');
  process.exit(0);
}

// Run the seed
seed().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
