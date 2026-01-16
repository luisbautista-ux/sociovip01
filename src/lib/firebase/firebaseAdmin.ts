
// src/lib/firebase/firebaseAdmin.ts
import admin from 'firebase-admin';

// Cuando se despliega en un entorno de Google Cloud (como Firebase App Hosting),
// initializeApp() usa automáticamente las Credenciales Predeterminadas de la Aplicación (ADC).
// Este es el método recomendado y más robusto.

// Evitar reinicialización en entornos de desarrollo con hot-reloading
if (!admin.apps.length) {
  try {
    // Este método es el estándar para producción en Google Cloud.
    admin.initializeApp();
  } catch (error: any) {
    console.error('Error de inicialización de Firebase Admin:', error);
    // Si este error ocurre en producción, significa que el entorno no está configurado correctamente.
    // En desarrollo local, se debe ejecutar `gcloud auth application-default login`.
    throw new Error(`Error de configuración de Firebase Admin: ${error.message}. Asegúrate de que las credenciales de la aplicación estén configuradas o que el emulador esté en uso.`);
  }
}

// Exportar la instancia de la base de datos de admin ya inicializada y el objeto admin.
export const adminDb = admin.firestore();
export { admin };
