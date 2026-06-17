process.env.NODE_ENV = 'test';
const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('./src/server'); // Loads express app
const User = require('./src/models/User');
const { generateToken } = require('./src/middleware/auth');

async function runTest() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect('mongodb://localhost:27017/delivery_risk_db');

  console.log("Finding admin user...");
  const user = await User.findOne({ email: 'admin@demo.com' });
  if (!user) {
    console.error("Admin user not found!");
    process.exit(1);
  }

  const token = generateToken(user);
  console.log("Generated Token successfully!");

  console.log("Requesting team benchmark via supertest...");
  const response = await supertest(app)
    .get('/api/analytics/team/6a32a7cb9eff06108eca23df/benchmark')
    .set('Authorization', `Bearer ${token}`);

  console.log("Response Status:", response.status);
  console.log("Response Body:", JSON.stringify(response.body, null, 2));

  await mongoose.connection.close();
  process.exit(0);
}

runTest().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
