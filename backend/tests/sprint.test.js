/**
 * Sprint Integration Tests
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

// Mock Sprint, PullRequest, and User models
const Sprint = require('../src/models/Sprint');
const PullRequest = require('../src/models/PullRequest');
const User = require('../src/models/User');
jest.mock('../src/models/Sprint');
jest.mock('../src/models/PullRequest');
jest.mock('../src/models/User');

// Mock ML Service
const mlService = require('../src/services/mlService');
jest.mock('../src/services/mlService');

const request = require('supertest');
const app = require('../src/server');
const jwt = require('jsonwebtoken');

// Helper to generate a dummy JWT token for bypassing auth
function getAuthToken() {
  const payload = {
    id: '507f1f77bcf86cd799439011',
    email: 'admin@demo.com',
    role: 'admin',
    organizationId: 'org_id_123',
  };
  return jwt.sign(payload, process.env.JWT_SECRET || 'dev_jwt_secret_key_change_in_production_2024');
}

describe('Sprint Routes', () => {
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

  describe('GET /api/sprints/:sprintId', () => {
    it('should fetch a sprint successfully', async () => {
      const mockSprintId = '507f1f77bcf86cd799439033';
      const mockSprint = {
        _id: mockSprintId,
        name: 'Sprint 1',
        status: 'active',
        daysRemaining: 5,
        plannedPoints: 40,
        completedPoints: 10,
      };

      // Mock chainable findById().populate().populate()
      const mockPopulate = jest.fn().mockImplementation(() => ({
        populate: jest.fn().mockResolvedValue(mockSprint),
      }));
      Sprint.findById.mockReturnValue({
        populate: mockPopulate,
      });

      PullRequest.find.mockResolvedValue([]);

      const res = await request(app)
        .get(`/api/sprints/${mockSprintId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sprint.name).toBe('Sprint 1');
    });

    it('should return 404 if sprint is not found', async () => {
      const mockSprintId = '507f1f77bcf86cd799439044';

      const mockPopulate = jest.fn().mockImplementation(() => ({
        populate: jest.fn().mockResolvedValue(null),
      }));
      Sprint.findById.mockReturnValue({
        populate: mockPopulate,
      });

      const res = await request(app)
        .get(`/api/sprints/${mockSprintId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Sprint not found');
    });
  });

  describe('POST /api/sprints/:sprintId/analyze', () => {
    it('should trigger ML analysis successfully', async () => {
      const mockSprintId = '507f1f77bcf86cd799439055';
      const mockSprint = {
        _id: mockSprintId,
        name: 'Sprint 2',
        status: 'active',
        daysRemaining: 6,
        plannedPoints: 30,
        completedPoints: 15,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockPopulate = jest.fn().mockResolvedValue(mockSprint);
      Sprint.findById.mockReturnValue({
        populate: mockPopulate,
      });

      PullRequest.find.mockResolvedValue([]);

      mlService.analyzeSprintRisk.mockResolvedValue({
        risk_score: 45,
        risk_level: 'medium',
        predicted_delay: false,
        confidence: 0.82,
        risk_factors: [{ factor: 'staffing', description: 'Small team' }],
      });

      mlService.analyzeStaffing.mockResolvedValue({
        staffing_recommendation: 'Add mid developer',
        bottlenecks: [],
      });

      const res = await request(app)
        .post(`/api/sprints/${mockSprintId}/analyze`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.riskScore).toBe(45);
      expect(res.body.data.riskLevel).toBe('medium');
    });
  });
});
