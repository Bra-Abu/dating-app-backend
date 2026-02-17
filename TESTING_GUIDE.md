# Complete Testing Guide - Marriage Dating Platform

## 📋 Prerequisites

Before testing, ensure you have:
- ✅ PostgreSQL installed and running
- ✅ Node.js installed
- ✅ Firebase project set up
- ✅ All npm packages installed

---

## 🚀 Step 1: Initial Setup

### 1.1 Install Dependencies
```bash
cd C:\Users\LENOVO\dating-app-backend
npm install
```

### 1.2 Verify Environment Variables
Check your `.env` file has these values:
```env
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5433
DB_NAME=dating_app
DB_USER=postgres
DB_PASSWORD=POSTGRE4jollof

# Firebase (make sure your firebase config file exists)
FIREBASE_PROJECT_ID=your-project-id

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# Rate Limiting
LIKE_LIMIT_PER_DAY=50
MESSAGE_LIMIT_PER_HOUR=100
```

### 1.3 Create Database and Run Migration
```bash
# Make sure PostgreSQL is running on port 5433

# Run the migration
node database/migrate.js
```

**Expected Output:**
```
🚀 Starting database migration...

📋 Running schema.sql...
✅ Schema created successfully!

🌱 Running seeds.sql...
✅ Seed data inserted successfully!

📊 Tables created:
   ✓ users
   ✓ profiles
   ✓ invite_codes
   ✓ matches
   ✓ messages
   ✓ verifications
   ✓ reports
   ✓ blocks
   ✓ notifications
   ✓ admin_actions
   ✓ activity_log
   ✓ compatibility_questions
   ✓ compatibility_answers

🎯 Compatibility questions seeded: 30

✅ Database migration completed successfully!
```

---

## 🎯 Step 2: Create Test Users

### 2.1 Create Admin User (via SQL)

Since all users need invite codes, we'll create an admin user directly in the database first.

```bash
# Connect to PostgreSQL
psql -h localhost -p 5433 -U postgres -d dating_app
```

Or use a GUI tool like **pgAdmin** or **DBeaver**.

**Run this SQL:**
```sql
-- Create admin user
-- Replace 'your-firebase-uid' with an actual Firebase UID from your Firebase project
INSERT INTO users (
    firebase_uid,
    phone_number,
    status,
    account_type,
    phone_verified
) VALUES (
    'admin-test-uid-12345',  -- Replace with real Firebase UID
    '+2348012345678',
    'active',
    'super_admin',
    true
);

-- Verify admin was created
SELECT id, phone_number, status, account_type FROM users;
```

**Important:** To get a real Firebase UID:
1. Go to Firebase Console → Authentication
2. Add a test user with phone number
3. Copy the UID from the user list
4. Use that UID in the SQL above

### 2.2 Start the Server
```bash
npm run dev
```

**Expected Output:**
```
✅ Server is running on http://localhost:5000
📍 Health check: http://localhost:5000/health
```

### 2.3 Test Health Endpoint
```bash
curl http://localhost:5000/health
```

**Expected Response:**
```json
{
  "status": "OK",
  "message": "Server is running!",
  "timestamp": "2026-02-15T12:00:00.000Z"
}
```

---

## 🧪 Step 3: Testing with Postman (Recommended)

### 3.1 Install Postman
Download from: https://www.postman.com/downloads/

### 3.2 Set Up Environment Variables in Postman

Create a new environment with these variables:
- `base_url` = `http://localhost:5000`
- `admin_token` = (we'll get this after Firebase auth)
- `user1_token` = (for test user 1)
- `user2_token` = (for test user 2)

### 3.3 Get Firebase Token (Important!)

You need to authenticate with Firebase to get ID tokens. Two options:

**Option A: Use Firebase Authentication REST API**
```bash
# Replace with your Firebase Web API Key
curl -X POST "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPhoneNumber?key=YOUR_WEB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+2348012345678",
    "recaptchaToken": "..."
  }'
```

**Option B: Use Frontend (Easier)**
Create a simple HTML file to get tokens:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Get Firebase Token</title>
    <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"></script>
    <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js"></script>
</head>
<body>
    <h1>Firebase Auth Test</h1>
    <div id="recaptcha-container"></div>
    <input type="tel" id="phone" placeholder="+2348012345678">
    <button onclick="sendCode()">Send Code</button>
    <br><br>
    <input type="text" id="code" placeholder="Enter OTP">
    <button onclick="verifyCode()">Verify Code</button>
    <br><br>
    <div id="token"></div>

    <script>
        // Replace with your Firebase config
        const firebaseConfig = {
            apiKey: "YOUR_API_KEY",
            authDomain: "YOUR_PROJECT.firebaseapp.com",
            projectId: "YOUR_PROJECT_ID"
        };
        firebase.initializeApp(firebaseConfig);

        let confirmationResult;

        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container');

        function sendCode() {
            const phone = document.getElementById('phone').value;
            firebase.auth().signInWithPhoneNumber(phone, window.recaptchaVerifier)
                .then((result) => {
                    confirmationResult = result;
                    alert('OTP sent!');
                });
        }

        function verifyCode() {
            const code = document.getElementById('code').value;
            confirmationResult.confirm(code).then((result) => {
                result.user.getIdToken().then((token) => {
                    document.getElementById('token').innerHTML =
                        '<strong>Token:</strong><br>' + token;
                    console.log('Token:', token);
                });
            });
        }
    </script>
</body>
</html>
```

**For testing purposes, you can also:**
- Skip Firebase auth temporarily by modifying `authMiddleware.js`
- Or create a test endpoint that generates mock tokens

---

## 📝 Step 4: Test Each Phase

### Phase 1: Foundation & Invites

#### Test 1: Get Admin's Invite Code
```bash
# Postman: GET {{base_url}}/api/invites/my-code
# Headers: Authorization: Bearer {{admin_token}}

curl http://localhost:5000/api/invites/my-code \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "code": "ABCD-EFGH",
    "maxUses": 5,
    "timesUsed": 0,
    "remainingUses": 5,
    "isActive": true
  }
}
```

**Copy the invite code!** You'll need it to register new users.

#### Test 2: Validate Invite Code (Public)
```bash
curl -X POST http://localhost:5000/api/auth/validate-invite \
  -H "Content-Type: application/json" \
  -d '{
    "code": "ABCD-EFGH"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "valid": true,
  "message": "Invite code is valid"
}
```

#### Test 3: Register New User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "FIREBASE_TOKEN_HERE",
    "inviteCode": "ABCD-EFGH"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Registration successful. Your account is pending admin approval.",
  "data": {
    "userId": "uuid-here",
    "status": "pending_approval",
    "requiresApproval": true
  }
}
```

---

### Phase 2: Admin Approval

#### Test 4: View Pending Users (Admin)
```bash
curl http://localhost:5000/api/admin/users/pending \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "user-uuid",
      "phone_number": "+234...",
      "status": "pending_approval",
      "created_at": "..."
    }
  ],
  "count": 1
}
```

#### Test 5: Approve User (Admin)
```bash
curl -X POST http://localhost:5000/api/admin/users/USER_ID/approve \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Profile looks genuine"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "User approved successfully"
}
```

#### Test 6: Create Profile (Approved User)
```bash
curl -X POST http://localhost:5000/api/profiles \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Aisha",
    "last_name": "Ibrahim",
    "date_of_birth": "1998-05-20",
    "gender": "female",
    "religion": "Islam",
    "denomination": "Sunni",
    "city": "Lagos",
    "state": "Lagos",
    "education": "Bachelor Degree",
    "occupation": "Software Engineer",
    "height": 165,
    "marital_status": "Never Married",
    "want_children": "Definitely Yes",
    "has_guardian": true,
    "guardian_name": "Ahmad Ibrahim",
    "guardian_relationship": "Father"
  }'
```

---

### Phase 3: Matching

#### Test 7: Get Match Suggestions
```bash
curl http://localhost:5000/api/matches/suggestions?limit=5 \
  -H "Authorization: Bearer USER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": [
    {
      "userId": "...",
      "profile": {
        "firstName": "Muhammad",
        "age": 28,
        "city": "Lagos",
        "religion": "Islam"
      },
      "compatibility": {
        "score": 85.5,
        "breakdown": {
          "religion": 20,
          "age": 15,
          "location": 15
        }
      }
    }
  ]
}
```

#### Test 8: Like a Profile
```bash
curl -X POST http://localhost:5000/api/matches/like/OTHER_USER_ID \
  -H "Authorization: Bearer USER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Like sent successfully",
  "data": {
    "isMutualMatch": false,
    "compatibilityScore": 85.5
  }
}
```

#### Test 9: Create Mutual Match
```bash
# Have the other user like back
curl -X POST http://localhost:5000/api/matches/like/USER1_ID \
  -H "Authorization: Bearer USER2_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "It's a match! 🎉",
  "data": {
    "isMutualMatch": true
  }
}
```

#### Test 10: View Mutual Matches
```bash
curl http://localhost:5000/api/matches/mutual \
  -H "Authorization: Bearer USER_TOKEN"
```

---

### Phase 5: Messaging

#### Test 11: Send Message (Only Works After Match!)
```bash
curl -X POST http://localhost:5000/api/messages/send \
  -H "Authorization: Bearer USER1_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "receiverId": "USER2_ID",
    "message": "Assalamu alaikum! Nice to meet you."
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "messageId": "...",
    "guardianAlertSent": true
  }
}
```

**If Muslim woman with guardian:** You'll see a system message about guardian!

#### Test 12: Get Conversations
```bash
curl http://localhost:5000/api/messages/conversations \
  -H "Authorization: Bearer USER_TOKEN"
```

#### Test 13: Get Conversation History
```bash
curl http://localhost:5000/api/messages/conversation/MATCH_ID \
  -H "Authorization: Bearer USER_TOKEN"
```

---

### Phase 4: Verification

#### Test 14: Upload Selfie
```bash
curl -X POST http://localhost:5000/api/verifications/photo \
  -H "Authorization: Bearer USER_TOKEN" \
  -F "selfie=@/path/to/selfie.jpg"
```

**Create a test image first:**
- Take a selfie or use any photo
- Name it `selfie.jpg`
- Upload it

#### Test 15: Check Verification Status
```bash
curl http://localhost:5000/api/verifications/status \
  -H "Authorization: Bearer USER_TOKEN"
```

#### Test 16: Admin Views Pending Verifications
```bash
curl http://localhost:5000/api/verifications/admin/pending \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Test 17: Admin Approves Verification
```bash
curl -X POST http://localhost:5000/api/verifications/admin/VERIFICATION_ID/approve \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Verified"}'
```

---

## 🛠️ Alternative: Testing Without Firebase

If Firebase is too complicated for testing, you can temporarily bypass auth:

### Create a Test Middleware (DEVELOPMENT ONLY!)

Create `src/middleware/testAuthMiddleware.js`:
```javascript
// DEVELOPMENT ONLY - DO NOT USE IN PRODUCTION
const pool = require('../config/database');

const mockVerifyToken = async (req, res, next) => {
    // Mock user ID - replace with actual user ID from your database
    const mockUserId = req.headers['x-test-user-id'];

    if (!mockUserId) {
        return res.status(401).json({
            success: false,
            error: 'Please provide x-test-user-id header for testing'
        });
    }

    const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [mockUserId]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({
            success: false,
            error: 'Test user not found'
        });
    }

    const user = result.rows[0];
    req.user = {
        id: user.id,
        firebaseUid: user.firebase_uid,
        phoneNumber: user.phone_number,
        status: user.status,
        account_type: user.account_type
    };

    next();
};

module.exports = { mockVerifyToken };
```

Then in your routes (temporarily), replace:
```javascript
const { verifyToken } = require('../middleware/authMiddleware');
```

With:
```javascript
const { mockVerifyToken: verifyToken } = require('../middleware/testAuthMiddleware');
```

Now you can test with:
```bash
curl http://localhost:5000/api/profiles/me \
  -H "x-test-user-id: YOUR_USER_UUID_FROM_DATABASE"
```

---

## 📊 Recommended Testing Order

1. ✅ **Database Setup** - Run migration
2. ✅ **Create Admin** - SQL insert
3. ✅ **Get Admin Token** - Firebase or mock auth
4. ✅ **Get Invite Code** - Admin endpoint
5. ✅ **Register Users** - 2-3 test users
6. ✅ **Approve Users** - Admin approves them
7. ✅ **Create Profiles** - Fill in profile data
8. ✅ **Test Matching** - Get suggestions, like profiles
9. ✅ **Create Matches** - Mutual likes
10. ✅ **Test Messaging** - Send messages
11. ✅ **Test Verification** - Upload photos

---

## 🐛 Common Issues & Solutions

### Issue 1: "Database connection failed"
**Solution:** Check PostgreSQL is running on port 5433
```bash
# Check if PostgreSQL is running
psql -h localhost -p 5433 -U postgres
```

### Issue 2: "Table doesn't exist"
**Solution:** Run the migration
```bash
node database/migrate.js
```

### Issue 3: "User not found in database"
**Solution:** Make sure Firebase UID in database matches Firebase UID in token

### Issue 4: "Your account is pending admin approval"
**Solution:** Use admin account to approve the user first

### Issue 5: "You can only message users you are matched with"
**Solution:** Both users must like each other first (mutual match)

### Issue 6: "No token provided"
**Solution:** Include Authorization header with Bearer token

---

## 🎯 Quick Test Script

Save this as `test.sh`:
```bash
#!/bin/bash

BASE_URL="http://localhost:5000"
ADMIN_TOKEN="your-admin-token-here"

echo "Testing Health..."
curl $BASE_URL/health

echo "\n\nGetting Invite Code..."
curl $BASE_URL/api/invites/my-code \
  -H "Authorization: Bearer $ADMIN_TOKEN"

echo "\n\nGetting Pending Users..."
curl $BASE_URL/api/admin/users/pending \
  -H "Authorization: Bearer $ADMIN_TOKEN"

echo "\n\nTest Complete!"
```

Run with: `bash test.sh`

---

## 📱 Postman Collection

I recommend creating a Postman collection with all endpoints. Here's a starter:

1. **Create Collection** - "Marriage Dating Platform"
2. **Add Folder** - "Authentication"
3. **Add Folder** - "Profiles"
4. **Add Folder** - "Matching"
5. **Add Folder** - "Messaging"
6. **Add Folder** - "Verification"
7. **Add Folder** - "Admin"

Each folder should contain the relevant endpoints from this guide.

---

## ✅ Testing Checklist

- [ ] Database migrated successfully
- [ ] Server starts without errors
- [ ] Health endpoint responds
- [ ] Admin user created
- [ ] Can get invite code
- [ ] Can register new user
- [ ] Can approve user (admin)
- [ ] Can create profile
- [ ] Can browse profiles
- [ ] Can get match suggestions
- [ ] Can like profiles
- [ ] Can create mutual match
- [ ] Can send messages
- [ ] Can upload verification photos
- [ ] Admin can approve verifications

---

## 🎉 Next Steps

Once you've tested everything:
1. Note any bugs or issues
2. Test edge cases (invalid inputs, etc.)
3. Ready to continue with remaining phases!

**Need help?** Check the logs in your terminal for detailed error messages.
