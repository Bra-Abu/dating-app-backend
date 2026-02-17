# Quick Start - 5 Minutes to Testing

## 1️⃣ Setup Database (1 minute)

```bash
# Run migration
node database/migrate.js
```

## 2️⃣ Create Admin User (1 minute)

```bash
# Connect to database
psql -h localhost -p 5433 -U postgres -d dating_app
```

```sql
-- Create admin (replace Firebase UID if you have one)
INSERT INTO users (firebase_uid, phone_number, status, account_type, phone_verified)
VALUES ('admin-test-123', '+2348000000001', 'active', 'super_admin', true);

-- Get the admin ID
SELECT id FROM users WHERE phone_number = '+2348000000001';
-- Copy the UUID!

-- Create 2 test users
INSERT INTO users (firebase_uid, phone_number, status, account_type, phone_verified)
VALUES
('user1-test-123', '+2348000000002', 'active', 'user', true),
('user2-test-123', '+2348000000003', 'active', 'user', true);

-- Get user IDs
SELECT id, phone_number FROM users;
-- Copy both UUIDs!

\q
```

## 3️⃣ Start Server (30 seconds)

```bash
npm run dev
```

## 4️⃣ Test Without Firebase (FOR TESTING ONLY)

Create `src/middleware/testAuth.js`:

```javascript
const pool = require('../config/database');

const testAuth = async (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ error: 'Add x-user-id header' });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    req.user = {
        id: result.rows[0].id,
        status: result.rows[0].status,
        account_type: result.rows[0].account_type
    };
    req.admin = req.user;
    next();
};

module.exports = { testAuth };
```

**Temporarily replace auth in routes:**

In `src/routes/profileRoutes.js`, `matchRoutes.js`, etc:
```javascript
// At the top, comment out:
// const { verifyToken } = require('../middleware/authMiddleware');

// Add instead:
const { testAuth: verifyToken } = require('../middleware/testAuth');
const requireApprovedAccount = (req, res, next) => next(); // Bypass for testing
```

## 5️⃣ Test Endpoints (2 minutes)

### Get Admin's Invite Code
```bash
curl http://localhost:5000/api/invites/my-code \
  -H "x-user-id: ADMIN_UUID_HERE"

# You'll get: { "code": "ABCD-EFGH" }
```

### Create Profile (User 1)
```bash
curl -X POST http://localhost:5000/api/profiles \
  -H "x-user-id: USER1_UUID_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Aisha",
    "last_name": "Ibrahim",
    "date_of_birth": "1998-05-20",
    "gender": "female",
    "religion": "Islam",
    "city": "Lagos",
    "education": "Bachelor Degree",
    "occupation": "Software Engineer"
  }'
```

### Create Profile (User 2)
```bash
curl -X POST http://localhost:5000/api/profiles \
  -H "x-user-id: USER2_UUID_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Muhammad",
    "last_name": "Yusuf",
    "date_of_birth": "1995-03-15",
    "gender": "male",
    "religion": "Islam",
    "city": "Lagos",
    "education": "Master Degree",
    "occupation": "Doctor"
  }'
```

### Get Match Suggestions
```bash
curl http://localhost:5000/api/matches/suggestions \
  -H "x-user-id: USER1_UUID_HERE"

# Should see User 2 with compatibility score!
```

### Like Each Other (Create Match)
```bash
# User 1 likes User 2
curl -X POST http://localhost:5000/api/matches/like/USER2_UUID \
  -H "x-user-id: USER1_UUID_HERE"

# User 2 likes User 1 back
curl -X POST http://localhost:5000/api/matches/like/USER1_UUID \
  -H "x-user-id: USER2_UUID_HERE"

# Response: "It's a match! 🎉"
```

### Send Message
```bash
curl -X POST http://localhost:5000/api/messages/send \
  -H "x-user-id: USER1_UUID_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "receiverId": "USER2_UUID_HERE",
    "message": "Assalamu alaikum!"
  }'
```

### View Messages
```bash
curl http://localhost:5000/api/messages/conversations \
  -H "x-user-id: USER1_UUID_HERE"
```

## 🎉 Success!

You've tested:
- ✅ Profile creation
- ✅ Match suggestions with compatibility scores
- ✅ Mutual matching
- ✅ Messaging

## 🔄 Reset Database

To start over:
```bash
node database/migrate.js
# This will drop and recreate all tables
```

## ⚠️ Important

**Remove test auth before production!**
- The `testAuth` middleware is only for local testing
- In production, use proper Firebase authentication
- Remove or comment out test auth code before deploying

## 📚 Full Guide

See `TESTING_GUIDE.md` for:
- Firebase authentication setup
- Complete API documentation
- Troubleshooting guide
- Postman collection setup
