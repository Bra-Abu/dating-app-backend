// Database Migration Script
// Run this to set up the entire database schema and seed data

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('🚀 Starting database migration...\n');

        // Read schema file
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

        console.log('📋 Running schema.sql...');
        await client.query(schemaSQL);
        console.log('✅ Schema created successfully!\n');

        // Read seeds file
        const seedsPath = path.join(__dirname, 'seeds.sql');
        const seedsSQL = fs.readFileSync(seedsPath, 'utf8');

        console.log('🌱 Running seeds.sql...');
        await client.query(seedsSQL);
        console.log('✅ Seed data inserted successfully!\n');

        // Verify tables
        const tablesQuery = `
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        `;

        const result = await client.query(tablesQuery);
        console.log('📊 Tables created:');
        result.rows.forEach(row => {
            console.log(`   ✓ ${row.table_name}`);
        });

        // Count compatibility questions
        const countQuery = 'SELECT COUNT(*) FROM compatibility_questions';
        const countResult = await client.query(countQuery);
        console.log(`\n🎯 Compatibility questions seeded: ${countResult.rows[0].count}`);

        console.log('\n✅ Database migration completed successfully!');
        console.log('🎉 Your marriage-focused dating platform database is ready!\n');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run migration
migrate();
