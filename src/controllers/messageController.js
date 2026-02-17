// Message Controller - Handles messaging between matched users
const pool = require('../config/database');

class MessageController {
    /**
     * POST /api/messages/send
     * Send a message to a matched user
     * Body: { receiverId: string, message: string }
     */
    async sendMessage(req, res) {
        try {
            const senderId = req.user.id;
            const { receiverId, message } = req.body;

            // Validate input
            if (!receiverId || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'Receiver ID and message are required'
                });
            }

            if (!message.trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Message cannot be empty'
                });
            }

            if (message.length > 5000) {
                return res.status(400).json({
                    success: false,
                    error: 'Message is too long (max 5000 characters)'
                });
            }

            if (senderId === receiverId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cannot send message to yourself'
                });
            }

            // Check if users are mutually matched
            const matchQuery = `
                SELECT * FROM matches
                WHERE ((user_id_1 = $1 AND user_id_2 = $2) OR (user_id_1 = $2 AND user_id_2 = $1))
                    AND is_mutual_match = true
                    AND status = 'active'
            `;
            const matchResult = await pool.query(matchQuery, [senderId, receiverId]);

            if (matchResult.rows.length === 0) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only message users you are matched with'
                });
            }

            const match = matchResult.rows[0];
            const matchId = match.id;

            // Check if receiver has blocked sender
            const blockQuery = `
                SELECT * FROM blocks
                WHERE blocker_id = $1 AND blocked_id = $2
            `;
            const blockResult = await pool.query(blockQuery, [receiverId, senderId]);

            if (blockResult.rows.length > 0) {
                return res.status(403).json({
                    success: false,
                    error: 'Unable to send message'
                });
            }

            // Check if this is the first message to a Muslim woman with guardian
            let guardianAlertNeeded = false;
            const receiverProfileQuery = `
                SELECT p.*, u.gender FROM profiles p
                JOIN users u ON p.user_id = u.id
                WHERE p.user_id = $1
            `;
            const receiverProfileResult = await pool.query(receiverProfileQuery, [receiverId]);

            if (receiverProfileResult.rows.length > 0) {
                const receiverProfile = receiverProfileResult.rows[0];

                // Check if receiver is Muslim woman with guardian
                if (receiverProfile.gender === 'female' &&
                    receiverProfile.religion === 'Islam' &&
                    receiverProfile.has_guardian === true) {

                    // Check if any messages have been sent before
                    const previousMessageQuery = `
                        SELECT COUNT(*) as count FROM messages
                        WHERE match_id = $1 AND guardian_notified = false
                    `;
                    const previousMessageResult = await pool.query(previousMessageQuery, [matchId]);

                    if (parseInt(previousMessageResult.rows[0].count) === 0) {
                        guardianAlertNeeded = true;
                    }
                }
            }

            const client = await pool.connect();

            try {
                await client.query('BEGIN');

                // Insert the message
                const insertQuery = `
                    INSERT INTO messages (
                        match_id,
                        sender_id,
                        receiver_id,
                        message_text,
                        message_type,
                        guardian_notified
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING *
                `;
                const result = await client.query(insertQuery, [
                    matchId,
                    senderId,
                    receiverId,
                    message.trim(),
                    'text',
                    false
                ]);

                const newMessage = result.rows[0];

                // If guardian alert needed, send system message
                if (guardianAlertNeeded) {
                    const guardianAlertQuery = `
                        INSERT INTO messages (
                            match_id,
                            sender_id,
                            receiver_id,
                            message_text,
                            message_type,
                            guardian_notified
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    `;
                    await client.query(guardianAlertQuery, [
                        matchId,
                        receiverId, // System message to receiver
                        receiverId,
                        'As per Islamic tradition, it is recommended that this conversation involves your guardian. Your guardian has been notified.',
                        'guardian_alert',
                        true
                    ]);

                    // TODO: Send SMS to guardian (Phase 5 - optional with Twilio)
                    // if (receiverProfile.guardian_phone) {
                    //     await sendGuardianSMS(receiverProfile.guardian_phone, receiverProfile.guardian_name);
                    // }
                }

                // Update match last activity
                await client.query(
                    'UPDATE matches SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
                    [matchId]
                );

                // Update sender's last active
                await client.query(
                    'UPDATE profiles SET last_active_at = CURRENT_TIMESTAMP WHERE user_id = $1',
                    [senderId]
                );

                await client.query('COMMIT');

                // TODO: Create notification for receiver (Phase 8)

                res.status(201).json({
                    success: true,
                    message: 'Message sent successfully',
                    data: {
                        messageId: newMessage.id,
                        matchId: matchId,
                        senderId: senderId,
                        receiverId: receiverId,
                        messageText: newMessage.message_text,
                        createdAt: newMessage.created_at,
                        guardianAlertSent: guardianAlertNeeded
                    }
                });

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to send message',
                details: error.message
            });
        }
    }

    /**
     * GET /api/messages/conversations
     * Get all conversations for current user
     */
    async getConversations(req, res) {
        try {
            const userId = req.user.id;

            const query = `
                SELECT DISTINCT ON (m.id)
                    m.id as match_id,
                    m.matched_at,
                    CASE
                        WHEN m.user_id_1 = $1 THEN m.user_id_2
                        ELSE m.user_id_1
                    END as other_user_id,
                    p.first_name,
                    p.last_name,
                    p.photo_urls,
                    p.age_at_profile as age,
                    u.last_login_at,
                    (
                        SELECT message_text
                        FROM messages
                        WHERE match_id = m.id
                        ORDER BY created_at DESC
                        LIMIT 1
                    ) as last_message,
                    (
                        SELECT created_at
                        FROM messages
                        WHERE match_id = m.id
                        ORDER BY created_at DESC
                        LIMIT 1
                    ) as last_message_at,
                    (
                        SELECT COUNT(*)
                        FROM messages
                        WHERE match_id = m.id
                            AND receiver_id = $1
                            AND is_read = false
                    ) as unread_count
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
                    AND EXISTS (
                        SELECT 1 FROM messages
                        WHERE match_id = m.id
                    )
                ORDER BY m.id, last_message_at DESC NULLS LAST
            `;

            const result = await pool.query(query, [userId]);

            const conversations = result.rows.map(row => ({
                matchId: row.match_id,
                matchedAt: row.matched_at,
                user: {
                    userId: row.other_user_id,
                    firstName: row.first_name,
                    lastName: row.last_name,
                    age: row.age,
                    photoUrls: row.photo_urls,
                    lastLoginAt: row.last_login_at
                },
                lastMessage: row.last_message,
                lastMessageAt: row.last_message_at,
                unreadCount: parseInt(row.unread_count)
            }));

            res.json({
                success: true,
                data: conversations,
                count: conversations.length
            });

        } catch (error) {
            console.error('Error getting conversations:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get conversations'
            });
        }
    }

    /**
     * GET /api/messages/conversation/:matchId
     * Get message history for a specific conversation
     * Query params: page, limit, before (timestamp)
     */
    async getConversation(req, res) {
        try {
            const userId = req.user.id;
            const { matchId } = req.params;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const offset = (page - 1) * limit;
            const before = req.query.before; // Optional: get messages before this timestamp

            // Verify user is part of this match
            const matchQuery = `
                SELECT * FROM matches
                WHERE id = $1
                    AND (user_id_1 = $2 OR user_id_2 = $2)
                    AND is_mutual_match = true
            `;
            const matchResult = await pool.query(matchQuery, [matchId, userId]);

            if (matchResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Conversation not found'
                });
            }

            // Build query with optional before filter
            let messagesQuery = `
                SELECT
                    msg.id,
                    msg.sender_id,
                    msg.receiver_id,
                    msg.message_text,
                    msg.message_type,
                    msg.is_read,
                    msg.read_at,
                    msg.created_at,
                    sender.first_name as sender_first_name,
                    sender.last_name as sender_last_name
                FROM messages msg
                LEFT JOIN profiles sender ON msg.sender_id = sender.user_id
                WHERE msg.match_id = $1
            `;

            const queryParams = [matchId];
            let paramCount = 2;

            if (before) {
                messagesQuery += ` AND msg.created_at < $${paramCount}`;
                queryParams.push(before);
                paramCount++;
            }

            messagesQuery += ` ORDER BY msg.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
            queryParams.push(limit, offset);

            const result = await pool.query(messagesQuery, queryParams);

            // Mark unread messages as read
            await pool.query(
                `UPDATE messages
                 SET is_read = true, read_at = CURRENT_TIMESTAMP
                 WHERE match_id = $1 AND receiver_id = $2 AND is_read = false`,
                [matchId, userId]
            );

            const messages = result.rows.reverse().map(row => ({
                id: row.id,
                senderId: row.sender_id,
                receiverId: row.receiver_id,
                messageText: row.message_text,
                messageType: row.message_type,
                isRead: row.is_read,
                readAt: row.read_at,
                createdAt: row.created_at,
                isMine: row.sender_id === userId,
                senderName: `${row.sender_first_name} ${row.sender_last_name}`
            }));

            res.json({
                success: true,
                data: messages,
                pagination: {
                    page,
                    limit,
                    count: messages.length,
                    hasMore: messages.length === limit
                }
            });

        } catch (error) {
            console.error('Error getting conversation:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get conversation'
            });
        }
    }

    /**
     * PATCH /api/messages/:messageId/read
     * Mark a message as read
     */
    async markAsRead(req, res) {
        try {
            const userId = req.user.id;
            const { messageId } = req.params;

            const query = `
                UPDATE messages
                SET is_read = true,
                    read_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND receiver_id = $2
                RETURNING *
            `;

            const result = await pool.query(query, [messageId, userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Message not found or you are not the receiver'
                });
            }

            res.json({
                success: true,
                message: 'Message marked as read'
            });

        } catch (error) {
            console.error('Error marking message as read:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to mark message as read'
            });
        }
    }

    /**
     * GET /api/messages/new
     * Polling endpoint to get new messages since a timestamp
     * Query params: since (timestamp)
     */
    async getNewMessages(req, res) {
        try {
            const userId = req.user.id;
            const { since } = req.query;

            if (!since) {
                return res.status(400).json({
                    success: false,
                    error: 'Timestamp parameter "since" is required'
                });
            }

            const query = `
                SELECT
                    msg.id,
                    msg.match_id,
                    msg.sender_id,
                    msg.receiver_id,
                    msg.message_text,
                    msg.message_type,
                    msg.created_at,
                    sender.first_name as sender_first_name,
                    sender.last_name as sender_last_name,
                    sender.photo_urls as sender_photo
                FROM messages msg
                JOIN profiles sender ON msg.sender_id = sender.user_id
                WHERE msg.receiver_id = $1
                    AND msg.created_at > $2
                    AND msg.is_read = false
                ORDER BY msg.created_at ASC
            `;

            const result = await pool.query(query, [userId, since]);

            const newMessages = result.rows.map(row => ({
                id: row.id,
                matchId: row.match_id,
                senderId: row.sender_id,
                messageText: row.message_text,
                messageType: row.message_type,
                createdAt: row.created_at,
                sender: {
                    firstName: row.sender_first_name,
                    lastName: row.sender_last_name,
                    photoUrls: row.sender_photo
                }
            }));

            res.json({
                success: true,
                data: newMessages,
                count: newMessages.length
            });

        } catch (error) {
            console.error('Error getting new messages:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get new messages'
            });
        }
    }

    /**
     * DELETE /api/messages/:messageId
     * Delete a message (soft delete)
     */
    async deleteMessage(req, res) {
        try {
            const userId = req.user.id;
            const { messageId } = req.params;

            // Only sender can delete their own messages
            const query = `
                UPDATE messages
                SET is_deleted = true,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1 AND sender_id = $2
                RETURNING *
            `;

            const result = await pool.query(query, [messageId, userId]);

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Message not found or you are not the sender'
                });
            }

            res.json({
                success: true,
                message: 'Message deleted successfully'
            });

        } catch (error) {
            console.error('Error deleting message:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete message'
            });
        }
    }
}

module.exports = new MessageController();
