// Profile Controller - Handles all profile-related operations
const pool = require('../config/database');

// Helper function to convert camelCase to snake_case
const camelToSnake = (str) => {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

// Helper function to convert form data from camelCase to snake_case
const convertFormData = (data) => {
    const converted = {};
    for (const [key, value] of Object.entries(data)) {
        const snakeKey = camelToSnake(key);
        converted[snakeKey] = value;
    }
    return converted;
};

class ProfileController {
    /**
     * POST /api/profiles
     * Create a new profile
     */
    async createProfile(req, res) {
        try {
            const userId = req.user.id;

            // Check if user already has a profile
            const existingProfile = await pool.query(
                'SELECT id FROM profiles WHERE user_id = $1',
                [userId]
            );

            if (existingProfile.rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Profile already exists for this user'
                });
            }

            // Convert camelCase to snake_case
            const formData = convertFormData(req.body);

            // Handle uploaded photos
            const photoUrls = [];
            if (req.files && req.files.length > 0) {
                req.files.forEach(file => {
                    // Store relative path for URL access
                    photoUrls.push(`/uploads/profile-photos/${file.filename}`);
                });
            }

            // Parse JSON fields if they're strings
            const languages = formData.languages ?
                (typeof formData.languages === 'string' ? JSON.parse(formData.languages) : formData.languages) : null;
            const personalityTraits = formData.personality_traits ?
                (typeof formData.personality_traits === 'string' ? JSON.parse(formData.personality_traits) : formData.personality_traits) : null;
            const interests = formData.interests ?
                (typeof formData.interests === 'string' ? JSON.parse(formData.interests) : formData.interests) : null;

            const {
                // Basic Information
                first_name, last_name, date_of_birth, gender, bio,
                // Religious/Cultural
                religion, denomination, religiosity_level, tribe, ethnicity, state_of_origin,
                // Physical
                height, complexion, body_type,
                // Professional
                occupation, education, income_range, work_status, employment_status,
                // Lifestyle
                smoking, drinking, diet, exercise,
                // Family & Relationship
                marital_status, has_children, number_of_children, want_children, children_preference,
                living_situation, relationship_goals, willing_to_relocate,
                // Guardian
                has_guardian, guardian_name, guardian_phone, guardian_relationship,
                // Location
                city, state, country, latitude, longitude,
                // Other
                other_interest
            } = formData;

            // Calculate if profile is complete (has all required fields)
            const isComplete = !!(
                first_name && last_name && date_of_birth && gender &&
                city && religion && education && occupation && photoUrls.length >= 2
            );

            // Determine if guardian is provided
            const hasGuardian = !!(guardian_name && guardian_phone);

            const query = `
                INSERT INTO profiles (
                    user_id, first_name, last_name, date_of_birth, gender, bio,
                    religion, denomination, religiosity_level, tribe, ethnicity, languages,
                    height, complexion, body_type,
                    occupation, education, income_range, work_status,
                    smoking, drinking, diet, exercise,
                    marital_status, has_children, number_of_children, want_children,
                    living_situation, relationship_goals,
                    has_guardian, guardian_name, guardian_phone, guardian_relationship,
                    city, state, country, latitude, longitude,
                    photo_urls, is_complete, moderation_status
                ) VALUES (
                    $1, $2, $3, $4, $5, $6,
                    $7, $8, $9, $10, $11, $12,
                    $13, $14, $15,
                    $16, $17, $18, $19,
                    $20, $21, $22, $23,
                    $24, $25, $26, $27,
                    $28, $29,
                    $30, $31, $32, $33,
                    $34, $35, $36, $37, $38,
                    $39, $40, $41
                ) RETURNING *
            `;

            const values = [
                userId, first_name, last_name, date_of_birth, gender, bio || null,
                religion, denomination || null, religiosity_level || null, tribe, ethnicity || null,
                languages ? JSON.stringify(languages) : null,
                height || null, complexion || null, body_type || null,
                occupation, education, income_range || null, employment_status || work_status || null,
                smoking || null, drinking || null, diet || null, exercise || null,
                marital_status, has_children || false, number_of_children || null, children_preference || want_children || null,
                living_situation || null, relationship_goals || null,
                hasGuardian, guardian_name || null, guardian_phone || null, guardian_relationship || null,
                city, state_of_origin || state || null, country || 'Ghana', latitude || null, longitude || null,
                photoUrls.length > 0 ? JSON.stringify(photoUrls) : null,
                isComplete, 'pending' // New profiles need moderation
            ];

            const result = await pool.query(query, values);

            res.status(201).json({
                success: true,
                message: 'Profile created successfully. Awaiting moderation.',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Create profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create profile',
                details: error.message
            });
        }
    }

    /**
     * GET /api/profiles/me
     * Get current user's own profile
     */
    async getMyProfile(req, res) {
        try {
            const userId = req.user.id;

            const query = `
                SELECT p.* FROM profiles p
                WHERE p.user_id = $1
            `;

            const result = await pool.query(query, [userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile not found'
                });
            }

            res.json({
                success: true,
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Get my profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get profile'
            });
        }
    }

    /**
     * GET /api/profiles/:userId
     * Get another user's profile (respects privacy rules)
     */
    async getProfile(req, res) {
        try {
            const { userId } = req.params;
            const requesterId = req.user.id;

            // Check if users are matched (for photo privacy in Phase 6)
            const matchQuery = `
                SELECT is_mutual_match FROM matches
                WHERE (user_id_1 = $1 AND user_id_2 = $2)
                   OR (user_id_1 = $2 AND user_id_2 = $1)
            `;
            const matchResult = await pool.query(matchQuery, [requesterId, userId]);
            const isMatched = matchResult.rows.length > 0 && matchResult.rows[0].is_mutual_match;

            // Get profile
            const query = `
                SELECT
                    p.*,
                    u.status as account_status,
                    u.phone_verified
                FROM profiles p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id = $1
                    AND u.status = 'active'
                    AND p.moderation_status = 'approved'
                    AND p.is_active = true
            `;

            const result = await pool.query(query, [userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile not found or not available'
                });
            }

            const profile = result.rows[0];

            // Photo privacy: If not matched, return blurred photos
            // (This will be fully implemented in Phase 6)
            if (!isMatched && profile.blurred_photo_urls) {
                profile.photo_urls = profile.blurred_photo_urls;
                delete profile.blurred_photo_urls;
            }

            // Remove sensitive info for non-matched users
            if (!isMatched) {
                delete profile.guardian_phone;
                delete profile.guardian_name;
                delete profile.guardian_relationship;
            }

            res.json({
                success: true,
                data: profile,
                isMatched
            });

        } catch (error) {
            console.error('Get profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get profile'
            });
        }
    }

    /**
     * PUT /api/profiles/me
     * Update current user's profile
     */
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;

            // Check if profile exists
            const existingProfile = await pool.query(
                'SELECT * FROM profiles WHERE user_id = $1',
                [userId]
            );

            if (existingProfile.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Profile not found. Please create a profile first.'
                });
            }

            const {
                // Basic Information
                first_name, last_name, date_of_birth, gender, bio,
                // Religious/Cultural
                religion, denomination, religiosity_level, tribe, ethnicity, languages,
                // Physical
                height, complexion, body_type,
                // Professional
                occupation, education, income_range, work_status,
                // Lifestyle
                smoking, drinking, diet, exercise,
                // Family & Relationship
                marital_status, has_children, number_of_children, want_children,
                living_situation, relationship_goals,
                // Guardian
                has_guardian, guardian_name, guardian_phone, guardian_relationship,
                // Location
                city, state, country, latitude, longitude,
                // Photos
                photo_urls,
                // Preferences
                preferences
            } = req.body;

            // Build dynamic update query (only update provided fields)
            const updates = [];
            const values = [];
            let paramCount = 1;

            const addUpdate = (field, value) => {
                if (value !== undefined) {
                    updates.push(`${field} = $${paramCount}`);
                    values.push(value);
                    paramCount++;
                }
            };

            // Add all possible updates
            addUpdate('first_name', first_name);
            addUpdate('last_name', last_name);
            addUpdate('date_of_birth', date_of_birth);
            addUpdate('gender', gender);
            addUpdate('bio', bio);
            addUpdate('religion', religion);
            addUpdate('denomination', denomination);
            addUpdate('religiosity_level', religiosity_level);
            addUpdate('tribe', tribe);
            addUpdate('ethnicity', ethnicity);
            addUpdate('languages', languages ? JSON.stringify(languages) : undefined);
            addUpdate('height', height);
            addUpdate('complexion', complexion);
            addUpdate('body_type', body_type);
            addUpdate('occupation', occupation);
            addUpdate('education', education);
            addUpdate('income_range', income_range);
            addUpdate('work_status', work_status);
            addUpdate('smoking', smoking);
            addUpdate('drinking', drinking);
            addUpdate('diet', diet);
            addUpdate('exercise', exercise);
            addUpdate('marital_status', marital_status);
            addUpdate('has_children', has_children);
            addUpdate('number_of_children', number_of_children);
            addUpdate('want_children', want_children);
            addUpdate('living_situation', living_situation);
            addUpdate('relationship_goals', relationship_goals);
            addUpdate('has_guardian', has_guardian);
            addUpdate('guardian_name', guardian_name);
            addUpdate('guardian_phone', guardian_phone);
            addUpdate('guardian_relationship', guardian_relationship);
            addUpdate('city', city);
            addUpdate('state', state);
            addUpdate('country', country);
            addUpdate('latitude', latitude);
            addUpdate('longitude', longitude);
            addUpdate('photo_urls', photo_urls ? JSON.stringify(photo_urls) : undefined);
            addUpdate('preferences', preferences ? JSON.stringify(preferences) : undefined);

            // If significant changes, reset moderation status
            if (first_name || last_name || photo_urls) {
                addUpdate('moderation_status', 'pending');
            }

            // Always update timestamp
            updates.push(`updated_at = CURRENT_TIMESTAMP`);

            if (updates.length === 1) { // Only timestamp update
                return res.status(400).json({
                    success: false,
                    error: 'No fields to update'
                });
            }

            // Build and execute query
            values.push(userId);
            const query = `
                UPDATE profiles
                SET ${updates.join(', ')}
                WHERE user_id = $${paramCount}
                RETURNING *
            `;

            const result = await pool.query(query, values);

            res.json({
                success: true,
                message: 'Profile updated successfully',
                data: result.rows[0]
            });

        } catch (error) {
            console.error('Update profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update profile',
                details: error.message
            });
        }
    }

    /**
     * GET /api/profiles
     * Browse profiles for matching (requires approved account)
     * Query params: page, limit
     */
    async browseProfiles(req, res) {
        try {
            const userId = req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;

            // Get current user's profile to apply preferences
            const myProfileQuery = 'SELECT gender, preferences FROM profiles WHERE user_id = $1';
            const myProfileResult = await pool.query(myProfileQuery, [userId]);

            if (myProfileResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Please create your profile first'
                });
            }

            const myProfile = myProfileResult.rows[0];
            const preferences = myProfile.preferences || {};

            // Build query to get compatible profiles
            // Exclude: own profile, already matched/passed, blocked users
            const query = `
                SELECT
                    p.*,
                    u.phone_verified
                FROM profiles p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id != $1
                    AND u.status = 'active'
                    AND p.moderation_status = 'approved'
                    AND p.is_active = true
                    AND p.is_complete = true
                    AND p.gender != $2  -- Opposite gender
                    AND p.user_id NOT IN (
                        -- Already interacted with
                        SELECT CASE
                            WHEN user_id_1 = $1 THEN user_id_2
                            WHEN user_id_2 = $1 THEN user_id_1
                        END
                        FROM matches
                        WHERE user_id_1 = $1 OR user_id_2 = $1
                    )
                    AND p.user_id NOT IN (
                        -- Blocked users
                        SELECT blocked_id FROM blocks WHERE blocker_id = $1
                        UNION
                        SELECT blocker_id FROM blocks WHERE blocked_id = $1
                    )
                ORDER BY p.last_active_at DESC
                LIMIT $3 OFFSET $4
            `;

            const result = await pool.query(query, [
                userId,
                myProfile.gender,
                limit,
                offset
            ]);

            // Return blurred photos (full implementation in Phase 6)
            const profiles = result.rows.map(profile => {
                if (profile.blurred_photo_urls) {
                    profile.photo_urls = profile.blurred_photo_urls;
                }
                delete profile.blurred_photo_urls;
                delete profile.guardian_phone;
                delete profile.guardian_name;
                delete profile.guardian_relationship;
                return profile;
            });

            res.json({
                success: true,
                data: profiles,
                pagination: {
                    page,
                    limit,
                    count: profiles.length
                }
            });

        } catch (error) {
            console.error('Browse profiles error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to browse profiles'
            });
        }
    }
}

module.exports = new ProfileController();
