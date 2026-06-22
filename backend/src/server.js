/**
 * Server Entry Point
 * Initializes Express app with middleware, connects to databases,
 * registers routes, and starts listening.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { connectMongoDB, connectPostgreSQL } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const { registerJobs } = require('./jobs/syncJob');

// ── Initialize Express ─────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Middleware ────────────────────────────────────

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// ── Rate Limiting ──────────────────────────────────────────
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests, please try again later.',
  },
});
app.use('/api/', limiter);

// ── Body Parsing & Logging ─────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Health Check ───────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'delivery-risk-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── API Routes ─────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/sprints', require('./routes/sprints'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/github', require('./routes/github'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/dashboard', require('./routes/dashboard'));

// ── 404 Handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ── Global Error Handler ───────────────────────────────────
app.use(errorHandler);

// ── Start Server ───────────────────────────────────────────
async function startServer() {
  try {
    // Connect to databases
    await connectMongoDB();
    console.log('✅ MongoDB connected');

    await connectPostgreSQL();
    console.log('✅ PostgreSQL connected');

    // Register scheduled cron jobs
    registerJobs();

    // Start listening
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n🚀 Backend API server running on port ${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`   Health: http://localhost:${PORT}/api/health\n`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;

