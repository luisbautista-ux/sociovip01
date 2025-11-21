
import admin from 'firebase-admin';

// Evita la reinicialización en entornos de desarrollo con recarga en caliente
if (!admin.apps.length) {
  try {
    // Esta configuración funciona en entornos de servidor donde
    // las variables de entorno de Google Cloud están disponibles (como en App Hosting)
    // o donde GOOGLE_APPLICATION_CREDENTIALS está establecido.
    admin.initializeApp();
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

// Exporta la instancia de administrador ya inicializada
export { admin };
