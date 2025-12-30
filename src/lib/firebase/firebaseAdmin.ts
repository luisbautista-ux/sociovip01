// src/lib/firebase/firebaseAdmin.ts
import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json';

// Evitar reinicialización en entornos de desarrollo con hot-reloading
if (!admin.apps.length) {
  try {
    const serviceAccountCredentials = {
      projectId: serviceAccount.project_id,
      clientEmail: serviceAccount.client_email,
      privateKey: serviceAccount.private_key,
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountCredentials),
    });
  } catch (error: any) {
    console.error('Error al inicializar Firebase Admin desde serviceAccountKey.json:', error);
    throw new Error(`Error de configuración de Firebase Admin: ${error.message}`);
  }
}

// Exportar la instancia de la base de datos de admin ya inicializada y el objeto admin.
export const adminDb = admin.firestore();
export { admin };
