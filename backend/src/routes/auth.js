/**
 * Auth Routes
 * Handles registration, login, logout, GitHub OAuth, and profile.
 */
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, verifyToken, blacklistToken } = require('../middleware/auth');

// ── POST /api/auth/register ────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, organizationId, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Name, email, and password are required.' },
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: { message: 'A user with this email already exists.' },
      });
    }

    // Create user (password is hashed by the pre-save hook in User model)
    const user = await User.create({
      name,
      email,
      password,
      organizationId: organizationId || null,
      role: role || 'developer',
    });

    const token = generateToken(user);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: user.toSafeObject(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── POST /api/auth/login ───────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: { message: 'Email and password are required.' },
      });
    }

    // Find user with password field included
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.' },
      });
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.' },
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      success: true,
      data: {
        token,
        user: user.toSafeObject(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/auth/me ───────────────────────────────────────
router.get('/me', verifyToken, async (req, res) => {
  res.json({
    success: true,
    data: { user: req.user },
  });
});

// ── POST /api/auth/logout ──────────────────────────────────
router.post('/logout', verifyToken, (req, res) => {
  blacklistToken(req.token);
  res.json({
    success: true,
    data: { message: 'Logged out successfully.' },
  });
});

// ── GET /api/auth/github ───────────────────────────────────
router.get('/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return res.status(503).json({
      success: false,
      error: { message: 'GitHub OAuth is not configured.' },
    });
  }

  const scope = 'repo read:org read:user';
  const callbackUrl = process.env.GITHUB_CALLBACK_URL || 'http://localhost:5000/api/auth/github/callback';
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scope)}`;

  res.redirect(authUrl);
});

// ── GET /api/auth/github/callback ──────────────────────────
router.get('/github/callback', async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({
        success: false,
        error: { message: 'No authorization code provided.' },
      });
    }

    const axios = require('axios');

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: 'application/json' } }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: { message: 'Failed to obtain GitHub access token.' },
      });
    }

    // Fetch GitHub user profile
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const ghUser = userResponse.data;

    // Create or update user
    let user = await User.findOne({ githubId: String(ghUser.id) });
    if (!user) {
      // Try matching by email
      const emails = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const primaryEmail = emails.data.find((e) => e.primary)?.email || ghUser.email;

      user = await User.findOne({ email: primaryEmail });
      if (user) {
        user.githubId = String(ghUser.id);
        user.githubUsername = ghUser.login;
        user.avatar = ghUser.avatar_url || '';
        await user.save();
      } else {
        user = await User.create({
          name: ghUser.name || ghUser.login,
          email: primaryEmail || `${ghUser.login}@github.local`,
          githubId: String(ghUser.id),
          githubUsername: ghUser.login,
          avatar: ghUser.avatar_url || '',
          role: 'developer',
        });
      }
    } else {
      user.githubUsername = ghUser.login;
      user.avatar = ghUser.avatar_url || '';
      user.lastLoginAt = new Date();
      await user.save();
    }

    const token = generateToken(user);

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
  } catch (error) {
    next(error);
  }
});

// ── PUT /api/auth/profile ──────────────────────────────────
router.put('/profile', verifyToken, async (req, res, next) => {
  try {
    const { name, githubUsername } = req.body;
    const user = req.user;

    if (name) user.name = name;
    if (githubUsername !== undefined) user.githubUsername = githubUsername;

    await user.save();

    res.json({
      success: true,
      data: {
        user: user.toSafeObject(),
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
