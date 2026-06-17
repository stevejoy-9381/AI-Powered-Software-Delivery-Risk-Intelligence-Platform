/**
 * Database Configuration
 * Manages connections to MongoDB (Mongoose) and PostgreSQL (pg Pool).
 * Includes retry logic and graceful shutdown handlers.
 */
const mongoose = require('mongoose');
const { Pool } = require('pg');

// ── PostgreSQL Connection Pool ─────────────────────────────
let pgPool = null;

/**
 * Connect to MongoDB via Mongoose with retry logic.
 * @param {number} retries - Number of connection attempts
 */
async function connectMongoDB(retries = 5) {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/delivery_risk_db';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await mongoose.connect(uri, {
        // Mongoose 8 uses the new driver defaults; these are optional overrides
        serverSelectionTimeoutMS: 5000,
        heartbeatFrequencyMS: 10000,
      });
      return; // Connected successfully
    } catch (error) {
      console.warn(
        `⚠️  MongoDB connection attempt ${attempt}/${retries} failed: ${error.message}`
      );
      if (attempt === retries) {
        throw new Error(`MongoDB connection failed after ${retries} attempts`);
      }
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
}

/**
 * Connect to PostgreSQL and return the connection pool.
 * @param {number} retries - Number of connection attempts
 * @returns {Pool} PostgreSQL connection pool
 */
async function connectPostgreSQL(retries = 5) {
  const connectionString =
    process.env.POSTGRES_URI ||
    'postgresql://drp_user:drp_secret_2024@localhost:5432/ml_feature_store';

  pgPool = new Pool({
    connectionString,
    max: 20, // Maximum number of connections in pool
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Test the connection
      const client = await pgPool.connect();
      client.release();
      return pgPool;
    } catch (error) {
      console.warn(
        `⚠️  PostgreSQL connection attempt ${attempt}/${retries} failed: ${error.message}`
      );
      if (attempt === retries) {
        throw new Error(`PostgreSQL connection failed after ${retries} attempts`);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
}

/**
 * Get the active PostgreSQL connection pool.
 * @returns {Pool} PostgreSQL connection pool
 */
function getPostgresPool() {
  if (!pgPool) {
    throw new Error('PostgreSQL pool not initialized. Call connectPostgreSQL() first.');
  }
  return pgPool;
}

// ── Graceful Shutdown ──────────────────────────────────────
async function closeConnections() {
  console.log('\n🔌 Closing database connections...');

  try {
    await mongoose.connection.close();
    console.log('   MongoDB disconnected');
  } catch (err) {
    console.error('   Error closing MongoDB:', err.message);
  }

  try {
    if (pgPool) {
      await pgPool.end();
      console.log('   PostgreSQL pool closed');
    }
  } catch (err) {
    console.error('   Error closing PostgreSQL:', err.message);
  }
}

// Handle process termination signals
process.on('SIGINT', async () => {
  await closeConnections();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeConnections();
  process.exit(0);
});

module.exports = {
  connectMongoDB,
  connectPostgreSQL,
  getPostgresPool,
  closeConnections,
};
