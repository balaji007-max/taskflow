// server/database/setup.js
// Run once to create all tables: node server/database/setup.js

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

async function setup() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  console.log('🔧  Running database setup…');

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await conn.query(sql);

  console.log('✅  All tables created successfully.');
  await conn.end();
}

setup().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
