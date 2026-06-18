/**
 * GitHub Integration Integration Tests
 */
require('dotenv').config();

// Mock database connections before loading the app
jest.mock('../src/config/db', () => ({
  connectMongoDB: jest.fn().mockResolvedValue(true),
  connectPostgreSQL: jest.fn().mockResolvedValue(true),
  getPostgresPool: jest.fn().mockReturnValue({
    query: jest.fn().mockResolvedValue({ rows: [] }),
  }),
  closeConnections: jest.fn().mockResolvedValue(true),
}));

// Mock Mongoose models
const Project = require('../src/models/Project');
const Sprint = require('../src/models/Sprint');
const PullRequest = require('../src/models/PullRequest');
const User = require('../src/models/User');

jest.mock('../src/models/Project');
jest.mock('../src/models/Sprint');
jest.mock('../src/models/PullRequest');
jest.mock('../src/models/User');

// Mock ML Service and GitHub Service
const mlService = require('../src/services/mlService');
const GitHubService = require('../src/services/githubService');

jest.mock('../src/services/mlService');
jest.mock('../src/services/githubService');

const request = require('supertest');
const app = require('../src/server');
const jwt = require('jsonwebtoken');

function getAuthToken() {
  const payload = {
    id: '507f1f77bcf86cd799439011',
    email: 'admin@demo.com',
    role: 'admin',
    organizationId: 'org_id_123',
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev_jwt_secret_key_change_in_production_2024');
}

describe('GitHub Routes', () => {
  let token;

  beforeAll(() => {
    token = getAuthToken();
  });

  beforeEach(() => {
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        name: 'Test Admin',
        email: 'admin@demo.com',
        role: 'admin',
        isActive: true,
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/github/sync/:projectId', () => {
    it('should successfully sync project with dummy-token fallback in dev', async () => {
      const mockProjectId = '507f1f77bcf86cd799439012';
      Project.findById.mockResolvedValue({
        _id: mockProjectId,
        name: 'Risk Intelligence App',
        githubRepo: 'stevejoy-9381/AI-Powered-Software-Delivery-Risk-Intelligence-Platform',
      });

      const mockSprint = {
        _id: '507f1f77bcf86cd799439023',
        name: 'Sprint 1',
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        commits: [],
        pullRequests: [],
        save: jest.fn().mockResolvedValue(true),
      };
      Sprint.findOne.mockResolvedValue(mockSprint);
      PullRequest.findOne.mockResolvedValue(null);
      PullRequest.create.mockResolvedValue({
        _id: '507f1f77bcf86cd799439099',
      });

      const res = await request(app)
        .post(`/api/github/sync/${mockProjectId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-github-token', 'dummy-token');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.synced).toBe(true);
      expect(res.body.data.commitsAdded).toBeGreaterThan(0);
    });
  });

  describe('POST /api/github/analyze-pr/:prId', () => {
    it('should call ML service to analyze single PR', async () => {
      const mockPRId = '507f1f77bcf86cd799439088';
      const mockPR = {
        _id: mockPRId,
        title: 'feat: add payment gateway integrations',
        description: 'impl stripes webhook',
        filesChanged: [{ filename: 'src/payment.js', additions: 10, deletions: 2 }],
        additions: 10,
        deletions: 2,
        hasTests: false,
        githubPrNumber: 42,
        save: jest.fn().mockResolvedValue(true),
      };
      PullRequest.findById.mockResolvedValue(mockPR);

      mlService.analyzePR.mockResolvedValue({
        summary: 'Excellent description of payment logic.',
        risk_level: 'medium',
        risk_flags: ['missing unit tests'],
        touches_auth: false,
        touches_payments: true,
        cached: false,
      });

      const res = await request(app)
        .post(`/api/github/analyze-pr/${mockPRId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.touchesPayments).toBe(true);
      expect(res.body.data.riskFlags).toContain('missing unit tests');
    });
  });

  describe('GET /api/github/analyze-hotspots/:projectId', () => {
    it('should calculate file churn and rank hotspots using ML', async () => {
      const mockProjectId = '507f1f77bcf86cd799439012';
      Project.findById.mockResolvedValue({
        _id: mockProjectId,
        name: 'Risk Intelligence App',
        githubRepo: 'stevejoy-9381/AI-Powered-Software-Delivery-Risk-Intelligence-Platform',
      });

      // Mock some recent PRs to generate file churn metrics
      PullRequest.find.mockResolvedValue([
        {
          author: 'developer-1',
          filesChanged: [
            { filename: 'src/auth.js', additions: 150, deletions: 10 },
            { filename: 'src/billing.js', additions: 40, deletions: 2 }
          ]
        }
      ]);

      mlService.analyzeHotspots.mockResolvedValue({
        total_files_analyzed: 2,
        hotspot_count: 1,
        hotspots: [
          {
            file_path: 'src/auth.js',
            hotspot_score: 82.5,
            is_hotspot: true,
            breakdown: { churn_score: 5, test_penalty: 25, complexity_score: 50, authors_score: 10, critical_multiplier: 1.2 }
          }
        ]
      });

      const res = await request(app)
        .get(`/api/github/analyze-hotspots/${mockProjectId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-github-token', 'dummy-token');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hotspotCount).toBe(1);
      expect(res.body.data.hotspots[0].file_path).toBe('src/auth.js');
    });
  });
});
