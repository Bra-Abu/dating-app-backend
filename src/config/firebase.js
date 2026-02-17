// Firebase Admin SDK configuration
const admin = require('firebase-admin');
const path = require('path');

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  // Production: load from environment variable
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Local development: load from file
  const keyPath = path.join(__dirname, '../../serviceAccountKey.json');
  serviceAccount = require(keyPath);
}

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

console.log('✅ Firebase Admin initialized');

module.exports = admin;
