
import admin from 'firebase-admin';
import serviceAccount from '@/../serviceAccountKey.json';

// Evita la reinicialización en entornos de desarrollo con recarga en caliente
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

// Exporta la instancia de administrador ya inicializada
export { admin };
