const pool = require('./src/config/database');

async function checkCodes() {
    try {
        const result = await pool.query(`
            SELECT code, is_active, max_uses, times_used, expires_at
            FROM invite_codes
            ORDER BY created_at DESC
            LIMIT 10
        `);

        console.log('\n📋 INVITE CODES IN DATABASE:\n');
        if (result.rows.length === 0) {
            console.log('❌ No invite codes found!\n');
        } else {
            result.rows.forEach((row, i) => {
                console.log(`${i + 1}. Code: ${row.code}`);
                console.log(`   Active: ${row.is_active}`);
                console.log(`   Uses: ${row.times_used}/${row.max_uses}`);
                console.log(`   Expires: ${row.expires_at || 'Never'}\n`);
            });
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkCodes();
