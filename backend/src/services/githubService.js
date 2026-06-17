/**
 * GitHub Integration Service
 * Wraps GitHub REST API v3 calls for fetching commits, PRs, contributors, etc.
 * Includes rate-limit awareness and date-range filtering.
 */
const axios = require('axios');

class GitHubService {
  /**
   * @param {string} accessToken - GitHub personal access token or OAuth token
   */
  constructor(accessToken) {
    this.client = axios.create({
      baseURL: 'https://api.github.com',
      timeout: 15000,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'DeliveryRiskPlatform/1.0',
      },
    });

    this.rateLimitRemaining = null;
    this.rateLimitReset = null;

    // Intercept responses to track rate limits
    this.client.interceptors.response.use(
      (response) => {
        this.rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'] || '60');
        this.rateLimitReset = parseInt(response.headers['x-ratelimit-reset'] || '0');

        if (this.rateLimitRemaining < 10) {
          const resetDate = new Date(this.rateLimitReset * 1000);
          console.warn(
            `⚠️ GitHub rate limit low: ${this.rateLimitRemaining} remaining. ` +
            `Resets at ${resetDate.toISOString()}`
          );
        }
        return response;
      },
      (error) => {
        if (error.response?.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
          const resetTime = parseInt(error.response.headers['x-ratelimit-reset'] || '0');
          const waitMs = (resetTime * 1000) - Date.now();
          console.error(`❌ GitHub rate limit exceeded. Resets in ${Math.ceil(waitMs / 1000)}s`);
        }
        throw error;
      }
    );
  }

  /**
   * Wait if rate limit is critically low.
   */
  async _checkRateLimit() {
    if (this.rateLimitRemaining !== null && this.rateLimitRemaining < 5 && this.rateLimitReset) {
      const waitMs = Math.max(0, (this.rateLimitReset * 1000) - Date.now());
      if (waitMs > 0 && waitMs < 120000) {
        console.warn(`⏳ Rate limit low, waiting ${Math.ceil(waitMs / 1000)}s...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  /**
   * Fetch commits for a repo within a date range.
   * @param {string} owner - Repo owner
   * @param {string} repo - Repo name
   * @param {string} since - ISO date string (sprint start)
   * @param {string} until - ISO date string (sprint end)
   * @returns {Object[]} Array of commit objects
   */
  async getRepoCommits(owner, repo, since, until) {
    await this._checkRateLimit();
    try {
      const params = { per_page: 100 };
      if (since) params.since = since;
      if (until) params.until = until;

      const response = await this.client.get(`/repos/${owner}/${repo}/commits`, { params });

      return response.data.map((c) => ({
        sha: c.sha,
        message: c.commit?.message || '',
        author: c.commit?.author?.name || c.author?.login || 'unknown',
        date: c.commit?.author?.date || null,
        additions: c.stats?.additions || 0,
        deletions: c.stats?.deletions || 0,
      }));
    } catch (error) {
      console.error(`GitHub getRepoCommits error: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch pull requests for a repo.
   * @param {string} owner - Repo owner
   * @param {string} repo - Repo name
   * @param {string} state - 'open', 'closed', or 'all'
   * @param {string} since - ISO date to filter PRs created after
   * @returns {Object[]} Array of PR objects
   */
  async getRepoPullRequests(owner, repo, state = 'all', since = null) {
    await this._checkRateLimit();
    try {
      const params = { state, per_page: 100, sort: 'created', direction: 'desc' };

      const response = await this.client.get(`/repos/${owner}/${repo}/pulls`, { params });

      let prs = response.data;

      // Filter by date if provided
      if (since) {
        const sinceDate = new Date(since);
        prs = prs.filter((pr) => new Date(pr.created_at) >= sinceDate);
      }

      return prs.map((pr) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body || '',
        createdAt: pr.created_at,
        mergedAt: pr.merged_at,
        closedAt: pr.closed_at,
        additions: pr.additions || 0,
        deletions: pr.deletions || 0,
        changedFiles: pr.changed_files || 0,
        state: pr.merged_at ? 'merged' : pr.state,
        author: pr.user?.login || 'unknown',
        reviewers: (pr.requested_reviewers || []).map((r) => r.login),
      }));
    } catch (error) {
      console.error(`GitHub getRepoPullRequests error: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch files changed in a specific PR.
   * @param {string} owner - Repo owner
   * @param {string} repo - Repo name
   * @param {number} prNumber - Pull request number
   * @returns {Object[]} Array of file change objects
   */
  async getPRFiles(owner, repo, prNumber) {
    await this._checkRateLimit();
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/pulls/${prNumber}/files`,
        { params: { per_page: 100 } }
      );

      return response.data.map((f) => ({
        filename: f.filename,
        additions: f.additions || 0,
        deletions: f.deletions || 0,
        changes: f.changes || 0,
        status: f.status || 'modified',
      }));
    } catch (error) {
      console.error(`GitHub getPRFiles error: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch reviews for a specific PR.
   * @param {string} owner - Repo owner
   * @param {string} repo - Repo name
   * @param {number} prNumber - Pull request number
   * @returns {Object[]} Array of review objects
   */
  async getPRReviews(owner, repo, prNumber) {
    await this._checkRateLimit();
    try {
      const response = await this.client.get(
        `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
        { params: { per_page: 100 } }
      );

      return response.data.map((r) => ({
        name: r.user?.login || 'unknown',
        status: r.state.toLowerCase() === 'approved' ? 'approved' :
                r.state.toLowerCase() === 'changes_requested' ? 'changes_requested' :
                r.state.toLowerCase() === 'commented' ? 'commented' : 'pending',
        reviewedAt: r.submitted_at ? new Date(r.submitted_at) : new Date(),
      }));
    } catch (error) {
      console.error(`GitHub getPRReviews error: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetch repository contributors.
   * @param {string} owner - Repo owner
   * @param {string} repo - Repo name
   * @returns {Object[]} Array of contributor objects
   */
  async getRepoContributors(owner, repo) {
    await this._checkRateLimit();
    try {
      const response = await this.client.get(`/repos/${owner}/${repo}/contributors`, {
        params: { per_page: 100 },
      });

      return response.data.map((c) => ({
        login: c.login,
        contributions: c.contributions || 0,
        avatar: c.avatar_url || '',
      }));
    } catch (error) {
      console.error(`GitHub getRepoContributors error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get commit history for a specific file (for churn calculation).
   * @param {string} owner - Repo owner
   * @param {string} repo - Repo name
   * @param {string} filePath - Path to the file
   * @param {number} days - Look back N days
   * @returns {number} Number of commits touching this file
   */
  async getFileCommitHistory(owner, repo, filePath, days = 30) {
    await this._checkRateLimit();
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const response = await this.client.get(`/repos/${owner}/${repo}/commits`, {
        params: { path: filePath, since: since.toISOString(), per_page: 100 },
      });

      return response.data.length;
    } catch (error) {
      console.error(`GitHub getFileCommitHistory error: ${error.message}`);
      return 0;
    }
  }
}

module.exports = GitHubService;
