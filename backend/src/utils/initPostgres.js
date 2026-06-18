const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function init() {
  console.log('--- PostgreSQL Local Initialization ---');
  
  // Try connecting as postgres user first to setup database and user
  const adminConfig = {
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'drp_secret_2024',
    database: 'postgres'
  };

  const client = new Client(adminConfig);
  try {
    await client.connect();
    console.log('Connected to postgres default DB.');
  } catch (err) {
    console.error('Could not connect to postgres database with postgres/drp_secret_2024.', err.message);
    console.log('Attempting to connect with drp_user...');
    // Maybe the user/db already exists, let's try direct connection
    await tryDirectInit();
    return;
  }

  // Create role if not exists
  try {
    const roleCheck = await client.query("SELECT 1 FROM pg_roles WHERE rolname='drp_user'");
    if (roleCheck.rows.length === 0) {
      await client.query("CREATE ROLE drp_user WITH LOGIN PASSWORD 'drp_secret_2024' SUPERUSER");
      console.log('Created user drp_user.');
    } else {
      console.log('User drp_user already exists.');
    }
  } catch (err) {
    console.error('Error checking/creating role drp_user:', err.message);
  }

  // Create database if not exists
  try {
    const dbCheck = await client.query("SELECT 1 FROM pg_database WHERE datname='ml_feature_store'");
    if (dbCheck.rows.length === 0) {
      await client.query("CREATE DATABASE ml_feature_store OWNER drp_user");
      console.log('Created database ml_feature_store.');
    } else {
      console.log('Database ml_feature_store already exists.');
    }
  } catch (err) {
    console.error('Error checking/creating database ml_feature_store:', err.message);
  }

  await client.end();
  await tryDirectInit();
}

async function tryDirectInit() {
  console.log('Connecting directly to ml_feature_store...');
  const dbConfig = {
    host: 'localhost',
    port: 5432,
    user: 'drp_user',
    password: 'drp_secret_2024',
    database: 'ml_feature_store'
  };

  const client = new Client(dbConfig);
  try {
    await client.connect();
    console.log('Connected to ml_feature_store successfully.');
  } catch (err) {
    console.error('Failed to connect to ml_feature_store:', err.message);
    process.exit(1);
  }

  // Read postgres-init.sql
  const sqlPath = path.join(__dirname, '../../../database/postgres-init.sql');
  console.log('Reading schema from:', sqlPath);
  try {
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('Successfully executed postgres-init.sql schema definitions!');
  } catch (err) {
    console.error('Error reading/executing schema sql:', err.message);
    process.exit(1);
  }

  await client.end();
  console.log('PostgreSQL initialization complete!');
}

init();
