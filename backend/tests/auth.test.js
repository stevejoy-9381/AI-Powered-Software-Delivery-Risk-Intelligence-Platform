/**
 * Auth Integration Tests
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

// Mock User Model
const User = require('../src/models/User');
jest.mock('../src/models/User');

const request = require('supertest');
const app = require('../src/server');

describe('Auth Routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const mockUserData = {
        name: 'Test Developer',
        email: 'test@company.com',
        password: 'Password@123',
      };

      const mockSavedUser = {
        _id: '507f1f77bcf86cd799439011',
        name: mockUserData.name,
        email: mockUserData.email,
        role: 'developer',
        toSafeObject: () => ({
          _id: '507f1f77bcf86cd799439011',
          name: mockUserData.name,
          email: mockUserData.email,
          role: 'developer',
        }),
      };

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockSavedUser);

      const res = await request(app)
        .post('/api/auth/register')
        .send(mockUserData);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.name).toBe(mockUserData.name);
      expect(res.body.data).toHaveProperty('token');
    });

    it('should fail registration if email already exists', async () => {
      const mockUserData = {
        name: 'Test Developer',
        email: 'existing@company.com',
        password: 'Password@123',
      };

      User.findOne.mockResolvedValue({ _id: '123' });

      const res = await request(app)
        .post('/api/auth/register')
        .send(mockUserData);

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate user with valid credentials', async () => {
      const loginPayload = {
        email: 'admin@demo.com',
        password: 'Demo@123',
      };

      const mockUser = {
        _id: '507f1f77bcf86cd799439022',
        name: 'Admin User',
        email: loginPayload.email,
        role: 'admin',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        toSafeObject: () => ({
          _id: '507f1f77bcf86cd799439022',
          name: 'Admin User',
          email: loginPayload.email,
          role: 'admin',
        }),
      };

      // Mock chainable findOne().select()
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginPayload);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data).toHaveProperty('token');
    });

    it('should reject login for invalid credentials', async () => {
      const loginPayload = {
        email: 'admin@demo.com',
        password: 'wrongpassword',
      };

      const mockUser = {
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send(loginPayload);

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Invalid email or password');
    });
  });
});
