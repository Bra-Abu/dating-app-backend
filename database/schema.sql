-- Marriage-Focused Dating Platform Database Schema
-- Drop existing tables if they exist (in reverse order of dependencies)
DROP TABLE IF EXISTS admin_actions CASCADE;
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS verifications CASCADE;
DROP TABLE IF EXISTS compatibility_answers CASCADE;
DROP TABLE IF EXISTS compatibility_questions CASCADE;
DROP TABLE IF EXISTS invite_codes CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255),

    -- Account status and type
    status VARCHAR(50) DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'suspended', 'banned', 'deleted')),
    account_type VARCHAR(50) DEFAULT 'user' CHECK (account_type IN ('user', 'admin', 'super_admin')),

    -- Invite tracking
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    invite_code_used VARCHAR(20),

    -- Approval tracking
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,

    -- Verification
    phone_verified BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false
);

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Basic Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female')),
    bio TEXT,

    -- Religious/Cultural Information
    religion VARCHAR(50) CHECK (religion IN ('Islam', 'Christianity', 'Judaism', 'Hinduism', 'Buddhism', 'Other', 'Prefer not to say')),
    denomination VARCHAR(100), -- e.g., "Sunni", "Catholic", "Orthodox"
    religiosity_level VARCHAR(50) CHECK (religiosity_level IN ('Very Religious', 'Religious', 'Moderately Religious', 'Spiritual', 'Not Religious')),
    tribe VARCHAR(100),
    ethnicity VARCHAR(100),
    languages JSONB, -- Array of languages: ["English", "Arabic", "French"]

    -- Physical Attributes
    height INTEGER, -- in centimeters
    complexion VARCHAR(50) CHECK (complexion IN ('Very Fair', 'Fair', 'Medium', 'Olive', 'Brown', 'Dark Brown', 'Very Dark')),
    body_type VARCHAR(50) CHECK (body_type IN ('Slim', 'Athletic', 'Average', 'Muscular', 'Curvy', 'Heavy')),

    -- Professional Information
    occupation VARCHAR(200),
    education VARCHAR(100) CHECK (education IN ('High School', 'Associate Degree', 'Bachelor Degree', 'Master Degree', 'Doctorate', 'Professional Degree', 'Trade School', 'Other')),
    income_range VARCHAR(50) CHECK (income_range IN ('Prefer not to say', 'Below $25k', '$25k-$50k', '$50k-$75k', '$75k-$100k', '$100k-$150k', '$150k-$200k', 'Above $200k')),
    work_status VARCHAR(50) CHECK (work_status IN ('Employed Full-time', 'Employed Part-time', 'Self-employed', 'Student', 'Unemployed', 'Retired')),

    -- Lifestyle
    smoking VARCHAR(50) CHECK (smoking IN ('Never', 'Occasionally', 'Regularly', 'Quit')),
    drinking VARCHAR(50) CHECK (drinking IN ('Never', 'Socially', 'Occasionally', 'Regularly')),
    diet VARCHAR(50) CHECK (diet IN ('No Restrictions', 'Halal', 'Kosher', 'Vegetarian', 'Vegan', 'Pescatarian')),
    exercise VARCHAR(50) CHECK (exercise IN ('Daily', 'Several times a week', 'Once a week', 'Occasionally', 'Never')),

    -- Family & Relationship
    marital_status VARCHAR(50) CHECK (marital_status IN ('Never Married', 'Divorced', 'Widowed', 'Separated')),
    has_children BOOLEAN DEFAULT false,
    number_of_children INTEGER DEFAULT 0,
    want_children VARCHAR(50) CHECK (want_children IN ('Definitely Yes', 'Probably Yes', 'Undecided', 'Probably No', 'Definitely No')),
    living_situation VARCHAR(100) CHECK (living_situation IN ('Live Alone', 'With Parents', 'With Roommates', 'With Children', 'Other')),
    relationship_goals VARCHAR(100) CHECK (relationship_goals IN ('Marriage', 'Long-term Relationship', 'Friendship First', 'Undecided')),

    -- Guardian Information (for Muslim women)
    has_guardian BOOLEAN DEFAULT false,
    guardian_name VARCHAR(200),
    guardian_phone VARCHAR(20),
    guardian_relationship VARCHAR(100), -- e.g., "Father", "Brother", "Uncle"

    -- Location
    city VARCHAR(200),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Nigeria',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),

    -- Photos (JSON arrays of URLs)
    photo_urls JSONB, -- ["url1.jpg", "url2.jpg", ...]
    blurred_photo_urls JSONB, -- Blurred versions for privacy

    -- Preferences (Matching Criteria)
    preferences JSONB, -- Complex JSON object with all preferences
    /*
    Example preferences structure:
    {
        "age_min": 25,
        "age_max": 35,
        "height_min": 160,
        "height_max": 190,
        "religions": ["Islam", "Christianity"],
        "denominations": ["Sunni", "Catholic"],
        "tribes": ["Yoruba", "Igbo"],
        "education_levels": ["Bachelor Degree", "Master Degree"],
        "max_distance_km": 50,
        "must_have_children": false,
        "must_want_children": true,
        "acceptable_marital_status": ["Never Married", "Divorced"]
    }
    */

    -- Profile Status
    is_complete BOOLEAN DEFAULT false,
    moderation_status VARCHAR(50) DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
    moderation_notes TEXT,
    moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    moderated_at TIMESTAMP,

    -- Activity
    is_active BOOLEAN DEFAULT true,
    last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INVITE CODES TABLE
-- ============================================================================
CREATE TABLE invite_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(20) UNIQUE NOT NULL,

    -- Usage tracking
    max_uses INTEGER DEFAULT 5,
    times_used INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- COMPATIBILITY QUESTIONS TABLE
-- ============================================================================
CREATE TABLE compatibility_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_text TEXT NOT NULL,
    question_category VARCHAR(100), -- e.g., "values", "lifestyle", "family"
    weight DECIMAL(3, 2) DEFAULT 1.0, -- Importance weight for matching algorithm
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- COMPATIBILITY ANSWERS TABLE
-- ============================================================================
CREATE TABLE compatibility_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES compatibility_questions(id) ON DELETE CASCADE,
    answer_text TEXT,
    answer_value INTEGER, -- Numeric value for comparison (e.g., 1-5 scale)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, question_id)
);

-- ============================================================================
-- VERIFICATIONS TABLE
-- ============================================================================
CREATE TABLE verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verification_type VARCHAR(50) NOT NULL CHECK (verification_type IN ('phone', 'photo', 'id')),

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

    -- Files
    selfie_url TEXT,
    id_document_url TEXT,

    -- Review
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    admin_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MATCHES TABLE
-- ============================================================================
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Actions
    user_1_action VARCHAR(20) CHECK (user_1_action IN ('liked', 'passed', 'unmatched')),
    user_2_action VARCHAR(20) CHECK (user_2_action IN ('liked', 'passed', 'unmatched')),

    -- Match status
    is_mutual_match BOOLEAN DEFAULT false,
    matched_at TIMESTAMP,

    -- Compatibility
    compatibility_score DECIMAL(5, 2), -- 0-100
    score_breakdown JSONB, -- Detailed breakdown of scoring

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'unmatched', 'blocked')),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique pairing (regardless of order)
    UNIQUE(user_id_1, user_id_2),
    CHECK (user_id_1 <> user_id_2)
);

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Message content
    message_text TEXT NOT NULL,
    message_type VARCHAR(50) DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'guardian_alert')),

    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,

    -- Guardian notification
    guardian_notified BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- REPORTS TABLE
-- ============================================================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Report details
    report_type VARCHAR(100) NOT NULL CHECK (report_type IN ('fake_profile', 'harassment', 'scam', 'inappropriate_content', 'impersonation', 'spam', 'other')),
    description TEXT NOT NULL,
    evidence_urls JSONB, -- Screenshots or other evidence

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'resolved', 'dismissed')),

    -- Resolution
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    action_taken VARCHAR(100), -- e.g., "User Suspended", "Warning Issued", "No Action"
    admin_notes TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- BLOCKS TABLE
-- ============================================================================
CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(200),

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Notification details
    notification_type VARCHAR(100) NOT NULL CHECK (notification_type IN ('new_match', 'new_message', 'profile_approved', 'profile_rejected', 'verification_needed', 'verification_approved', 'verification_rejected', 'account_suspended', 'new_like')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Related entities
    related_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    related_match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    related_message_id UUID REFERENCES messages(id) ON DELETE CASCADE,

    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ADMIN ACTIONS TABLE (Audit Log)
-- ============================================================================
CREATE TABLE admin_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Action details
    action_type VARCHAR(100) NOT NULL, -- e.g., "approve_user", "reject_verification", "suspend_user"
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    target_entity_type VARCHAR(100), -- e.g., "user", "profile", "verification", "report"
    target_entity_id UUID,

    -- Details
    reason TEXT,
    details JSONB, -- Additional structured data

    -- IP and metadata
    ip_address INET,
    user_agent TEXT,

    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ACTIVITY LOG TABLE (Anti-Fake Measures)
-- ============================================================================
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Activity details
    activity_type VARCHAR(100) NOT NULL, -- e.g., "login", "profile_view", "like", "pass", "message", "profile_update"
    target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Metadata
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    location_info JSONB,

    -- Suspicious activity flags
    is_suspicious BOOLEAN DEFAULT false,
    suspicious_reason VARCHAR(255),

    -- Timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users table indexes
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_phone_number ON users(phone_number);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_account_type ON users(account_type);
CREATE INDEX idx_users_invited_by ON users(invited_by);

-- Profiles table indexes
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_gender ON profiles(gender);
CREATE INDEX idx_profiles_religion ON profiles(religion);
CREATE INDEX idx_profiles_city ON profiles(city);
CREATE INDEX idx_profiles_moderation_status ON profiles(moderation_status);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);
CREATE INDEX idx_profiles_location ON profiles(latitude, longitude);

-- Invite codes table indexes
CREATE INDEX idx_invite_codes_user_id ON invite_codes(user_id);
CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_is_active ON invite_codes(is_active);

-- Matches table indexes
CREATE INDEX idx_matches_user_id_1 ON matches(user_id_1);
CREATE INDEX idx_matches_user_id_2 ON matches(user_id_2);
CREATE INDEX idx_matches_is_mutual ON matches(is_mutual_match);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_created_at ON matches(created_at DESC);

-- Messages table indexes
CREATE INDEX idx_messages_match_id ON messages(match_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_is_read ON messages(is_read);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Verifications table indexes
CREATE INDEX idx_verifications_user_id ON verifications(user_id);
CREATE INDEX idx_verifications_status ON verifications(status);
CREATE INDEX idx_verifications_type ON verifications(verification_type);

-- Reports table indexes
CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_reported_user_id ON reports(reported_user_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);

-- Blocks table indexes
CREATE INDEX idx_blocks_blocker_id ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked_id ON blocks(blocked_id);

-- Notifications table indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Admin actions table indexes
CREATE INDEX idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX idx_admin_actions_target_user_id ON admin_actions(target_user_id);
CREATE INDEX idx_admin_actions_action_type ON admin_actions(action_type);
CREATE INDEX idx_admin_actions_created_at ON admin_actions(created_at DESC);

-- Activity log table indexes
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_activity_type ON activity_log(activity_type);
CREATE INDEX idx_activity_log_is_suspicious ON activity_log(is_suspicious);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_activity_log_ip_address ON activity_log(ip_address);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for verified and approved profiles
CREATE VIEW verified_profiles AS
SELECT
    p.*,
    u.phone_verified,
    COALESCE(v_photo.status = 'approved', false) AS photo_verified,
    COALESCE(v_id.status = 'approved', false) AS id_verified
FROM profiles p
JOIN users u ON p.user_id = u.id
LEFT JOIN verifications v_photo ON p.user_id = v_photo.user_id AND v_photo.verification_type = 'photo'
LEFT JOIN verifications v_id ON p.user_id = v_id.user_id AND v_id.verification_type = 'id'
WHERE u.status = 'active'
    AND p.moderation_status = 'approved'
    AND p.is_active = true;

-- Helper function to calculate age from date_of_birth
CREATE OR REPLACE FUNCTION calculate_age(dob DATE)
RETURNS INTEGER AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM AGE(dob));
END;
$$ LANGUAGE plpgsql STABLE;

-- View for match suggestions (simplified)
CREATE VIEW match_suggestions AS
SELECT
    p1.user_id AS user_id,
    p2.user_id AS suggested_user_id,
    p2.first_name,
    p2.gender,
    p2.religion,
    p2.city,
    EXTRACT(YEAR FROM AGE(p2.date_of_birth)) AS age,
    p2.photo_urls
FROM profiles p1
CROSS JOIN profiles p2
WHERE p1.user_id <> p2.user_id
    AND p1.is_active = true
    AND p2.is_active = true
    AND p1.gender <> p2.gender; -- Basic filtering

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invite_codes_updated_at BEFORE UPDATE ON invite_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_verifications_updated_at BEFORE UPDATE ON verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_compatibility_answers_updated_at BEFORE UPDATE ON compatibility_answers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA SETUP
-- ============================================================================

-- This schema is now ready for use!
-- Next step: Run seeds.sql to populate compatibility_questions
