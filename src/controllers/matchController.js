// Match Controller - Handles matching, liking, passing logic
const pool = require('../config/database');
const matchingService = require('../services/matchingService');

class MatchController {
    /**
     * GET /api/matches/suggestions
     * Get ranked match suggestions based on compatibility
     * Query params: limit (default: 10)
     */
    async getMatchSuggestions(req, res) {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 10;

            const suggestions = await matchingService.getMatchSuggestions(userId, limit);

            // Format response with privacy controls
            const formattedSuggestions = suggestions.map(item => {
                const profile = item.profile;

                // Use blurred photos for non-matched users
                if (profile.blurred_photo_urls) {
                    profile.photo_urls = profile.blurred_photo_urls;
                    delete profile.blurred_photo_urls;
                }

                // Remove sensitive information
                delete profile.guardian_phone;
                delete profile.guardian_name;
                delete profile.guardian_relationship;

                return {
                    userId: profile.user_id,
                    profile: {
                        firstName: profile.first_name,
                        lastName: profile.last_name,
                        age: profile.age_at_profile,
                        gender: profile.gender,
                        bio: profile.bio,
                        religion: profile.religion,
                        denomination: profile.denomination,
                        tribe: profile.tribe,
                        city: profile.city,
                        state: profile.state,
                        education: profile.education,
                        occupation: profile.occupation,
                        height: profile.height,
                        complexion: profile.complexion,
                        maritalStatus: profile.marital_status,
                        hasChildren: profile.has_children,
                        wantChildren: profile.want_children,
                        photoUrls: profile.photo_urls,
                        phoneVerified: profile.phone_verified
                    },
                    compatibility: {
                        score: item.compatibilityScore,
                        breakdown: item.scoreBreakdown
                    }
                };
            });

            res.json({
                success: true,
                data: formattedSuggestions,
                count: formattedSuggestions.length
            });

        } catch (error) {
            console.error('Error getting match suggestions:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get match suggestions',
                details: error.message
            });
        }
    }

    /**
     * POST /api/matches/like/:userId
     * Like a user's profile
     */
    async likeUser(req, res) {
        try {
            const userId = req.user.id;
            const { userId: targetUserId } = req.params;

            // Validate target user
            if (userId === targetUserId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot like your own profile'
                });
            }

            // Check if target user exists and is active
            const targetUserQuery = `
                SELECT u.*, p.* FROM users u
                JOIN profiles p ON u.id = p.user_id
                WHERE u.id = $1
                    AND u.status = 'active'
                    AND p.moderation_status = 'approved'
                    AND p.is_active = true
            `;
            const targetUserResult = await pool.query(targetUserQuery, [targetUserId]);

            if (targetUserResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'User not found or not available'
                });
            }

            // Get current user's profile for compatibility score
            const myProfileResult = await pool.query('SELECT * FROM profiles WHERE user_id = $1', [userId]);
            if (myProfileResult.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Please create your profile first'
                });
            }

            // Calculate compatibility score
            const myProfile = myProfileResult.rows[0];
            const targetProfile = targetUserResult.rows[0];
            const compatibility = matchingService.calculateCompatibilityScore(myProfile, targetProfile);

            // Check if match record exists
            const existingMatchQuery = `
                SELECT * FROM matches
                WHERE (user_id_1 = $1 AND user_id_2 = $2)
                   OR (user_id_1 = $2 AND user_id_2 = $1)
            `;
            const existingMatchResult = await pool.query(existingMatchQuery, [userId, targetUserId]);

            let match;
            let isMutualMatch = false;

            if (existingMatchResult.rows.length === 0) {
                // Create new match record
                const insertQuery = `
                    INSERT INTO matches (
                        user_id_1,
                        user_id_2,
                        user_1_action,
                        compatibility_score,
                        score_breakdown
                    ) VALUES ($1, $2, $3, $4, $5)
                    RETURNING *
                `;
                const result = await pool.query(insertQuery, [
                    userId,
                    targetUserId,
                    'liked',
                    compatibility.score,
                    JSON.stringify(compatibility.breakdown)
                ]);
                match = result.rows[0];

            } else {
                // Update existing match record
                match = existingMatchResult.rows[0];

                // Determine which user is which
                const isUser1 = match.user_id_1 === userId;
                const actionField = isUser1 ? 'user_1_action' : 'user_2_action';
                const otherActionField = isUser1 ? 'user_2_action' : 'user_1_action';

                // Check if this creates a mutual match
                const otherAction = match[otherActionField];
                if (otherAction === 'liked') {
                    isMutualMatch = true;
                }

                // Update the match
                const updateQuery = `
                    UPDATE matches
                    SET ${actionField} = 'liked',
                        is_mutual_match = $1,
                        matched_at = CASE WHEN $1 = true THEN CURRENT_TIMESTAMP ELSE matched_at END,
                        compatibility_score = $2,
                        score_breakdown = $3,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $4
                    RETURNING *
                `;
                const result = await pool.query(updateQuery, [
                    isMutualMatch,
                    compatibility.score,
                    JSON.stringify(compatibility.breakdown),
                    match.id
                ]);
                match = result.rows[0];
            }

            // TODO: Create notification for the other user (Phase 8)
            // TODO: If mutual match, create notifications for both users (Phase 8)

            res.json({
                success: true,
                message: isMutualMatch ? 'It\'s a match! 🎉' : 'Like sent successfully',
                data: {
                    matchId: match.id,
                    isMutualMatch,
                    compatibilityScore: compatibility.score,
                    scoreBreakdown: compatibility.breakdown
                }
            });

        } catch (error) {
            console.error('Error liking user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to like user',
                details: error.message
            });
        }
    }

    /**
     * POST /api/matches/pass/:userId
     * Pass on a user's profile
     */
    async passUser(req, res) {
        try {
            const userId = req.user.id;
            const { userId: targetUserId } = req.params;

            if (userId === targetUserId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot pass on your own profile'
                });
            }

            // Check if match record exists
            const existingMatchQuery = `
                SELECT * FROM matches
                WHERE (user_id_1 = $1 AND user_id_2 = $2)
                   OR (user_id_1 = $2 AND user_id_2 = $1)
            `;
            const existingMatchResult = await pool.query(existingMatchQuery, [userId, targetUserId]);

            let match;

            if (existingMatchResult.rows.length === 0) {
                // Create new match record with pass
                const insertQuery = `
                    INSERT INTO matches (
                        user_id_1,
                        user_id_2,
                        user_1_action
                    ) VALUES ($1, $2, $3)
                    RETURNING *
                `;
                const result = await pool.query(insertQuery, [userId, targetUserId, 'passed']);
                match = result.rows[0];

            } else {
                // Update existing match record
                match = existingMatchResult.rows[0];
                const isUser1 = match.user_id_1 === userId;
                const actionField = isUser1 ? 'user_1_action' : 'user_2_action';

                const updateQuery = `
                    UPDATE matches
                    SET ${actionField} = 'passed',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                    RETURNING *
                `;
                const result = await pool.query(updateQuery, [match.id]);
                match = result.rows[0];
            }

            res.json({
                success: true,
                message: 'Passed on user'
            });

        } catch (error) {
            console.error('Error passing user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to pass on user'
            });
        }
    }

    /**
     * GET /api/matches/mutual
     * Get all mutual matches for the current user
     */
    async getMutualMatches(req, res) {
        try {
            const userId = req.user.id;

            const query = `
                SELECT
                    m.*,
                    CASE
                        WHEN m.user_id_1 = $1 THEN m.user_id_2
                        ELSE m.user_id_1
                    END as matched_user_id,
                    p.first_name,
                    p.last_name,
                    p.age_at_profile as age,
                    p.gender,
                    p.bio,
                    p.religion,
                    p.city,
                    p.photo_urls,
                    p.occupation,
                    u.phone_verified,
                    u.last_login_at
                FROM matches m
                JOIN users u ON (
                    CASE
                        WHEN m.user_id_1 = $1 THEN m.user_id_2
                        ELSE m.user_id_1
                    END = u.id
                )
                JOIN profiles p ON u.id = p.user_id
                WHERE (m.user_id_1 = $1 OR m.user_id_2 = $1)
                    AND m.is_mutual_match = true
                    AND m.status = 'active'
                    AND u.status = 'active'
                ORDER BY m.matched_at DESC
            `;

            const result = await pool.query(query, [userId]);

            const matches = result.rows.map(row => ({
                matchId: row.id,
                matchedAt: row.matched_at,
                compatibilityScore: row.compatibility_score,
                user: {
                    userId: row.matched_user_id,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    age: row.age,
                    gender: row.gender,
                    bio: row.bio,
                    religion: row.religion,
                    city: row.city,
                    occupation: row.occupation,
                    photoUrls: row.photo_urls, // Clear photos for matches
                    phoneVerified: row.phone_verified,
                    lastLoginAt: row.last_login_at
                }
            }));

            res.json({
                success: true,
                data: matches,
                count: matches.length
            });

        } catch (error) {
            console.error('Error getting mutual matches:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get mutual matches'
            });
        }
    }

    /**
     * DELETE /api/matches/unmatch/:userId
     * Unmatch with a user
     */
    async unmatchUser(req, res) {
        try {
            const userId = req.user.id;
            const { userId: targetUserId } = req.params;

            // Find the match
            const matchQuery = `
                SELECT * FROM matches
                WHERE (user_id_1 = $1 AND user_id_2 = $2)
                   OR (user_id_1 = $2 AND user_id_2 = $1)
                AND is_mutual_match = true
            `;
            const matchResult = await pool.query(matchQuery, [userId, targetUserId]);

            if (matchResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Match not found'
                });
            }

            const match = matchResult.rows[0];

            // Update match status to unmatched
            const updateQuery = `
                UPDATE matches
                SET status = 'unmatched',
                    is_mutual_match = false,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
            `;
            await pool.query(updateQuery, [match.id]);

            // TODO: Send notification to other user (Phase 8)

            res.json({
                success: true,
                message: 'Successfully unmatched'
            });

        } catch (error) {
            console.error('Error unmatching user:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to unmatch user'
            });
        }
    }

    /**
     * GET /api/matches/history
     * Get match history (all likes and passes)
     */
    async getMatchHistory(req, res) {
        try {
            const userId = req.user.id;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const offset = (page - 1) * limit;

            const query = `
                SELECT
                    m.*,
                    CASE
                        WHEN m.user_id_1 = $1 THEN m.user_id_2
                        ELSE m.user_id_1
                    END as other_user_id,
                    CASE
                        WHEN m.user_id_1 = $1 THEN m.user_1_action
                        ELSE m.user_2_action
                    END as my_action,
                    CASE
                        WHEN m.user_id_1 = $1 THEN m.user_2_action
                        ELSE m.user_1_action
                    END as their_action,
                    p.first_name,
                    p.last_name,
                    p.photo_urls
                FROM matches m
                LEFT JOIN profiles p ON (
                    CASE
                        WHEN m.user_id_1 = $1 THEN m.user_id_2
                        ELSE m.user_id_1
                    END = p.user_id
                )
                WHERE (m.user_id_1 = $1 OR m.user_id_2 = $1)
                ORDER BY m.created_at DESC
                LIMIT $2 OFFSET $3
            `;

            const result = await pool.query(query, [userId, limit, offset]);

            const history = result.rows.map(row => ({
                matchId: row.id,
                userId: row.other_user_id,
                myAction: row.my_action,
                theirAction: row.their_action,
                isMutualMatch: row.is_mutual_match,
                compatibilityScore: row.compatibility_score,
                createdAt: row.created_at,
                user: row.first_name ? {
                    firstName: row.first_name,
                    lastName: row.last_name,
                    photoUrls: row.photo_urls
                } : null
            }));

            res.json({
                success: true,
                data: history,
                pagination: {
                    page,
                    limit,
                    count: history.length
                }
            });

        } catch (error) {
            console.error('Error getting match history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get match history'
            });
        }
    }

    /**
     * GET /api/matches/stats
     * Get match statistics for current user
     */
    async getMatchStats(req, res) {
        try {
            const userId = req.user.id;

            const query = `
                SELECT
                    COUNT(*) FILTER (WHERE is_mutual_match = true) as mutual_matches,
                    COUNT(*) FILTER (
                        WHERE (user_id_1 = $1 AND user_1_action = 'liked')
                           OR (user_id_2 = $1 AND user_2_action = 'liked')
                    ) as total_likes_sent,
                    COUNT(*) FILTER (
                        WHERE (user_id_1 = $1 AND user_2_action = 'liked')
                           OR (user_id_2 = $1 AND user_1_action = 'liked')
                    ) as total_likes_received,
                    COUNT(*) FILTER (
                        WHERE (user_id_1 = $1 AND user_1_action = 'passed')
                           OR (user_id_2 = $1 AND user_2_action = 'passed')
                    ) as total_passes
                FROM matches
                WHERE user_id_1 = $1 OR user_id_2 = $1
            `;

            const result = await pool.query(query, [userId]);
            const stats = result.rows[0];

            res.json({
                success: true,
                data: {
                    mutualMatches: parseInt(stats.mutual_matches),
                    totalLikesSent: parseInt(stats.total_likes_sent),
                    totalLikesReceived: parseInt(stats.total_likes_received),
                    totalPasses: parseInt(stats.total_passes),
                    matchRate: stats.total_likes_sent > 0
                        ? Math.round((stats.mutual_matches / stats.total_likes_sent) * 100)
                        : 0
                }
            });

        } catch (error) {
            console.error('Error getting match stats:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get match statistics'
            });
        }
    }
}

module.exports = new MatchController();
