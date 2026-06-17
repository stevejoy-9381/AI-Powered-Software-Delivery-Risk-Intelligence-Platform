/**
 * Authentication Middleware
 * JWT verification and role-based access control.
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_key_change_in_production_2024';

// In-memory token blacklist (MVP — use Redis in production)
const tokenBlacklist = new Set();

/**
 * Generate a JWT token for a user.
 * @param {Object} user - Mongoose user document
 * @returns {string} Signed JWT token
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * Middleware: Verify JWT token and attach user to req.user
 */
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required. Please provide a valid token.' },
      });
    }

    const token = authHeader.split(' ')[1];

    // Check blacklist
    if (tokenBlacklist.has(token)) {
      return res.status(401).json({
        success: false,
        error: { message: 'Token has been invalidated. Please log in again.' },
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { message: 'User not found. Token may be invalid.' },
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: { message: 'Account is deactivated.' },
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: { message: 'Token has expired. Please log in again.' },
      });
    }
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid authentication token.' },
    });
  }
}

/**
 * Middleware factory: Require specific roles.
 * @param {string[]} roles - Array of allowed roles (e.g., ['admin', 'manager'])
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required.' },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
        },
      });
    }

    next();
  };
}

/**
 * Add a token to the blacklist (for logout).
 * @param {string} token - JWT token to blacklist
 */
function blacklistToken(token) {
  tokenBlacklist.add(token);
}

module.exports = {
  generateToken,
  verifyToken,
  requireRole,
  blacklistToken,
};
