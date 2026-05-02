// server/routes/users.js
// Admin: list/manage users

const express = require('express');
const { pool } = require('../database/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// ── GET /api/users  (admin only) ──────────────────────────────
router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`
      SELECT id, name, email, role, avatar, created_at FROM users ORDER BY created_at DESC
    `);
    res.json({ success: true, users: rows });
  } catch (err) { next(err); }
});

// ── GET /api/users/search?q=  (authenticated, for assigning tasks) ──
router.get('/search', authenticate, async (req, res, next) => {
  try {
    const q = `%${req.query.q || ''}%`;
    const [rows] = await pool.execute(
      `SELECT id, name, email, avatar, role FROM users
       WHERE name LIKE ? OR email LIKE ?
       LIMIT 20`,
      [q, q]
    );
    res.json({ success: true, users: rows });
  } catch (err) { next(err); }
});

// ── GET /api/users/:id ────────────────────────────────────────
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: rows[0] });
  } catch (err) { next(err); }
});

// ── PUT /api/users/:id/role  (admin only) ─────────────────────
router.put(
  '/:id/role',
  authenticate,
  requireAdmin,
  [body('role').isIn(['admin', 'member']).withMessage('Role must be admin or member')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      await pool.execute('UPDATE users SET role = ? WHERE id = ?', [req.body.role, req.params.id]);
      res.json({ success: true, message: 'Role updated' });
    } catch (err) { next(err); }
  }
);

// ── DELETE /api/users/:id  (admin only) ───────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    }
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
