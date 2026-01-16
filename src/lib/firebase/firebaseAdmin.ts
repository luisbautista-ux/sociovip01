// src/lib/firebase/firebaseAdmin.ts
import admin from 'firebase-admin';

// Cuando se despliega en un entorno de Google Cloud (como Firebase App Hosting),
// initializeApp() usa automáticamente las Credenciales Predeterminadas de la Aplicación (ADC).
// Esto elimina la necesidad de incluir el archivo `serviceAccountKey.json` en el despliegue.
// Para el desarrollo local, asegúrate de que tus ADC estén configuradas
// ejecutando `gcloud auth application-default login` en tu terminal.

// Evitar reinicialización en entornos de desarrollo con hot-reloading
if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (error: any) {
    console.error('Error al inicializar Firebase Admin:', error);
    // Este error suele ocurrir si las credenciales no están configuradas en el entorno.
    // Como fallback para entornos locales no configurados, intentamos con el service account key.
    try {
        console.log("Inicialización automática falló, intentando fallback con clave de servicio para desarrollo local...");
        const serviceAccount = require('./serviceAccountKey.json');
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
    } catch(fallbackError: any) {
         console.error('Error en el fallback de inicialización con clave de servicio:', fallbackError);
         // Lanzamos el error original que es más descriptivo para el entorno de la nube
         throw new Error(`Error de configuración de Firebase Admin: ${error.message}. Asegúrate de que las credenciales de la aplicación estén configuradas.`);
    }
  }
}

// Exportar la instancia de la base de datos de admin ya inicializada y el objeto admin.
export const adminDb = admin.firestore();
export { admin };
