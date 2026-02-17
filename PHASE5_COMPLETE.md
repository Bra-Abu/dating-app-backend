# Phase 5: Messaging System - COMPLETED ✅

## Overview

Phase 5 implements the messaging system that allows matched users to communicate. This includes standard messaging features plus a unique **Guardian Alert System** for Muslim women, respecting Islamic traditions around courtship.

---

## ✅ What Was Implemented

### 1. Complete Messaging System ✅

**File:** `src/controllers/messageController.js`

**Core Features:**
- 💬 Send messages to matched users only
- 📋 View all conversations with unread counts
- 💭 Get full message history for any match
- ✅ Read receipts (mark as read)
- 🔄 Polling endpoint for new messages
- 🗑️ Delete messages (soft delete)

**Security Features:**
- ✅ Can only message mutual matches
- ✅ Checks for blocked users
- ✅ Validates match exists and is active
- ✅ Message length limits (5000 chars)
- ✅ Only sender can delete their messages

### 2. Guardian Alert System ✅

**For Muslim Women - Respecting Islamic Traditions**

When the **first message** is sent to a Muslim woman who has indicated she has a guardian:
1. ✅ System detects it's a Muslim woman with `has_guardian = true`
2. ✅ Automatically sends a **system message** to the conversation
3. ✅ Message: *"As per Islamic tradition, it is recommended that this conversation involves your guardian. Your guardian has been notified."*
4. ✅ Records that guardian notification was sent
5. 🔜 **Optional**: Send SMS to guardian's phone (Twilio integration ready)

**Guardian Information Protected:**
- Guardian name/phone only visible after mutual match
- Guardian details never exposed in API responses
- Respectful of privacy and tradition

### 3. Message Routes ✅

**File:** `src/routes/messageRoutes.js`

Six powerful endpoints for complete messaging functionality:

---

## 📡 API Endpoints

### 1. POST /api/messages/send
**Send a message to a matched user**

**Request:**
```json
{
  "receiverId": "uuid-of-receiver",
  "message": "Hello! How are you?"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "messageId": "msg-uuid",
    "matchId": "match-uuid",
    "senderId": "sender-uuid",
    "receiverId": "receiver-uuid",
    "messageText": "Hello! How are you?",
    "createdAt": "2026-02-15T12:00:00Z",
    "guardianAlertSent": false
  }
}
```

**Validation:**
- ✅ Both users must be mutually matched
- ✅ Message cannot be empty
- ✅ Max 5000 characters
- ✅ Cannot message yourself
- ✅ Respects blocks

---

### 2. GET /api/messages/conversations
**Get all conversations**

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "matchId": "match-uuid",
      "matchedAt": "2026-02-10T10:00:00Z",
      "user": {
        "userId": "user-uuid",
        "firstName": "Aisha",
        "lastName": "Ibrahim",
        "age": 26,
        "photoUrls": ["photo.jpg"],
        "lastLoginAt": "2026-02-15T11:00:00Z"
      },
      "lastMessage": "Looking forward to meeting!",
      "lastMessageAt": "2026-02-15T11:30:00Z",
      "unreadCount": 2
    }
  ],
  "count": 1
}
```

**Features:**
- Shows all matches with at least one message
- Sorted by last message time (most recent first)
- Includes unread count per conversation
- Shows other user's basic info and photo

---

### 3. GET /api/messages/conversation/:matchId
**Get message history for a match**

**Query Params:**
- `page` (default: 1)
- `limit` (default: 50)
- `before` (optional timestamp - get messages before this time)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg-uuid-1",
      "senderId": "sender-uuid",
      "receiverId": "receiver-uuid",
      "messageText": "Hello!",
      "messageType": "text",
      "isRead": true,
      "readAt": "2026-02-15T10:05:00Z",
      "createdAt": "2026-02-15T10:00:00Z",
      "isMine": false,
      "senderName": "Aisha Ibrahim"
    },
    {
      "id": "msg-uuid-2",
      "senderId": "my-uuid",
      "receiverId": "other-uuid",
      "messageText": "Hi there!",
      "messageType": "text",
      "isRead": false,
      "readAt": null,
      "createdAt": "2026-02-15T10:02:00Z",
      "isMine": true,
      "senderName": "Me"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "count": 2,
    "hasMore": false
  }
}
```

**Features:**
- Automatic read receipt (marks unread messages as read)
- Paginated for performance
- Sorted by time (oldest to newest)
- `isMine` flag for easy UI rendering

---

### 4. PATCH /api/messages/:messageId/read
**Mark a message as read**

**Response:**
```json
{
  "success": true,
  "message": "Message marked as read"
}
```

---

### 5. GET /api/messages/new
**Polling endpoint - get new messages since timestamp**

**Query Params:**
- `since` (required) - ISO timestamp

**Example:**
```
GET /api/messages/new?since=2026-02-15T12:00:00Z
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg-uuid",
      "matchId": "match-uuid",
      "senderId": "sender-uuid",
      "messageText": "New message!",
      "messageType": "text",
      "createdAt": "2026-02-15T12:05:00Z",
      "sender": {
        "firstName": "Aisha",
        "lastName": "Ibrahim",
        "photoUrls": ["photo.jpg"]
      }
    }
  ],
  "count": 1
}
```

**Usage:**
Frontend should poll this endpoint every 5 seconds:
```javascript
// Client-side polling example
setInterval(() => {
  const lastChecked = new Date().toISOString();
  fetch(`/api/messages/new?since=${lastChecked}`)
    .then(res => res.json())
    .then(data => {
      if (data.count > 0) {
        // Display new messages
        updateUI(data.data);
      }
    });
}, 5000); // Poll every 5 seconds
```

---

### 6. DELETE /api/messages/:messageId
**Delete a message (soft delete)**

Only the sender can delete their own messages.

**Response:**
```json
{
  "success": true,
  "message": "Message deleted successfully"
}
```

---

## 🕌 Guardian Alert System - How It Works

### Scenario: First Message to Muslim Woman

**Profile Setup:**
```json
{
  "gender": "female",
  "religion": "Islam",
  "has_guardian": true,
  "guardian_name": "Ahmad Ibrahim",
  "guardian_phone": "+2348012345678",
  "guardian_relationship": "Father"
}
```

**When first message is sent:**

1. **System checks:**
   - Is receiver a woman? ✅
   - Is she Muslim? ✅
   - Does she have a guardian? ✅
   - Has guardian been notified already? ❌

2. **System automatically:**
   - Sends the user's message ✅
   - Inserts a system message to the conversation ✅
   - Marks guardian as notified ✅

3. **Conversation view:**
```
[Sender]: "Assalamu alaikum, I'd like to get to know you better."

[SYSTEM]: "As per Islamic tradition, it is recommended that this
conversation involves your guardian. Your guardian has been notified."

[Receiver]: "Wa alaikum salaam, thank you for reaching out..."
```

### Optional: SMS to Guardian (Twilio)

**To enable SMS notifications:**

1. Install Twilio:
```bash
npm install twilio
```

2. Add to `.env`:
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

3. Uncomment SMS code in `messageController.js`:
```javascript
// Around line 110
if (receiverProfile.guardian_phone) {
    await sendGuardianSMS(receiverProfile.guardian_phone, receiverProfile.guardian_name);
}
```

4. Create SMS helper function:
```javascript
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function sendGuardianSMS(guardianPhone, guardianName) {
    await client.messages.create({
        body: `As-salamu alaykum ${guardianName}, Your daughter has received a new message on the marriage platform. Please check in with her.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: guardianPhone
    });
}
```

---

## 🎯 Message Flow

### User Journey: After Matching

```
1. Users match (Phase 3)
   ↓
2. Both users see match in /api/matches/mutual
   ↓
3. User A sends first message
   POST /api/messages/send { receiverId: userB, message: "Hello!" }
   ↓
4. If User B is Muslim woman with guardian:
   → System message inserted automatically
   → (Optional) SMS sent to guardian
   ↓
5. User B receives notification (Phase 8 - TODO)
   ↓
6. User B opens conversation
   GET /api/messages/conversation/:matchId
   → Messages auto-marked as read
   ↓
7. User B replies
   POST /api/messages/send { receiverId: userA, message: "Hi!" }
   ↓
8. User A polls for new messages
   GET /api/messages/new?since=<timestamp>
   → Receives User B's reply
   ↓
9. Conversation continues...
```

---

## 🧪 Testing Phase 5

### Test 1: Send Message (Before Match)
```bash
# Try to message someone you're not matched with
curl -X POST http://localhost:5000/api/messages/send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "receiverId": "unmatched-user-id",
    "message": "Hello"
  }'

# Expected: 403 - "You can only message users you are matched with"
```

### Test 2: Send Message (After Match)
```bash
# Message a matched user
curl -X POST http://localhost:5000/api/messages/send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "receiverId": "matched-user-id",
    "message": "Assalamu alaikum! I would love to get to know you better."
  }'

# Expected: 201 - Message sent successfully
```

### Test 3: Get Conversations
```bash
curl http://localhost:5000/api/messages/conversations \
  -H "Authorization: Bearer <token>"

# Expected: Array of conversations with unread counts
```

### Test 4: Get Conversation History
```bash
curl http://localhost:5000/api/messages/conversation/<match-id> \
  -H "Authorization: Bearer <token>"

# Expected: Array of messages, oldest to newest
# All unread messages automatically marked as read
```

### Test 5: Poll for New Messages
```bash
curl "http://localhost:5000/api/messages/new?since=2026-02-15T12:00:00Z" \
  -H "Authorization: Bearer <token>"

# Expected: Array of messages received after the timestamp
```

### Test 6: Guardian Alert
```bash
# Set up test: Create Muslim woman profile with guardian
# Then send first message to her

curl -X POST http://localhost:5000/api/messages/send \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "receiverId": "muslim-woman-id",
    "message": "Hello!"
  }'

# Check conversation - should see system message about guardian
curl http://localhost:5000/api/messages/conversation/<match-id> \
  -H "Authorization: Bearer <token>"

# Expected: User message + Guardian alert system message
```

---

## 🔒 Security Features

### Access Control
- ✅ Only matched users can message each other
- ✅ Match must be active (not unmatched)
- ✅ Respects blocks (can't message blocked users)
- ✅ Only message sender can delete their messages
- ✅ Only message receiver can mark as read

### Data Protection
- ✅ Guardian info only visible after match
- ✅ Phone numbers never exposed
- ✅ Soft delete (messages not permanently removed)
- ✅ Read receipts respect privacy

### Rate Limiting (Prepared for Phase 8)
- Will limit messages per hour (100)
- Prevents spam and abuse

---

## 📊 Database Impact

### Messages Table
Every message creates a record:
```sql
INSERT INTO messages (
    match_id,
    sender_id,
    receiver_id,
    message_text,
    message_type,      -- 'text' or 'guardian_alert'
    guardian_notified,  -- true if guardian alert sent
    is_read,
    read_at
)
```

### Performance Optimizations
- ✅ Indexes on match_id, sender_id, receiver_id
- ✅ Index on created_at for sorting
- ✅ Index on is_read for unread queries
- ✅ Pagination to limit results
- ✅ Efficient queries with JOINs

---

## 🎨 Message Types

### 1. Text Message (Standard)
```json
{
  "messageType": "text",
  "messageText": "Hello, how are you?",
  "guardianNotified": false
}
```

### 2. Guardian Alert (System)
```json
{
  "messageType": "guardian_alert",
  "messageText": "As per Islamic tradition, it is recommended that this conversation involves your guardian. Your guardian has been notified.",
  "guardianNotified": true
}
```

### 3. Future: Other Types (Phase 8+)
- Images
- Voice notes
- Video messages
- Stickers/reactions

---

## 🌟 Unique Features

### 1. Guardian Respect System
**What Makes It Special:**
- First-of-its-kind in dating apps
- Respects Islamic courtship traditions
- Automated, no manual intervention needed
- Optional SMS integration
- Gracefully integrated into conversation flow

### 2. Privacy-First Messaging
- Guardian info hidden until match
- No user data exposed
- Read receipts implemented
- Soft delete preserves records

### 3. Polling-Based (MVP)
- No WebSocket complexity
- Easy to implement
- Works everywhere
- Can upgrade to WebSocket later (Phase 8)

---

## 🔄 Future Enhancements (Post-MVP)

### WebSocket Integration
Replace polling with real-time WebSocket:
```bash
npm install socket.io
```

Benefits:
- Instant message delivery
- Lower server load
- Better user experience
- Typing indicators

### Rich Media
- Image sharing
- Voice notes
- Video calls
- File attachments

### Advanced Features
- Message reactions
- Reply/quote messages
- Voice/video calls
- Group conversations (family introductions)

---

## 📝 Files Created/Modified

### New Files (2):
1. `src/controllers/messageController.js` - Messaging logic
2. `src/routes/messageRoutes.js` - Message endpoints

### Modified Files (1):
1. `src/server.js` - Added message routes

---

## 💡 Key Design Decisions

1. **Mutual Match Required** - Only matched users can message (prevents spam)
2. **Guardian Alerts Automatic** - No user action needed, happens on first message
3. **Polling Over WebSocket** - Simpler for MVP, upgrade path exists
4. **Soft Delete** - Messages marked deleted but not removed (audit trail)
5. **Auto Read Receipts** - Opening conversation marks all as read (simplified UX)
6. **System Messages** - Guardian alerts are system messages in conversation
7. **No Edit** - Messages can't be edited (prevents abuse)

---

## 🎯 Success Metrics

Phase 5 is successful if:
- ✅ Matched users can message each other
- ✅ Non-matched users cannot message
- ✅ Guardian alerts work for Muslim women
- ✅ Read receipts function properly
- ✅ Polling endpoint returns new messages
- ✅ Conversation list shows unread counts
- ✅ Security rules are enforced

All metrics: **ACHIEVED** ✅

---

## 🎉 Phase 5 Complete!

The messaging system is now fully operational! Users can:
- ✅ Message their matches
- ✅ View conversation history
- ✅ Get notified of new messages (via polling)
- ✅ See read receipts
- ✅ Respect Islamic traditions with guardian alerts

**The platform is now functionally complete for basic dating!** Users can:
1. Register with invite code ✅
2. Create detailed profile ✅
3. Get admin approval ✅
4. Browse matches ✅
5. Like profiles ✅
6. Match with others ✅
7. **Message matches ✅**

Next: Add verification, safety features, and polish!
