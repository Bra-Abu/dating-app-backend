// Database Migration Script - Safe for production (won't drop existing data)
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrate = async () => {
  const client = await pool.connect();
  try {
    console.log('🚀 Running database migration...');

    await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // USERS TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        firebase_uid VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(20) UNIQUE NOT NULL,
        email VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'suspended', 'banned', 'deleted')),
        account_type VARCHAR(50) DEFAULT 'user' CHECK (account_type IN ('user', 'admin', 'super_admin')),
        invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
        invite_code_used VARCHAR(20),
        approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP,
        phone_verified BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false
      )
    `);

    // PROFILES TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        date_of_birth DATE NOT NULL,
        gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female')),
        bio TEXT,
        religion VARCHAR(50) CHECK (religion IN ('Islam', 'Christianity', 'Judaism', 'Hinduism', 'Buddhism', 'Other', 'Prefer not to say')),
        denomination VARCHAR(100),
        religiosity_level VARCHAR(50) CHECK (religiosity_level IN ('Very Religious', 'Religious', 'Moderately Religious', 'Spiritual', 'Not Religious')),
        tribe VARCHAR(100),
        ethnicity VARCHAR(100),
        languages JSONB,
        height INTEGER,
        complexion VARCHAR(50) CHECK (complexion IN ('Very Fair', 'Fair', 'Medium', 'Olive', 'Brown', 'Dark Brown', 'Very Dark')),
        body_type VARCHAR(50) CHECK (body_type IN ('Slim', 'Athletic', 'Average', 'Muscular', 'Curvy', 'Heavy')),
        occupation VARCHAR(200),
        education VARCHAR(100) CHECK (education IN ('High School', 'Associate Degree', 'Bachelor Degree', 'Master Degree', 'Doctorate', 'Professional Degree', 'Trade School', 'Other')),
        income_range VARCHAR(50) CHECK (income_range IN ('Prefer not to say', 'Below $25k', '$25k-$50k', '$50k-$75k', '$75k-$100k', '$100k-$150k', '$150k-$200k', 'Above $200k')),
        work_status VARCHAR(50) CHECK (work_status IN ('Employed Full-time', 'Employed Part-time', 'Self-employed', 'Student', 'Unemployed', 'Retired')),
        smoking VARCHAR(50) CHECK (smoking IN ('Never', 'Occasionally', 'Regularly', 'Quit')),
        drinking VARCHAR(50) CHECK (drinking IN ('Never', 'Socially', 'Occasionally', 'Regularly')),
        diet VARCHAR(50) CHECK (diet IN ('No Restrictions', 'Halal', 'Kosher', 'Vegetarian', 'Vegan', 'Pescatarian')),
        exercise VARCHAR(50) CHECK (exercise IN ('Daily', 'Several times a week', 'Once a week', 'Occasionally', 'Never')),
        marital_status VARCHAR(50) CHECK (marital_status IN ('Never Married', 'Divorced', 'Widowed', 'Separated')),
        has_children BOOLEAN DEFAULT false,
        number_of_children INTEGER,
        want_children VARCHAR(50) CHECK (want_children IN ('Definitely Yes', 'Probably Yes', 'Undecided', 'Probably No', 'Definitely No')),
        living_situation VARCHAR(100) CHECK (living_situation IN ('Live Alone', 'With Parents', 'With Roommates', 'With Children', 'Other')),
        relationship_goals VARCHAR(100) CHECK (relationship_goals IN ('Marriage', 'Long-term Relationship', 'Friendship First', 'Undecided')),
        has_guardian BOOLEAN DEFAULT false,
        guardian_name VARCHAR(200),
        guardian_phone VARCHAR(20),
        guardian_relationship VARCHAR(100),
        city VARCHAR(100),
        state VARCHAR(100),
        country VARCHAR(100) DEFAULT 'Ghana',
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        photo_urls JSONB,
        blurred_photo_urls JSONB,
        preferences JSONB,
        personality_traits JSONB,
        interests JSONB,
        is_complete BOOLEAN DEFAULT false,
        moderation_status VARCHAR(50) DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
        moderation_notes TEXT,
        rejection_reason TEXT,
        profile_views INTEGER DEFAULT 0,
        last_active TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_moderated_at TIMESTAMP
      )
    `);

    // INVITE CODES TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS invite_codes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        code VARCHAR(20) UNIQUE NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        max_uses INTEGER DEFAULT 5,
        times_used INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // MATCHES TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(20) NOT NULL CHECK (action IN ('liked', 'passed')),
        is_mutual BOOLEAN DEFAULT false,
        compatibility_score INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, target_user_id)
      )
    `);

    // MESSAGES TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'guardian_alert')),
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        is_deleted BOOLEAN DEFAULT false,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // VERIFICATIONS TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS verifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        verification_type VARCHAR(50) NOT NULL CHECK (verification_type IN ('phone', 'photo', 'id')),
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        file_url VARCHAR(500),
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        reviewed_by UUID REFERENCES users(id),
        rejection_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // REPORTS TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason VARCHAR(100) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP,
        resolution_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // BLOCKS TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS blocks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocker_id, blocked_id)
      )
    `);

    // NOTIFICATIONS TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255),
        message TEXT,
        data JSONB,
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ACTIVITY LOG TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50),
        entity_id UUID,
        details JSONB,
        ip_address VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ADMIN ACTIONS TABLE
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_actions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action_type VARCHAR(100) NOT NULL,
        target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        details JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ All tables created successfully!');

    // Create admin user if none exists
    const existing = await client.query("SELECT id FROM users WHERE account_type = 'admin' LIMIT 1");

    if (existing.rows.length === 0) {
      const adminResult = await client.query(
        `INSERT INTO users (firebase_uid, phone_number, status, account_type, phone_verified)
         VALUES ($1, $2, 'active', 'admin', true) RETURNING id`,
        ['admin-uid-production', '+000000000000']
      );
      const adminId = adminResult.rows[0].id;

      await client.query(
        `INSERT INTO invite_codes (code, created_by, max_uses, times_used, is_active)
         VALUES ($1, $2, 999, 0, true)`,
        ['WELCOME1', adminId]
      );

      console.log('✅ Admin user created!');
      console.log('📋 Invite Code: WELCOME1');
    } else {
      console.log('ℹ️  Tables already exist, migration skipped.');
    }

  } catch (error) {
    console.error('❌ Migration error:', error.message);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = migrate;
