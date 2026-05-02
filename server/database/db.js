// server/database/db.js
// MySQL connection pool using mysql2/promise

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

const poolConfig = {
  host:               process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT      || '3306', 10),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'task_team_manager',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+00:00',
  charset:            'utf8mb4',
};

const pool = mysql.createPool(poolConfig);

// ── Auto-create tables if they don't exist ────────────────────
async function autoSetup() {
  try {
    // Check if 'users' table exists
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables
       WHERE table_schema = ? AND table_name = 'users'`,
      [process.env.DB_NAME || 'task_team_manager']
    );

    if (Number(rows[0].cnt) === 0) {
      console.log('🔧  Tables not found — running auto database setup…');

      // Read and execute schema (skip CREATE DATABASE line for Railway)
      const schemaPath = path.join(__dirname, 'schema.sql');
      const fullSQL    = fs.readFileSync(schemaPath, 'utf8');

      // Remove CREATE DATABASE and USE statements (Railway manages the DB)
      const safeSQL = fullSQL
        .replace(/CREATE DATABASE.*?;/gis, '')
        .replace(/USE\s+\w+\s*;/gi, '');

      // Split by semicolon and run each statement
      const statements = safeSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      const conn = await mysql.createConnection({
        host:     process.env.DB_HOST     || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user:     process.env.DB_USER     || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME     || 'task_team_manager',
      });

      for (const stmt of statements) {
        try {
          await conn.execute(stmt);
        } catch (e) {
          // Ignore "already exists" errors
          if (!e.message.includes('already exists') && !e.message.includes('Duplicate')) {
            console.warn('⚠️  SQL warning:', e.message.substring(0, 80));
          }
        }
      }
      await conn.end();
      console.log('✅  All tables created automatically!');
    }
  } catch (err) {
    console.error('❌  Auto-setup error:', err.message);
  }
}

// Test connectivity on startup
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅  MySQL connected successfully');
    conn.release();
    // Auto-create tables after successful connection
    await autoSetup();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
