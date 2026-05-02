// server/database/db.js
// MySQL connection pool using mysql2/promise

require('dotenv').config();
const mysql = require('mysql2/promise');

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

// Test connectivity on startup
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅  MySQL connected successfully');
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
