
import admin from 'firebase-admin';

// Check if the app is already initialized to prevent errors
if (!admin.apps.length) {
  try {
    // This will automatically use the GOOGLE_APPLICATION_CREDENTIALS environment variable
    // which should point to your serviceAccountKey.json file.
    // Or, if not set, it might use other default credentials in a cloud environment.
    admin.initializeApp();
    console.log("Firebase Admin SDK initialized successfully.");
  } catch (error: any) {
    console.error("Firebase Admin Init Error from firebaseAdmin.ts:", error);
    // We don't re-throw here to avoid breaking the app on module load,
    // but the error will be logged. The functions using 'admin' will fail later.
  }
}

// Export admin itself so it can be used elsewhere after initialization
export { admin };
