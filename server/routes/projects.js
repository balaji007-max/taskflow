// server/routes/projects.js
// CRUD for projects + member management

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');
const { pool } = require('../database/db');
const {
  authenticate,
  requireAdmin,
  requireProjectAdmin,
  requireProjectMember,
} = require('../middleware/auth');

const router = express.Router();

// ── Helper: log activity ──────────────────────────────────────
async function logActivity(userId, projectId, taskId, action, details) {
  await pool.execute(
    'INSERT INTO activity_log (id, user_id, project_id, task_id, action, details) VALUES (?,?,?,?,?,?)',
    [uuidv4(), userId, projectId, taskId, action, details]
  );
}

// ── GET /api/projects  (all projects visible to user) ─────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      [rows] = await pool.execute(`
        SELECT p.*,
               u.name AS owner_name,
               COUNT(DISTINCT pm.user_id) AS member_count,
               COUNT(DISTINCT t.id)       AS task_count
        FROM projects p
        LEFT JOIN users u          ON u.id = p.owner_id
        LEFT JOIN project_members pm ON pm.project_id = p.id
        LEFT JOIN tasks t          ON t.project_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `);
    } else {
      [rows] = await pool.execute(`
        SELECT p.*,
               u.name AS owner_name,
               COUNT(DISTINCT pm2.user_id) AS member_count,
               COUNT(DISTINCT t.id)        AS task_count
        FROM projects p
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
        LEFT JOIN users u           ON u.id = p.owner_id
        LEFT JOIN project_members pm2 ON pm2.project_id = p.id
        LEFT JOIN tasks t           ON t.project_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC
      `, [req.user.id]);
    }
    res.json({ success: true, projects: rows });
  } catch (err) { next(err); }
});

// ── GET /api/projects/:id ─────────────────────────────────────
router.get('/:id', authenticate, requireProjectMember, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`
      SELECT p.*, u.name AS owner_name
      FROM projects p
      LEFT JOIN users u ON u.id = p.owner_id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ success: false, message: 'Project not found' });

    const [members] = await pool.execute(`
      SELECT u.id, u.name, u.email, u.avatar, pm.role, pm.joined_at
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      WHERE pm.project_id = ?
      ORDER BY pm.joined_at
    `, [req.params.id]);

    res.json({ success: true, project: { ...rows[0], members } });
  } catch (err) { next(err); }
});

// ── POST /api/projects  (admin only) ─────────────────────────
router.post(
  '/',
  authenticate,
  requireAdmin,
  [
    body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Name required (2–150 chars)'),
    body('description').optional().isLength({ max: 2000 }),
    body('deadline').optional().isISO8601().withMessage('Invalid date'),
    body('color').optional().isHexColor().withMessage('Invalid color'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { name, description = null, deadline = null, color = '#6366f1' } = req.body;
      const id = uuidv4();

      await pool.execute(
        'INSERT INTO projects (id, name, description, owner_id, deadline, color) VALUES (?,?,?,?,?,?)',
        [id, name, description, req.user.id, deadline, color]
      );

      // Add creator as project admin
      await pool.execute(
        'INSERT INTO project_members (id, project_id, user_id, role) VALUES (?,?,?,?)',
        [uuidv4(), id, req.user.id, 'admin']
      );

      await logActivity(req.user.id, id, null, 'project_created', `Project "${name}" created`);

      const [created] = await pool.execute('SELECT * FROM projects WHERE id = ?', [id]);
      res.status(201).json({ success: true, message: 'Project created', project: created[0] });
    } catch (err) { next(err); }
  }
);

// ── PUT /api/projects/:id ─────────────────────────────────────
router.put(
  '/:id',
  authenticate,
  requireProjectAdmin,
  [
    body('name').optional().trim().isLength({ min: 2, max: 150 }),
    body('status').optional().isIn(['active', 'archived']),
    body('deadline').optional({ nullable: true }).isISO8601(),
    body('color').optional().isHexColor(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const fields = ['name', 'description', 'status', 'deadline', 'color'];
      const updates = [];
      const values  = [];

      fields.forEach(f => {
        if (req.body[f] !== undefined) {
          updates.push(`${f} = ?`);
          values.push(req.body[f]);
        }
      });

      if (!updates.length) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      values.push(req.params.id);
      await pool.execute(
        `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      const [updated] = await pool.execute('SELECT * FROM projects WHERE id = ?', [req.params.id]);
      await logActivity(req.user.id, req.params.id, null, 'project_updated', `Project updated`);

      res.json({ success: true, project: updated[0] });
    } catch (err) { next(err); }
  }
);

// ── DELETE /api/projects/:id  (global admin only) ─────────────
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT id, name FROM projects WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Project not found' });

    await pool.execute('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Project deleted' });
  } catch (err) { next(err); }
});

// ── POST /api/projects/:id/members  (add member) ─────────────
router.post(
  '/:id/members',
  authenticate,
  requireProjectAdmin,
  [
    body('userId').notEmpty().withMessage('userId required'),
    body('role').optional().isIn(['admin', 'member']),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { userId, role = 'member' } = req.body;

      // Verify user exists
      const [user] = await pool.execute('SELECT id, name FROM users WHERE id = ?', [userId]);
      if (!user.length) return res.status(404).json({ success: false, message: 'User not found' });

      // Check if already member
      const [existing] = await pool.execute(
        'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
        [req.params.id, userId]
      );
      if (existing.length) {
        return res.status(409).json({ success: false, message: 'User is already a member' });
      }

      await pool.execute(
        'INSERT INTO project_members (id, project_id, user_id, role) VALUES (?,?,?,?)',
        [uuidv4(), req.params.id, userId, role]
      );

      await logActivity(req.user.id, req.params.id, null, 'member_added',
        `${user[0].name} added to project`);

      res.status(201).json({ success: true, message: 'Member added' });
    } catch (err) { next(err); }
  }
);

// ── DELETE /api/projects/:id/members/:userId  (remove member) ─
router.delete('/:id/members/:userId', authenticate, requireProjectAdmin, async (req, res, next) => {
  try {
    await pool.execute(
      'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    );
    res.json({ success: true, message: 'Member removed' });
  } catch (err) { next(err); }
});

module.exports = router;
