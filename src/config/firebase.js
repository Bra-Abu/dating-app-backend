// Firebase Admin SDK configuration
const admin = require('firebase-admin');
const path = require('path');

// Load the service account key JSON file
const serviceAccount = require(path.join(__dirname, 'firebase-admin-key.json'));

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

console.log('✅ Firebase Admin initialized');

module.exports = admin;
