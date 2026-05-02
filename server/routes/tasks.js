// server/routes/tasks.js
// Full CRUD for tasks + comments

const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, query, validationResult } = require('express-validator');
const { pool } = require('../database/db');
const {
  authenticate,
  requireProjectMember,
  requireProjectAdmin,
} = require('../middleware/auth');

const router = express.Router({ mergeParams: true }); // mergeParams for /projects/:projectId/tasks

// ── Helper ────────────────────────────────────────────────────
async function logActivity(userId, projectId, taskId, action, details) {
  await pool.execute(
    'INSERT INTO activity_log (id, user_id, project_id, task_id, action, details) VALUES (?,?,?,?,?,?)',
    [uuidv4(), userId, projectId, taskId, action, details]
  );
}

// ── GET /api/projects/:projectId/tasks ────────────────────────
router.get('/', authenticate, requireProjectMember, async (req, res, next) => {
  try {
    const { status, priority, assigned_to } = req.query;

    let sql = `
      SELECT t.*,
             ua.name  AS assignee_name, ua.avatar AS assignee_avatar,
             uc.name  AS creator_name
      FROM tasks t
      LEFT JOIN users ua ON ua.id = t.assigned_to
      LEFT JOIN users uc ON uc.id = t.created_by
      WHERE t.project_id = ?
    `;
    const params = [req.params.projectId];

    if (status)      { sql += ' AND t.status = ?';      params.push(status); }
    if (priority)    { sql += ' AND t.priority = ?';    params.push(priority); }
    if (assigned_to) { sql += ' AND t.assigned_to = ?'; params.push(assigned_to); }

    sql += ' ORDER BY t.created_at DESC';

    const [rows] = await pool.execute(sql, params);
    res.json({ success: true, tasks: rows });
  } catch (err) { next(err); }
});

// ── GET /api/projects/:projectId/tasks/:taskId ────────────────
router.get('/:taskId', authenticate, requireProjectMember, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(`
      SELECT t.*,
             ua.name AS assignee_name, ua.avatar AS assignee_avatar,
             uc.name AS creator_name
      FROM tasks t
      LEFT JOIN users ua ON ua.id = t.assigned_to
      LEFT JOIN users uc ON uc.id = t.created_by
      WHERE t.id = ? AND t.project_id = ?
    `, [req.params.taskId, req.params.projectId]);

    if (!rows.length) return res.status(404).json({ success: false, message: 'Task not found' });

    // Fetch comments
    const [comments] = await pool.execute(`
      SELECT tc.*, u.name AS user_name, u.avatar AS user_avatar
      FROM task_comments tc
      JOIN users u ON u.id = tc.user_id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at ASC
    `, [req.params.taskId]);

    res.json({ success: true, task: { ...rows[0], comments } });
  } catch (err) { next(err); }
});

// ── POST /api/projects/:projectId/tasks ───────────────────────
router.post(
  '/',
  authenticate,
  requireProjectMember,
  [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title required'),
    body('description').optional().isLength({ max: 5000 }),
    body('status').optional().isIn(['todo','in_progress','review','done']),
    body('priority').optional().isIn(['low','medium','high','critical']),
    body('assigned_to').optional({ nullable: true }).isString(),
    body('due_date').optional({ nullable: true }).isISO8601(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const {
        title,
        description  = null,
        status       = 'todo',
        priority     = 'medium',
        assigned_to  = null,
        due_date     = null,
      } = req.body;

      // Validate assignee is project member
      if (assigned_to) {
        const [check] = await pool.execute(
          'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
          [req.params.projectId, assigned_to]
        );
        if (!check.length && req.user.role !== 'admin') {
          return res.status(400).json({ success: false, message: 'Assignee is not a project member' });
        }
      }

      const id = uuidv4();
      await pool.execute(
        `INSERT INTO tasks (id, project_id, title, description, status, priority, assigned_to, created_by, due_date)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [id, req.params.projectId, title, description, status, priority, assigned_to, req.user.id, due_date]
      );

      await logActivity(req.user.id, req.params.projectId, id, 'task_created', `Task "${title}" created`);

      const [created] = await pool.execute(`
        SELECT t.*, ua.name AS assignee_name, ua.avatar AS assignee_avatar
        FROM tasks t LEFT JOIN users ua ON ua.id = t.assigned_to
        WHERE t.id = ?
      `, [id]);

      res.status(201).json({ success: true, message: 'Task created', task: created[0] });
    } catch (err) { next(err); }
  }
);

// ── PUT /api/projects/:projectId/tasks/:taskId ────────────────
router.put(
  '/:taskId',
  authenticate,
  requireProjectMember,
  [
    body('title').optional().trim().isLength({ min: 1, max: 200 }),
    body('status').optional().isIn(['todo','in_progress','review','done']),
    body('priority').optional().isIn(['low','medium','high','critical']),
    body('due_date').optional({ nullable: true }).isISO8601(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      // Members can only update tasks assigned to them; admins/project-admins can update any
      const [taskRows] = await pool.execute(
        'SELECT * FROM tasks WHERE id = ? AND project_id = ?',
        [req.params.taskId, req.params.projectId]
      );
      if (!taskRows.length) return res.status(404).json({ success: false, message: 'Task not found' });

      const task = taskRows[0];

      // Check permission for members
      if (req.user.role !== 'admin') {
        const [pmRows] = await pool.execute(
          'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
          [req.params.projectId, req.user.id]
        );
        const pmRole = pmRows[0]?.role;
        if (pmRole !== 'admin' && task.created_by !== req.user.id && task.assigned_to !== req.user.id) {
          return res.status(403).json({ success: false, message: 'Not authorized to update this task' });
        }
      }

      const fields = ['title','description','status','priority','assigned_to','due_date'];
      const updates = [];
      const values  = [];

      fields.forEach(f => {
        if (req.body[f] !== undefined) {
          updates.push(`${f} = ?`);
          values.push(req.body[f] === '' ? null : req.body[f]);
        }
      });

      if (!updates.length) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      values.push(req.params.taskId);
      await pool.execute(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);

      await logActivity(req.user.id, req.params.projectId, req.params.taskId, 'task_updated',
        `Task "${task.title}" updated`);

      const [updated] = await pool.execute(`
        SELECT t.*, ua.name AS assignee_name, ua.avatar AS assignee_avatar
        FROM tasks t LEFT JOIN users ua ON ua.id = t.assigned_to
        WHERE t.id = ?
      `, [req.params.taskId]);

      res.json({ success: true, task: updated[0] });
    } catch (err) { next(err); }
  }
);

// ── DELETE /api/projects/:projectId/tasks/:taskId ─────────────
router.delete('/:taskId', authenticate, requireProjectMember, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ? AND project_id = ?',
      [req.params.taskId, req.params.projectId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Task not found' });

    const task = rows[0];

    // Only creator, project admin, or global admin can delete
    if (req.user.role !== 'admin' && task.created_by !== req.user.id) {
      const [pmRows] = await pool.execute(
        'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
        [req.params.projectId, req.user.id]
      );
      if (!pmRows.length || pmRows[0].role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    await pool.execute('DELETE FROM tasks WHERE id = ?', [req.params.taskId]);
    res.json({ success: true, message: 'Task deleted' });
  } catch (err) { next(err); }
});

// ── POST /api/projects/:projectId/tasks/:taskId/comments ──────
router.post(
  '/:taskId/comments',
  authenticate,
  requireProjectMember,
  [body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Comment cannot be empty')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const id = uuidv4();
      await pool.execute(
        'INSERT INTO task_comments (id, task_id, user_id, content) VALUES (?,?,?,?)',
        [id, req.params.taskId, req.user.id, req.body.content]
      );

      const [created] = await pool.execute(`
        SELECT tc.*, u.name AS user_name, u.avatar AS user_avatar
        FROM task_comments tc JOIN users u ON u.id = tc.user_id
        WHERE tc.id = ?
      `, [id]);

      res.status(201).json({ success: true, comment: created[0] });
    } catch (err) { next(err); }
  }
);

// ── DELETE /api/projects/:projectId/tasks/:taskId/comments/:commentId ─
router.delete('/:taskId/comments/:commentId', authenticate, requireProjectMember, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM task_comments WHERE id = ? AND task_id = ?',
      [req.params.commentId, req.params.taskId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Comment not found' });

    if (rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await pool.execute('DELETE FROM task_comments WHERE id = ?', [req.params.commentId]);
    res.json({ success: true, message: 'Comment deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
