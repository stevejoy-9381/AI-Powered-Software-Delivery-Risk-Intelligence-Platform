// ============================================================
// MongoDB Initialization Script
// Runs on first container startup to create indexes and
// set up the database structure.
// ============================================================

// Switch to the application database
db = db.getSiblingDB('delivery_risk_db');

// ── Create collections with validation ──────────────────────

// Users collection
db.createCollection('users');
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ githubId: 1 }, { unique: true, sparse: true });

// Organizations collection
db.createCollection('organizations');
db.organizations.createIndex({ name: 1 }, { unique: true });

// Teams collection
db.createCollection('teams');
db.teams.createIndex({ organizationId: 1 });
db.teams.createIndex({ 'members.userId': 1 });

// Projects collection
db.createCollection('projects');
db.projects.createIndex({ teamId: 1 });
db.projects.createIndex({ organizationId: 1, status: 1 });

// Sprints collection
db.createCollection('sprints');
db.sprints.createIndex({ teamId: 1, status: 1 });
db.sprints.createIndex({ projectId: 1, startDate: -1 });

// Pull Requests collection
db.createCollection('pullrequests');
db.pullrequests.createIndex({ sprintId: 1 });
db.pullrequests.createIndex({ projectId: 1, status: 1 });
db.pullrequests.createIndex({ author: 1 });

print('✅ MongoDB database "delivery_risk_db" initialized with indexes.');
