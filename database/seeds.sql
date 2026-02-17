-- Seed Data for Marriage-Focused Dating Platform
-- Compatibility Questions for Matching Algorithm

-- ============================================================================
-- COMPATIBILITY QUESTIONS
-- ============================================================================

INSERT INTO compatibility_questions (question_text, question_category, weight) VALUES
    -- Values & Beliefs (High Weight)
    ('How important is religion in your daily life?', 'values', 2.0),
    ('How do you approach religious practices (prayer, fasting, etc.)?', 'values', 1.8),
    ('What role should religion play in raising children?', 'family', 1.8),
    ('How important is cultural tradition to you?', 'values', 1.5),
    ('What are your views on gender roles in marriage?', 'values', 1.7),

    -- Family & Children (High Weight)
    ('How many children would you like to have?', 'family', 1.6),
    ('When would you like to start a family?', 'family', 1.5),
    ('How involved should extended family be in your marriage?', 'family', 1.4),
    ('What is your parenting philosophy?', 'family', 1.5),
    ('How important is it that your spouse gets along with your family?', 'family', 1.6),

    -- Lifestyle & Daily Life (Medium Weight)
    ('How do you prefer to spend your weekends?', 'lifestyle', 1.2),
    ('How important is financial stability before marriage?', 'lifestyle', 1.5),
    ('What is your approach to managing household finances?', 'lifestyle', 1.4),
    ('How important is having a career for both partners?', 'lifestyle', 1.3),
    ('Do you prefer living in a city, suburbs, or rural area?', 'lifestyle', 1.1),

    -- Communication & Conflict (Medium-High Weight)
    ('How do you typically handle disagreements?', 'communication', 1.6),
    ('How often do you like to communicate with your partner?', 'communication', 1.3),
    ('What is your communication style?', 'communication', 1.4),
    ('How important is emotional expressiveness to you?', 'communication', 1.2),

    -- Personal Growth & Interests (Medium Weight)
    ('How important is education and continuous learning?', 'personal', 1.2),
    ('How do you balance personal time with couple time?', 'personal', 1.3),
    ('What role does physical fitness play in your life?', 'personal', 1.0),
    ('How important are shared hobbies and interests?', 'personal', 1.1),

    -- Social & Community (Lower Weight)
    ('How important is community involvement to you?', 'social', 1.0),
    ('How often do you like to socialize with friends?', 'social', 0.9),
    ('What is your preferred social circle size?', 'social', 0.8),

    -- Marriage Expectations (High Weight)
    ('What does a successful marriage look like to you?', 'marriage', 1.7),
    ('How do you view the division of household responsibilities?', 'marriage', 1.5),
    ('What are your expectations for couple time vs. independent time?', 'marriage', 1.3),
    ('How important is physical intimacy in marriage?', 'marriage', 1.4);

-- ============================================================================
-- SAMPLE ADMIN USER (for testing)
-- ============================================================================
-- Note: In production, create admin users through a secure process
-- This is just a placeholder for development

-- Sample data can be added here for testing purposes
-- Example:
-- INSERT INTO users (firebase_uid, phone_number, status, account_type, phone_verified)
-- VALUES ('admin-firebase-uid-123', '+1234567890', 'active', 'super_admin', true);

-- ============================================================================
-- HELPFUL QUERIES FOR TESTING
-- ============================================================================

-- View all tables
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Count records in each table
-- SELECT 'users' as table_name, COUNT(*) FROM users
-- UNION ALL SELECT 'profiles', COUNT(*) FROM profiles
-- UNION ALL SELECT 'invite_codes', COUNT(*) FROM invite_codes
-- UNION ALL SELECT 'matches', COUNT(*) FROM matches
-- UNION ALL SELECT 'messages', COUNT(*) FROM messages
-- UNION ALL SELECT 'verifications', COUNT(*) FROM verifications
-- UNION ALL SELECT 'reports', COUNT(*) FROM reports
-- UNION ALL SELECT 'blocks', COUNT(*) FROM blocks
-- UNION ALL SELECT 'notifications', COUNT(*) FROM notifications
-- UNION ALL SELECT 'admin_actions', COUNT(*) FROM admin_actions
-- UNION ALL SELECT 'activity_log', COUNT(*) FROM activity_log
-- UNION ALL SELECT 'compatibility_questions', COUNT(*) FROM compatibility_questions
-- UNION ALL SELECT 'compatibility_answers', COUNT(*) FROM compatibility_answers;
