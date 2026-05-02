// server/middleware/auth.js
// JWT verification + role-based access helpers

const jwt = require('jsonwebtoken');
const { pool } = require('../database/db');

// ── Verify JWT ────────────────────────────────────────────────
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await pool.execute(
      'SELECT id, name, email, role, avatar FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// ── Require global Admin role ─────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

// ── Require Admin OR project-level Admin ──────────────────────
async function requireProjectAdmin(req, res, next) {
  try {
    if (req.user.role === 'admin') return next();

    const projectId = req.params.projectId || req.params.id;
    const [rows] = await pool.execute(
      `SELECT role FROM project_members
       WHERE project_id = ? AND user_id = ?`,
      [projectId, req.user.id]
    );

    if (!rows.length || rows[0].role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Project admin access required' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// ── Member of project (or global admin) ──────────────────────
async function requireProjectMember(req, res, next) {
  try {
    if (req.user.role === 'admin') return next();

    const projectId = req.params.projectId || req.params.id;
    const [rows] = await pool.execute(
      'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, req.user.id]
    );

    if (!rows.length) {
      return res.status(403).json({ success: false, message: 'Project access denied' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate, requireAdmin, requireProjectAdmin, requireProjectMember };
