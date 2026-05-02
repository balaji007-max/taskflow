// server/routes/dashboard.js
// Aggregated stats for the dashboard

const express = require('express');
const { pool } = require('../database/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/dashboard  ───────────────────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId  = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // ── Summary counts ──────────────────────────────────────
    let projectsCount, tasksCount, overdueCount, completedCount;

    if (isAdmin) {
      [[{ cnt: projectsCount }]] = await pool.execute(
        'SELECT COUNT(*) AS cnt FROM projects WHERE status = "active"'
      );
      [[{ cnt: tasksCount }]] = await pool.execute('SELECT COUNT(*) AS cnt FROM tasks');
      [[{ cnt: overdueCount }]] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM tasks
         WHERE due_date < CURDATE() AND status != 'done'`
      );
      [[{ cnt: completedCount }]] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM tasks WHERE status = 'done'`
      );
    } else {
      [[{ cnt: projectsCount }]] = await pool.execute(
        `SELECT COUNT(DISTINCT p.id) AS cnt
         FROM projects p JOIN project_members pm ON pm.project_id = p.id
         WHERE pm.user_id = ? AND p.status = 'active'`,
        [userId]
      );
      [[{ cnt: tasksCount }]] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM tasks
         WHERE assigned_to = ? OR created_by = ?`,
        [userId, userId]
      );
      [[{ cnt: overdueCount }]] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM tasks
         WHERE (assigned_to = ? OR created_by = ?)
           AND due_date < CURDATE() AND status != 'done'`,
        [userId, userId]
      );
      [[{ cnt: completedCount }]] = await pool.execute(
        `SELECT COUNT(*) AS cnt FROM tasks
         WHERE (assigned_to = ? OR created_by = ?) AND status = 'done'`,
        [userId, userId]
      );
    }

    // ── Task status breakdown ────────────────────────────────
    let statusBreakdown;
    if (isAdmin) {
      [statusBreakdown] = await pool.execute(`
        SELECT status, COUNT(*) AS cnt FROM tasks GROUP BY status
      `);
    } else {
      [statusBreakdown] = await pool.execute(`
        SELECT status, COUNT(*) AS cnt FROM tasks
        WHERE assigned_to = ? OR created_by = ?
        GROUP BY status
      `, [userId, userId]);
    }

    // ── My tasks (assigned to me) ────────────────────────────
    const [myTasks] = await pool.execute(`
      SELECT t.id, t.title, t.status, t.priority, t.due_date,
             p.name AS project_name, p.color AS project_color
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.assigned_to = ? AND t.status != 'done'
      ORDER BY
        CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        t.due_date ASC
      LIMIT 10
    `, [userId]);

    // ── Overdue tasks ────────────────────────────────────────
    let overdueTasks;
    if (isAdmin) {
      [overdueTasks] = await pool.execute(`
        SELECT t.id, t.title, t.priority, t.due_date,
               p.name AS project_name, p.color AS project_color,
               u.name AS assignee_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.assigned_to
        WHERE t.due_date < CURDATE() AND t.status != 'done'
        ORDER BY t.due_date ASC
        LIMIT 10
      `);
    } else {
      [overdueTasks] = await pool.execute(`
        SELECT t.id, t.title, t.priority, t.due_date,
               p.name AS project_name, p.color AS project_color,
               u.name AS assignee_name
        FROM tasks t
        JOIN projects p ON p.id = t.project_id
        LEFT JOIN users u ON u.id = t.assigned_to
        WHERE (t.assigned_to = ? OR t.created_by = ?)
          AND t.due_date < CURDATE() AND t.status != 'done'
        ORDER BY t.due_date ASC
        LIMIT 10
      `, [userId, userId]);
    }

    // ── Recent activity ──────────────────────────────────────
    let recentActivity;
    if (isAdmin) {
      [recentActivity] = await pool.execute(`
        SELECT al.*, u.name AS user_name, u.avatar AS user_avatar
        FROM activity_log al
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 20
      `);
    } else {
      [recentActivity] = await pool.execute(`
        SELECT al.*, u.name AS user_name, u.avatar AS user_avatar
        FROM activity_log al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.user_id = ?
           OR al.project_id IN (
             SELECT project_id FROM project_members WHERE user_id = ?
           )
        ORDER BY al.created_at DESC
        LIMIT 20
      `, [userId, userId]);
    }

    // ── Recent projects ──────────────────────────────────────
    let recentProjects;
    if (isAdmin) {
      [recentProjects] = await pool.execute(`
        SELECT p.*, COUNT(DISTINCT t.id) AS task_count,
               COUNT(DISTINCT CASE WHEN t.status='done' THEN t.id END) AS done_count
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        WHERE p.status = 'active'
        GROUP BY p.id
        ORDER BY p.updated_at DESC
        LIMIT 6
      `);
    } else {
      [recentProjects] = await pool.execute(`
        SELECT p.*, COUNT(DISTINCT t.id) AS task_count,
               COUNT(DISTINCT CASE WHEN t.status='done' THEN t.id END) AS done_count
        FROM projects p
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
        LEFT JOIN tasks t ON t.project_id = p.id
        WHERE p.status = 'active'
        GROUP BY p.id
        ORDER BY p.updated_at DESC
        LIMIT 6
      `, [userId]);
    }

    res.json({
      success: true,
      stats: {
        projects:  projectsCount,
        tasks:     tasksCount,
        overdue:   overdueCount,
        completed: completedCount,
      },
      statusBreakdown,
      myTasks,
      overdueTasks,
      recentActivity,
      recentProjects,
    });
  } catch (err) { next(err); }
});

module.exports = router;
