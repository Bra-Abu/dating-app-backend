# 🚀 Deployment Guide - Dating App

## Prerequisites
1. GitHub account
2. Render account (https://render.com)
3. Vercel account (https://vercel.com)
4. Firebase project already setup

---

## Part 1: Deploy Backend to Render

### Step 1: Push Code to GitHub

```bash
cd dating-app-backend

# Initialize git if not already done
git init
git add .
git commit -m "Initial commit - ready for deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/dating-app-backend.git
git branch -M main
git push -u origin main
```

### Step 2: Create PostgreSQL Database on Render

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"PostgreSQL"**
3. **Settings:**
   - Name: `dating-app-db`
   - Database: `dating_app`
   - User: `dating_app_user`
   - Region: Choose closest to you
   - Plan: **Free** (or paid for production)
4. Click **"Create Database"**
5. **SAVE** the **Internal Database URL** (you'll need it!)

### Step 3: Run Database Migration

1. Click on your database
2. Go to **"Shell"** tab
3. Run the migration:
   ```sql
   -- Copy and paste the contents of database/schema.sql here
   ```

### Step 4: Deploy Backend Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. **Settings:**
   - Name: `dating-app-backend`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: **Free** (or paid)

4. **Environment Variables** - Click "Advanced" → Add:

```
NODE_ENV=production
PORT=5000
DATABASE_URL=[paste Internal Database URL from Step 2]
FIREBASE_SERVICE_ACCOUNT=[paste serviceAccountKey.json as single-line JSON]
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
LIKE_LIMIT_PER_DAY=50
MESSAGE_LIMIT_PER_HOUR=100
API_RATE_LIMIT_WINDOW_MS=900000
API_RATE_LIMIT_MAX_REQUESTS=100
ALLOWED_ORIGINS=https://your-frontend.vercel.app
ENABLE_AI_VERIFICATION=false
ENABLE_REAL_TIME_MESSAGING=false
```

5. Click **"Create Web Service"**
6. Wait for deployment (5-10 mins)
7. **SAVE your backend URL:** `https://dating-app-backend-XXXX.onrender.com`

### Step 5: Test Backend

```bash
curl https://your-backend.onrender.com/health
```

Should return: `{"status":"OK","message":"Server is running!"}`

---

## Part 2: Deploy Frontend to Vercel

### Step 1: Push Frontend to GitHub

```bash
cd ../frontend

git init
git add .
git commit -m "Initial commit - ready for deployment"

# Create a new repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/dating-app-frontend.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com/dashboard
2. Click **"Add New..."** → **"Project"**
3. Import your `dating-app-frontend` repository
4. **Settings:**
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

5. **Environment Variables:**

```
VITE_API_BASE_URL=https://your-backend.onrender.com/api
VITE_FIREBASE_API_KEY=[from Firebase Console]
VITE_FIREBASE_AUTH_DOMAIN=[from Firebase Console]
VITE_FIREBASE_PROJECT_ID=[from Firebase Console]
VITE_FIREBASE_STORAGE_BUCKET=[from Firebase Console]
VITE_FIREBASE_MESSAGING_SENDER_ID=[from Firebase Console]
VITE_FIREBASE_APP_ID=[from Firebase Console]
VITE_MESSAGE_POLL_INTERVAL=5000
VITE_NOTIFICATION_POLL_INTERVAL=30000
```

6. Click **"Deploy"**
7. Wait for deployment (2-5 mins)
8. **SAVE your frontend URL:** `https://your-app.vercel.app`

### Step 3: Update Backend CORS

Go back to Render → Your Backend Service → Environment:
- Update `ALLOWED_ORIGINS` to your Vercel URL

---

## Part 3: Final Steps

### 1. Create Initial Admin User

SSH into Render backend shell and run:
```bash
node createAdmin.js
```

Save the admin credentials and invite code!

### 2. Test the Application

1. Visit your Vercel URL
2. Register with the admin invite code
3. Login and test all features

### 3. Update Firebase Auth Domain

In Firebase Console → Authentication → Settings:
- Add your Vercel domain to Authorized domains

---

## ✅ Deployment Complete!

**Your URLs:**
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-backend.onrender.com`
- Database: Render PostgreSQL

**Next Steps:**
- Set up custom domain (optional)
- Configure Firebase phone authentication for production
- Monitor usage and upgrade plans as needed

---

## Troubleshooting

### Backend Not Starting?
- Check Render logs
- Verify DATABASE_URL is correct
- Ensure all environment variables are set

### Frontend Can't Connect to Backend?
- Check VITE_API_BASE_URL is correct
- Verify CORS settings in backend
- Check browser console for errors

### Database Connection Failed?
- Verify DATABASE_URL format
- Check database is running on Render
- Ensure migrations ran successfully
