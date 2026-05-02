// server/routes/auth.js
// POST /api/auth/signup
// POST /api/auth/login
// GET  /api/auth/me

const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { pool }  = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const AVATARS = ['🦊','🐺','🦁','🐯','🐻','🦅','🦋','🐉','🦄','🌟','⚡','🔥'];

// ── Signup ────────────────────────────────────────────────────
router.post(
  '/signup',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['admin', 'member']).withMessage('Role must be admin or member'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { name, email, password, role = 'member' } = req.body;

      // Check duplicate email
      const [existing] = await pool.execute(
        'SELECT id FROM users WHERE email = ?', [email]
      );
      if (existing.length) {
        return res.status(409).json({ success: false, message: 'Email already registered' });
      }

      const hashedPw = await bcrypt.hash(password, 12);
      const id       = uuidv4();
      const avatar   = AVATARS[Math.floor(Math.random() * AVATARS.length)];

      await pool.execute(
        'INSERT INTO users (id, name, email, password, role, avatar) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, email, hashedPw, role, avatar]
      );

      const token = jwt.sign(
        { id, email, role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        token,
        user: { id, name, email, role, avatar },
      });
    } catch (err) { next(err); }
  }
);

// ── Login ─────────────────────────────────────────────────────
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { email, password } = req.body;

      const [rows] = await pool.execute(
        'SELECT id, name, email, password, role, avatar FROM users WHERE email = ?',
        [email]
      );
      if (!rows.length) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const user = rows[0];
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id:     user.id,
          name:   user.name,
          email:  user.email,
          role:   user.role,
          avatar: user.avatar,
        },
      });
    } catch (err) { next(err); }
  }
);

// ── Current user ──────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json({ success: true, user: req.user });
  } catch (err) { next(err); }
});

// ── Update profile ────────────────────────────────────────────
router.put(
  '/me',
  authenticate,
  [body('name').optional().trim().isLength({ min: 2, max: 100 })],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { name } = req.body;
      if (name) {
        await pool.execute('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
      }

      const [rows] = await pool.execute(
        'SELECT id, name, email, role, avatar FROM users WHERE id = ?',
        [req.user.id]
      );

      res.json({ success: true, user: rows[0] });
    } catch (err) { next(err); }
  }
);

module.exports = router;
