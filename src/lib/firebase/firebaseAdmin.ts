// src/lib/firebase/firebaseAdmin.ts
import admin from 'firebase-admin';

// Evitar reinicialización en entornos de desarrollo con hot-reloading
if (!admin.apps.length) {
  // Verificar que las variables de entorno necesarias existan.
  if (
    !process.env.FIREBASE_PROJECT_ID ||
    !process.env.FIREBASE_CLIENT_EMAIL ||
    !process.env.FIREBASE_PRIVATE_KEY
  ) {
    // Lanzar un error claro si falta alguna variable esencial.
    throw new Error('Variables de entorno de Firebase Admin no configuradas correctamente. Asegúrate de definir FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY.');
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Reemplazar los escapes '\\n' por saltos de línea reales.
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error: any) {
    console.error('Error al inicializar Firebase Admin:', error);
    // Lanzar un error más específico para facilitar la depuración.
    throw new Error(`Error de configuración de Firebase Admin: ${error.message}`);
  }
}

// Exportar la instancia de la base de datos de admin ya inicializada y el objeto admin.
export const adminDb = admin.firestore();
export { admin };
