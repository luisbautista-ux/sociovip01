
// src/lib/firebase/firebaseAdmin.ts
import admin from 'firebase-admin';

// ✅ Se lee la clave de servicio desde la variable de entorno.
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

let adminDb: admin.firestore.Firestore;

const initializeAdminApp = () => {
  // Evitar reinicialización
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }
  
  // Validar que la variable de entorno exista.
  if (!serviceAccountString) {
    throw new Error("La variable de entorno FIREBASE_SERVICE_ACCOUNT_JSON no está definida.");
  }
  
  try {
    // Parsear el string JSON a un objeto.
    const serviceAccount = JSON.parse(serviceAccountString);
    
    // Inicializar la app de admin con las credenciales.
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Error al parsear FIREBASE_SERVICE_ACCOUNT_JSON o al inicializar Firebase Admin:', error);
    throw new Error('Error de configuración de Firebase Admin. Revisa la variable de entorno.');
  }
};

// Se inicializa la app una sola vez al cargar el módulo.
try {
    initializeAdminApp();
    adminDb = admin.firestore();
} catch (error) {
    console.error("No se pudo inicializar Firestore Admin:", error);
    // En caso de error, adminDb no será funcional, lo que es esperado.
}

// Exporta la instancia de la base de datos de admin ya inicializada
export { admin, adminDb };
