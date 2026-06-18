/**
 * ML Service Connector
 * Wraps all HTTP calls to the Python ML microservice (port 8000).
 * Includes 30s timeout, single retry on failure, and timing logs.
 */
const axios = require('axios');

const ML_BASE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// Shared axios instance with defaults
const mlClient = axios.create({
  baseURL: ML_BASE_URL,
  timeout: 30000, // 30 seconds — ML calls can be slow
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Generic ML service call with retry logic.
 * @param {string} method - HTTP method
 * @param {string} path - API path (e.g., '/api/risk/score')
 * @param {Object} data - Request body
 * @returns {Object|null} Response data or null on failure
 */
async function callML(method, path, data = null) {
  const start = Date.now();
  const label = `ML ${method.toUpperCase()} ${path}`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await mlClient({ method, url: path, data });
      const elapsed = Date.now() - start;
      console.log(`✅ ${label} → ${response.status} (${elapsed}ms)`);

      // ML service wraps responses in { success, data, error }
      if (response.data && response.data.success) {
        return response.data.data;
      }
      // If ML service returns success: false
      console.warn(`⚠️ ${label} returned error: ${response.data?.error}`);
      return response.data?.data || null;
    } catch (error) {
      const elapsed = Date.now() - start;
      if (attempt === 1) {
        console.warn(
          `⚠️ ${label} attempt 1 failed (${elapsed}ms): ${error.message}. Retrying...`
        );
        continue;
      }
      console.error(`❌ ${label} failed after 2 attempts (${elapsed}ms): ${error.message}`);
      return null;
    }
  }
  return null;
}

/**
 * Analyze sprint risk — calls POST /api/risk/score
 * @param {Object} sprintFeatures - Sprint data for risk analysis
 */
async function analyzeSprintRisk(sprintFeatures) {
  return callML('post', '/api/risk/score', sprintFeatures);
}

/**
 * Summarize PR — calls POST /api/pr/summarize
 * @param {Object} prData - Pull request data for LLM analysis
 */
async function analyzePR(prData) {
  return callML('post', '/api/pr/summarize', prData);
}

/**
 * Analyze hotspots — calls POST /api/hotspots/analyze
 * @param {Object[]} filesData - Array of file metadata
 */
async function analyzeHotspots(filesData) {
  return callML('post', '/api/hotspots/analyze', { files: filesData });
}

/**
 * Analyze staffing — calls POST /api/staffing/analyze
 * @param {Object} sprintData - Current sprint data
 * @param {Object[]} teamHistory - Previous sprint data
 */
async function analyzeStaffing(sprintData, teamHistory) {
  return callML('post', '/api/staffing/analyze', {
    sprint_data: sprintData,
    team_history: teamHistory,
  });
}

/**
 * Compute benchmark — calls POST /api/benchmark/compute
 * @param {Object} teamMetrics - Team metrics for health scoring
 */
async function computeBenchmark(teamMetrics) {
  return callML('post', '/api/benchmark/compute', teamMetrics);
}

/**
 * Analyze batch of PRs — calls POST /api/pr/summarize-batch
 * @param {Object[]} pullRequests - List of PR data
 */
async function analyzePRsBatch(pullRequests) {
  return callML('post', '/api/pr/summarize-batch', { pull_requests: pullRequests });
}

/**
 * Detect sprint risk patterns — calls POST /api/pr/detect-risk-pattern
 * @param {Object[]} pullRequests - List of summarized PR data details
 * @param {string} sprintGoal - Sprint goal/description
 */
async function detectRiskPatterns(pullRequests, sprintGoal = '') {
  return callML('post', '/api/pr/detect-risk-pattern', {
    pull_requests: pullRequests,
    sprint_goal: sprintGoal,
  });
}

/**
 * Predict release readiness — calls POST /api/release/predict
 * @param {Object} releaseData - Release inputs
 */
async function predictReleaseReadiness(releaseData) {
  return callML('post', '/api/release/predict', releaseData);
}

/**
 * Check ML service health
 */
async function checkHealth() {
  try {
    const response = await mlClient.get('/health');
    return response.data;
  } catch {
    return { status: 'unreachable', model_loaded: false };
  }
}

module.exports = {
  analyzeSprintRisk,
  analyzePR,
  analyzePRsBatch,
  detectRiskPatterns,
  predictReleaseReadiness,
  analyzeHotspots,
  analyzeStaffing,
  computeBenchmark,
  checkHealth,
};
