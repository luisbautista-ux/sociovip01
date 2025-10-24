import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// This function ensures that Firebase Admin is initialized only once.
export async function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]; // Return the existing app instance
  }

  try {
    const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("Firebase Admin SDK initialized successfully from file.");
    return app;
  } catch (error: any) {
    console.error('Firebase Admin Init Error: Failed to initialize from file.', error);
    throw new Error(`No se pudo inicializar el Firebase Admin SDK: ${error.message}`);
  }
}

// Export admin itself so it can be used elsewhere after initialization
export { admin };
