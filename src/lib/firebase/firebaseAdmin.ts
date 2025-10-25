
import admin from 'firebase-admin';

// This function ensures that Firebase Admin is initialized only once.
export async function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  try {
    // Attempt to parse the service account from the environment variable.
    const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountString) {
      throw new Error("La variable de entorno FIREBASE_SERVICE_ACCOUNT_JSON no está definida.");
    }
    const serviceAccount = JSON.parse(serviceAccountString);

    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("Firebase Admin SDK initialized successfully from environment variable.");
    return app;
    
  } catch (error: any) {
    console.error('Firebase Admin Init Error:', error.message);
    // Provide a more descriptive error message to help debug.
    let detail = error.message;
    if (error instanceof SyntaxError) {
        detail = "El JSON de la variable de entorno está mal formado.";
    }
    throw new Error(`No se pudo inicializar el Firebase Admin SDK: ${detail}`);
  }
}

// Export admin itself so it can be used elsewhere after initialization
export { admin };
