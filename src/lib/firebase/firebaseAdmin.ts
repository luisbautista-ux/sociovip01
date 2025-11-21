
import admin from 'firebase-admin';

// Lee las credenciales directamente desde la variable de entorno
// Se espera que esta variable contenga el JSON completo como un string
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (!admin.apps.length) {
  if (!serviceAccountString) {
    console.error("La variable de entorno FIREBASE_SERVICE_ACCOUNT_JSON no está definida. La inicialización de Firebase Admin fallará en el servidor.");
  } else {
    try {
      const serviceAccount = JSON.parse(serviceAccountString);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } catch (error) {
      console.error('Error al parsear FIREBASE_SERVICE_ACCOUNT_JSON o al inicializar Firebase Admin:', error);
    }
  }
}

// Exporta la instancia de administrador ya inicializada (o un objeto vacío si falló)
export { admin };
