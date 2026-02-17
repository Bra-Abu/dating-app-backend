// Matching Service - Compatibility scoring and match suggestions
const pool = require('../config/database');

class MatchingService {
    /**
     * Calculate compatibility score between two users
     * Returns score from 0-100 with detailed breakdown
     *
     * Weighting:
     * - Religion: 20%
     * - Age: 15%
     * - Location: 15%
     * - Family values: 15%
     * - Education: 10%
     * - Lifestyle: 10%
     * - Tribe: 10%
     * - Physical preferences: 5%
     */
    calculateCompatibilityScore(profile1, profile2) {
        const breakdown = {};
        let totalScore = 0;

        // 1. RELIGION COMPATIBILITY (20 points max)
        let religionScore = 0;
        if (profile1.religion && profile2.religion) {
            if (profile1.religion === profile2.religion) {
                religionScore = 20;
                // Bonus for same denomination
                if (profile1.denomination && profile2.denomination &&
                    profile1.denomination === profile2.denomination) {
                    religionScore = 20;
                } else if (profile1.denomination && profile2.denomination) {
                    religionScore = 15; // Same religion, different denomination
                } else {
                    religionScore = 18; // Same religion, denomination not specified
                }
            } else {
                religionScore = 0; // Different religion is a dealbreaker for many
            }
        }
        breakdown.religion = religionScore;
        totalScore += religionScore;

        // 2. AGE COMPATIBILITY (15 points max)
        let ageScore = 0;
        const age1 = profile1.age_at_profile || this.calculateAge(profile1.date_of_birth);
        const age2 = profile2.age_at_profile || this.calculateAge(profile2.date_of_birth);

        if (age1 && age2) {
            const ageDiff = Math.abs(age1 - age2);

            // Check against preferences
            const prefs1 = profile1.preferences || {};
            const prefs2 = profile2.preferences || {};

            let matchesPrefs = true;
            if (prefs1.age_min && age2 < prefs1.age_min) matchesPrefs = false;
            if (prefs1.age_max && age2 > prefs1.age_max) matchesPrefs = false;
            if (prefs2.age_min && age1 < prefs2.age_min) matchesPrefs = false;
            if (prefs2.age_max && age1 > prefs2.age_max) matchesPrefs = false;

            if (!matchesPrefs) {
                ageScore = 0;
            } else if (ageDiff <= 2) {
                ageScore = 15;
            } else if (ageDiff <= 5) {
                ageScore = 12;
            } else if (ageDiff <= 10) {
                ageScore = 8;
            } else {
                ageScore = 4;
            }
        }
        breakdown.age = ageScore;
        totalScore += ageScore;

        // 3. LOCATION COMPATIBILITY (15 points max)
        let locationScore = 0;
        if (profile1.city && profile2.city) {
            if (profile1.city.toLowerCase() === profile2.city.toLowerCase()) {
                locationScore = 15; // Same city
            } else if (profile1.state && profile2.state &&
                       profile1.state.toLowerCase() === profile2.state.toLowerCase()) {
                locationScore = 10; // Same state
            } else if (profile1.country && profile2.country &&
                       profile1.country.toLowerCase() === profile2.country.toLowerCase()) {
                locationScore = 5; // Same country
            }

            // If coordinates available, calculate distance
            if (profile1.latitude && profile1.longitude &&
                profile2.latitude && profile2.longitude) {
                const distance = this.calculateDistance(
                    profile1.latitude, profile1.longitude,
                    profile2.latitude, profile2.longitude
                );

                const prefs1 = profile1.preferences || {};
                const maxDistance = prefs1.max_distance_km || 100;

                if (distance <= 10) locationScore = 15;
                else if (distance <= 25) locationScore = 12;
                else if (distance <= 50) locationScore = 10;
                else if (distance <= maxDistance) locationScore = 7;
                else locationScore = 3;
            }
        }
        breakdown.location = locationScore;
        totalScore += locationScore;

        // 4. FAMILY VALUES COMPATIBILITY (15 points max)
        let familyScore = 0;

        // Children compatibility
        let childrenScore = 0;
        if (profile1.want_children && profile2.want_children) {
            const wantsMap = {
                'Definitely Yes': 5,
                'Probably Yes': 4,
                'Undecided': 3,
                'Probably No': 2,
                'Definitely No': 1
            };
            const score1 = wantsMap[profile1.want_children] || 3;
            const score2 = wantsMap[profile2.want_children] || 3;
            const diff = Math.abs(score1 - score2);

            if (diff === 0) childrenScore = 8;
            else if (diff === 1) childrenScore = 6;
            else if (diff === 2) childrenScore = 3;
            else childrenScore = 0;
        }

        // Marital status compatibility
        let maritalScore = 0;
        if (profile1.marital_status && profile2.marital_status) {
            const prefs1 = profile1.preferences || {};
            const prefs2 = profile2.preferences || {};

            const acceptable1 = prefs1.acceptable_marital_status || [];
            const acceptable2 = prefs2.acceptable_marital_status || [];

            if (acceptable1.length === 0 || acceptable1.includes(profile2.marital_status)) {
                maritalScore += 3.5;
            }
            if (acceptable2.length === 0 || acceptable2.includes(profile1.marital_status)) {
                maritalScore += 3.5;
            }
        }

        familyScore = childrenScore + maritalScore;
        breakdown.family = familyScore;
        totalScore += familyScore;

        // 5. EDUCATION COMPATIBILITY (10 points max)
        let educationScore = 0;
        if (profile1.education && profile2.education) {
            const educationLevels = {
                'Doctorate': 7,
                'Master Degree': 6,
                'Professional Degree': 6,
                'Bachelor Degree': 5,
                'Associate Degree': 4,
                'Trade School': 3,
                'High School': 2,
                'Other': 1
            };

            const level1 = educationLevels[profile1.education] || 3;
            const level2 = educationLevels[profile2.education] || 3;
            const diff = Math.abs(level1 - level2);

            // Check preferences
            const prefs1 = profile1.preferences || {};
            const prefs2 = profile2.preferences || {};
            const acceptableEd1 = prefs1.education_levels || [];
            const acceptableEd2 = prefs2.education_levels || [];

            if ((acceptableEd1.length > 0 && !acceptableEd1.includes(profile2.education)) ||
                (acceptableEd2.length > 0 && !acceptableEd2.includes(profile1.education))) {
                educationScore = 0;
            } else if (diff === 0) {
                educationScore = 10;
            } else if (diff === 1) {
                educationScore = 8;
            } else if (diff === 2) {
                educationScore = 6;
            } else {
                educationScore = 4;
            }
        }
        breakdown.education = educationScore;
        totalScore += educationScore;

        // 6. LIFESTYLE COMPATIBILITY (10 points max)
        let lifestyleScore = 0;

        // Smoking compatibility
        if (profile1.smoking && profile2.smoking) {
            if (profile1.smoking === 'Never' && profile2.smoking === 'Never') {
                lifestyleScore += 3;
            } else if (profile1.smoking === profile2.smoking) {
                lifestyleScore += 2;
            } else if ((profile1.smoking === 'Never' || profile2.smoking === 'Never')) {
                lifestyleScore += 0; // Non-smoker with smoker = low score
            } else {
                lifestyleScore += 1;
            }
        }

        // Drinking compatibility
        if (profile1.drinking && profile2.drinking) {
            if (profile1.drinking === 'Never' && profile2.drinking === 'Never') {
                lifestyleScore += 3;
            } else if (profile1.drinking === profile2.drinking) {
                lifestyleScore += 2;
            } else if ((profile1.drinking === 'Never' || profile2.drinking === 'Never')) {
                lifestyleScore += 0;
            } else {
                lifestyleScore += 1;
            }
        }

        // Diet compatibility
        if (profile1.diet && profile2.diet) {
            if (profile1.diet === profile2.diet) {
                lifestyleScore += 2;
            } else if ((profile1.diet === 'Halal' && profile2.diet === 'No Restrictions') ||
                       (profile2.diet === 'Halal' && profile1.diet === 'No Restrictions')) {
                lifestyleScore += 1.5;
            } else {
                lifestyleScore += 0.5;
            }
        }

        // Exercise compatibility
        if (profile1.exercise && profile2.exercise) {
            lifestyleScore += 2;
        }

        breakdown.lifestyle = lifestyleScore;
        totalScore += lifestyleScore;

        // 7. TRIBE/ETHNICITY COMPATIBILITY (10 points max)
        let tribeScore = 0;
        if (profile1.tribe && profile2.tribe) {
            const prefs1 = profile1.preferences || {};
            const prefs2 = profile2.preferences || {};
            const acceptableTribes1 = prefs1.tribes || [];
            const acceptableTribes2 = prefs2.tribes || [];

            // Same tribe gets highest score
            if (profile1.tribe.toLowerCase() === profile2.tribe.toLowerCase()) {
                tribeScore = 10;
            }
            // Check preferences
            else if (acceptableTribes1.length > 0 || acceptableTribes2.length > 0) {
                let matches = true;
                if (acceptableTribes1.length > 0 && !acceptableTribes1.includes(profile2.tribe)) {
                    matches = false;
                }
                if (acceptableTribes2.length > 0 && !acceptableTribes2.includes(profile1.tribe)) {
                    matches = false;
                }
                tribeScore = matches ? 7 : 0;
            } else {
                tribeScore = 5; // Different tribe, no preference specified
            }
        }
        breakdown.tribe = tribeScore;
        totalScore += tribeScore;

        // 8. PHYSICAL PREFERENCES (5 points max)
        let physicalScore = 0;

        // Height compatibility
        if (profile1.height && profile2.height) {
            const prefs1 = profile1.preferences || {};
            const prefs2 = profile2.preferences || {};

            let heightMatch = true;
            if (prefs1.height_min && profile2.height < prefs1.height_min) heightMatch = false;
            if (prefs1.height_max && profile2.height > prefs1.height_max) heightMatch = false;
            if (prefs2.height_min && profile1.height < prefs2.height_min) heightMatch = false;
            if (prefs2.height_max && profile1.height > prefs2.height_max) heightMatch = false;

            if (heightMatch) {
                physicalScore = 5;
            }
        } else {
            physicalScore = 2.5; // No height info, give neutral score
        }

        breakdown.physical = physicalScore;
        totalScore += physicalScore;

        // Round to 2 decimal places
        totalScore = Math.round(totalScore * 100) / 100;

        return {
            score: totalScore,
            breakdown,
            maxPossibleScore: 100
        };
    }

    /**
     * Get match suggestions for a user
     * Returns profiles ranked by compatibility score
     */
    async getMatchSuggestions(userId, limit = 20) {
        try {
            // Get user's profile
            const myProfileQuery = 'SELECT * FROM profiles WHERE user_id = $1';
            const myProfileResult = await pool.query(myProfileQuery, [userId]);

            if (myProfileResult.rows.length === 0) {
                throw new Error('User profile not found');
            }

            const myProfile = myProfileResult.rows[0];

            // Get potential matches (exclude already interacted with, blocked users)
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
                        -- Exclude already interacted with
                        SELECT CASE
                            WHEN user_id_1 = $1 THEN user_id_2
                            WHEN user_id_2 = $1 THEN user_id_1
                        END
                        FROM matches
                        WHERE user_id_1 = $1 OR user_id_2 = $1
                    )
                    AND p.user_id NOT IN (
                        -- Exclude blocked users
                        SELECT blocked_id FROM blocks WHERE blocker_id = $1
                        UNION
                        SELECT blocker_id FROM blocks WHERE blocked_id = $1
                    )
                LIMIT 100  -- Get a pool to score
            `;

            const result = await pool.query(query, [userId, myProfile.gender]);

            // Calculate compatibility score for each profile
            const scoredProfiles = result.rows.map(profile => {
                const compatibility = this.calculateCompatibilityScore(myProfile, profile);
                return {
                    profile,
                    compatibilityScore: compatibility.score,
                    scoreBreakdown: compatibility.breakdown
                };
            });

            // Sort by compatibility score (highest first)
            scoredProfiles.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

            // Return top matches
            return scoredProfiles.slice(0, limit);

        } catch (error) {
            console.error('Error getting match suggestions:', error);
            throw error;
        }
    }

    /**
     * Calculate age from date of birth
     */
    calculateAge(dateOfBirth) {
        if (!dateOfBirth) return null;
        const dob = new Date(dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - dob.getFullYear();
        const monthDiff = today.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
            age--;
        }
        return age;
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     * Returns distance in kilometers
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Convert degrees to radians
     */
    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Check if two users meet each other's basic preferences
     * (Used before detailed compatibility scoring)
     */
    meetsBasicPreferences(profile1, profile2) {
        const prefs1 = profile1.preferences || {};
        const prefs2 = profile2.preferences || {};

        // Age preferences
        const age1 = this.calculateAge(profile1.date_of_birth);
        const age2 = this.calculateAge(profile2.date_of_birth);

        if (prefs1.age_min && age2 < prefs1.age_min) return false;
        if (prefs1.age_max && age2 > prefs1.age_max) return false;
        if (prefs2.age_min && age1 < prefs2.age_min) return false;
        if (prefs2.age_max && age1 > prefs2.age_max) return false;

        // Religion preferences
        if (prefs1.religions && prefs1.religions.length > 0) {
            if (!prefs1.religions.includes(profile2.religion)) return false;
        }
        if (prefs2.religions && prefs2.religions.length > 0) {
            if (!prefs2.religions.includes(profile1.religion)) return false;
        }

        // Education preferences
        if (prefs1.education_levels && prefs1.education_levels.length > 0) {
            if (!prefs1.education_levels.includes(profile2.education)) return false;
        }
        if (prefs2.education_levels && prefs2.education_levels.length > 0) {
            if (!prefs2.education_levels.includes(profile1.education)) return false;
        }

        return true;
    }
}

module.exports = new MatchingService();
