
// src/lib/firebase/firebaseAdmin.ts
import admin from 'firebase-admin';

// Esta variable de entorno debe contener el JSON de la clave de servicio como un string.
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

let adminDb: admin.firestore.Firestore;

const initializeAdminApp = () => {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }
  
  if (!serviceAccountString) {
    throw new Error("La variable de entorno FIREBASE_SERVICE_ACCOUNT_JSON no está definida.");
  }
  
  try {
    const serviceAccount = JSON.parse(serviceAccountString);
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Error al parsear FIREBASE_SERVICE_ACCOUNT_JSON o al inicializar Firebase Admin:', error);
    throw new Error('Error de configuración de Firebase Admin.');
  }
};

try {
    initializeAdminApp();
    adminDb = admin.firestore();
} catch (error) {
    console.error("No se pudo inicializar Firestore Admin:", error);
    // Asignar un objeto mock o lanzar un error más específico si es necesario para que el resto de la app no falle al importar.
    // En este caso, si la inicialización falla, las llamadas a la DB fallarán, lo cual es esperado.
}

// Exporta la instancia de la base de datos de admin ya inicializada
export { admin, adminDb };
