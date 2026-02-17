# Marriage-Focused Dating Platform - Setup Guide

## Phase 1: Foundation ✅ COMPLETED

### What's Been Implemented

1. **Complete Database Schema** (`database/schema.sql`)
   - 15 tables for users, profiles, invites, matches, messages, verifications, etc.
   - 40+ fields in profiles for deep compatibility matching
   - Proper indexes and relationships
   - Views and triggers for automation

2. **Invite System** (Invite-only access)
   - Service: `src/services/inviteService.js`
   - Controller: `src/controllers/inviteController.js`
   - Routes: `src/routes/inviteRoutes.js`
   - Features:
     - Generate unique 8-character codes (format: XXXX-XXXX)
     - Validate invite codes
     - Track usage statistics
     - Max 5 uses per code by default

3. **Updated Authentication**
   - Controller: `src/controllers/authController.js`
   - New registration flow requires invite code
   - New users start with `status: 'pending_approval'`
   - Separated login (`/verify`) from registration (`/register`)

4. **Enhanced Middleware**
   - `verifyToken` - Verifies Firebase token and attaches user
   - `requireApprovedAccount` - Ensures account is approved
   - `checkNotBanned` - Prevents banned users from accessing routes

## How to Run the Setup

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set Up Database
Make sure PostgreSQL is running, then run the migration:

```bash
# Run the database migration script
node database/migrate.js
```

This will:
- Create all 15 tables
- Set up indexes and relationships
- Seed compatibility questions
- Display a summary of created tables

### Step 3: Create First Admin User

Since all users now need admin approval, you need to manually create an admin user in the database:

```sql
-- Connect to your database
psql -h localhost -p 5433 -U postgres -d dating_app

-- Create admin user (use your actual Firebase UID from Firebase Console)
INSERT INTO users (firebase_uid, phone_number, status, account_type, phone_verified)
VALUES ('your-firebase-uid-here', '+1234567890', 'active', 'super_admin', true);

-- Verify admin was created
SELECT id, phone_number, status, account_type FROM users;
```

### Step 4: Start the Server
```bash
npm run dev
```

Server runs on `http://localhost:5000`

## API Endpoints - Phase 1

### Authentication Routes

#### POST /api/auth/validate-invite
Validate an invite code (public, for registration flow)
```json
{
  "code": "ABCD-EFGH"
}
```

#### POST /api/auth/register
Register new user with invite code
```json
{
  "idToken": "firebase-id-token",
  "inviteCode": "ABCD-EFGH"
}
```

#### POST /api/auth/verify
Login existing user
```json
{
  "idToken": "firebase-id-token"
}
```

#### GET /api/auth/me
Get current user info (requires auth token)
```
Authorization: Bearer <firebase-token>
```

### Invite Routes (All require authentication)

#### GET /api/invites/my-code
Get your invite code
```
Authorization: Bearer <firebase-token>
```

#### GET /api/invites/stats
Get usage statistics for your invite codes

#### GET /api/invites/invited-users
Get list of users you've invited

#### POST /api/invites/generate
Generate a new invite code (when current is exhausted)

## Testing Phase 1

### Test 1: Validate Database Setup
```bash
# Run migration
node database/migrate.js

# Should see:
# ✅ Schema created successfully!
# ✅ Seed data inserted successfully!
# 📊 Tables created: (15 tables listed)
# 🎯 Compatibility questions seeded: 30
```

### Test 2: Try Registering Without Invite Code
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"idToken": "test-token"}'

# Should fail: "ID token and invite code are required"
```

### Test 3: Get Admin User's Invite Code
After creating admin user manually:
```bash
# Login as admin and get your invite code
curl http://localhost:5000/api/invites/my-code \
  -H "Authorization: Bearer <admin-firebase-token>"

# Should return your invite code
```

### Test 4: Validate Invite Code
```bash
curl -X POST http://localhost:5000/api/auth/validate-invite \
  -H "Content-Type: application/json" \
  -d '{"code": "YOUR-CODE"}'

# Should return: {"success": true, "valid": true}
```

### Test 5: Register New User With Invite Code
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "firebase-token-from-frontend",
    "inviteCode": "YOUR-CODE"
  }'

# Should return:
# {
#   "success": true,
#   "message": "Registration successful. Your account is pending admin approval.",
#   "data": {
#     "userId": "...",
#     "status": "pending_approval",
#     "requiresApproval": true
#   }
# }
```

### Test 6: Pending User Cannot Access Protected Routes
```bash
# Try to access protected route as pending user
curl http://localhost:5000/api/profiles/me \
  -H "Authorization: Bearer <pending-user-token>"

# Should fail: "Your account is pending admin approval"
```

## What's Next?

### Phase 2: Admin Approval System (Up Next)
- Admin middleware
- Admin dashboard for user management
- Approve/reject/suspend users
- Extended profile fields (40+ fields)
- Profile moderation

### Phase 3: Matching System
- Compatibility scoring algorithm
- Match suggestions
- Like/pass/match functionality

### Phase 4+: See implementation plan for full roadmap

## Database Structure

### Key Tables:
- `users` - User accounts (with invite tracking)
- `profiles` - Deep compatibility profiles (40+ fields)
- `invite_codes` - Invite code management
- `matches` - Like/pass/match tracking
- `messages` - Messaging between matched users
- `verifications` - Photo/ID verification
- `reports` - User reporting system
- `blocks` - Block management
- `notifications` - In-app notifications
- `admin_actions` - Audit log
- `activity_log` - Anti-fake measures
- `compatibility_questions` - For matching algorithm
- `compatibility_answers` - User answers

### Important Columns:
- `users.status` - pending_approval, active, suspended, banned, deleted
- `users.account_type` - user, admin, super_admin
- `users.invited_by` - Referral tracking
- `profiles.moderation_status` - pending, approved, rejected
- `profiles.preferences` - JSONB with matching preferences

## Development Notes

- All new users require admin approval (`status: 'pending_approval'`)
- Use `requireApprovedAccount` middleware for routes that need approved accounts
- Invite codes are unique 8-character codes (format: XXXX-XXXX)
- Each invite code can be used 5 times by default
- Phone verification happens through Firebase Auth
- Database uses UUIDs for all IDs

## Common Issues

### Issue: "User not found" after registration
**Solution**: New users have `status: 'pending_approval'` - admin needs to approve them

### Issue: "Your account is pending admin approval"
**Solution**: This is expected! Admin must approve the account first

### Issue: Migration fails
**Solution**: Check PostgreSQL is running, credentials in .env are correct

### Issue: Can't create admin user
**Solution**: Make sure you're using the actual Firebase UID from Firebase Console, not just any string
