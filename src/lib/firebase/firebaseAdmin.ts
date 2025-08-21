
import admin from 'firebase-admin';

// This function ensures that Firebase Admin is initialized only once.
export async function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson || serviceAccountJson.startsWith('TU_JSON_DE')) {
    const errorMessage = 'El JSON de la cuenta de servicio de Firebase no ha sido configurado correctamente en el archivo .env.';
    console.error(`Firebase Admin Init Error: ${errorMessage}`);
    throw new Error(errorMessage);
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("Firebase Admin SDK initialized successfully.");
    return admin.firestore();
  } catch (error: any) {
    console.error('Firebase Admin Init Error: Failed to initialize.', error);
    throw new Error(`No se pudo inicializar el Firebase Admin SDK: ${error.message}`);
  }
}
