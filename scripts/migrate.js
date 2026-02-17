// Database Migration Script - Run once on deployment
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting database migration...');

    const schema = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');

    // Split by semicolons and run each statement
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let success = 0;
    let skipped = 0;

    for (const statement of statements) {
      try {
        await client.query(statement);
        success++;
      } catch (err) {
        if (err.code === '42P07' || err.code === '42710' || err.message.includes('already exists')) {
          skipped++;
        } else {
          console.warn(`⚠️  Warning: ${err.message.substring(0, 80)}`);
        }
      }
    }

    console.log(`✅ Migration complete! ${success} statements ran, ${skipped} already existed.`);

    // Create admin user
    const { v4: uuidv4 } = require('uuid');
    const adminUid = 'admin-firebase-uid-' + Date.now();
    const adminPhone = '+000000000000';

    // Check if admin exists
    const existing = await client.query("SELECT id FROM users WHERE account_type = 'admin' LIMIT 1");

    if (existing.rows.length === 0) {
      const adminResult = await client.query(
        `INSERT INTO users (firebase_uid, phone_number, status, account_type, phone_verified)
         VALUES ($1, $2, 'active', 'admin', true) RETURNING id`,
        [adminUid, adminPhone]
      );
      const adminId = adminResult.rows[0].id;

      const code = 'WELCOME1';
      await client.query(
        `INSERT INTO invite_codes (code, created_by, max_uses, times_used, is_active)
         VALUES ($1, $2, 100, 0, true)`,
        [code, adminId]
      );

      console.log('✅ Admin user created!');
      console.log(`📋 Invite Code: ${code}`);
      console.log(`👤 Admin ID: ${adminId}`);
    } else {
      console.log('ℹ️  Admin already exists, skipping creation.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
};

migrate();
