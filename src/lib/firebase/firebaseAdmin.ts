
import admin from 'firebase-admin';
import serviceAccount from '../../../serviceAccountKey.json';

// This function ensures that Firebase Admin is initialized only once.
export async function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  try {
    // We explicitly cast the service account to the correct type to satisfy TypeScript
    const typedServiceAccount = serviceAccount as admin.ServiceAccount;

    const app = admin.initializeApp({
      credential: admin.credential.cert(typedServiceAccount),
    });

    console.log("Firebase Admin SDK initialized successfully from serviceAccountKey.json file.");
    return app;
    
  } catch (error: any) {
    console.error('Firebase Admin Init Error:', error.message);
    let detail = error.message;
    if (error instanceof SyntaxError) {
        detail = "El archivo serviceAccountKey.json está mal formado.";
    }
    throw new Error(`No se pudo inicializar el Firebase Admin SDK: ${detail}`);
  }
}

// Export admin itself so it can be used elsewhere after initialization
export { admin };
