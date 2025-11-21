
import admin from 'firebase-admin';
import serviceAccount from '../../../serviceAccountKey.json';

// This function ensures that Firebase Admin is initialized only once.
export function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  try {
    const typedServiceAccount = serviceAccount as admin.ServiceAccount;
    
    // Check if the essential properties exist to avoid runtime errors
    if (!typedServiceAccount.project_id || !typedServiceAccount.private_key || !typedServiceAccount.client_email) {
      throw new Error("El archivo serviceAccountKey.json es inválido o está incompleto.");
    }
    
    const app = admin.initializeApp({
      credential: admin.credential.cert(typedServiceAccount),
    });

    console.log("Firebase Admin SDK initialized successfully.");
    return app;
    
  } catch (error: any) {
    console.error('Firebase Admin Init Error:', error.message);
    throw new Error(`No se pudo inicializar el Firebase Admin SDK: ${error.message}`);
  }
}

// Export admin itself so it can be used elsewhere after initialization
export { admin };
