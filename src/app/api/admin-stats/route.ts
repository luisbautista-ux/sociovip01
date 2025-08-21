
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';

// Helper function to initialize Firebase Admin SDK
function initializeAdminApp() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    console.error('API Route (admin-stats): FIREBASE_SERVICE_ACCOUNT_JSON no está configurada.');
    throw new Error('Las credenciales del Firebase Admin SDK no están configuradas.');
  }

  // Check if the placeholder value is still being used
  if (serviceAccountJson.startsWith('TU_JSON_DE')) {
    console.error('API Route (admin-stats): FIREBASE_SERVICE_ACCOUNT_JSON contiene el valor de ejemplo.');
    throw new Error('El JSON de la cuenta de servicio de Firebase no ha sido configurado en el archivo .env. Por favor, reemplaza el valor de ejemplo.');
  }

  try {
    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson);
    
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("El JSON de la cuenta de servicio es inválido o no tiene los campos requeridos (project_id, client_email, private_key).");
    }

    // Initialize a new app instance every time to avoid conflicts in serverless environments.
    // Use a unique name to prevent "already exists" error if the environment is reused.
    const appName = `admin-stats-app-${Date.now()}`;
    
    // If there is an app with that name already, get it. Otherwise, initialize it.
    const app = admin.apps.find(a => a?.name === appName) || admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    }, appName);

    return app;

  } catch (error: any) {
    console.error('API Route (admin-stats): Error inicializando Firebase Admin SDK desde JSON:', error.message);
    throw new Error(`No se pudo inicializar el Firebase Admin SDK: ${error.message}`);
  }
}

export async function GET(request: Request) {
  try {
    const adminApp = initializeAdminApp();
    const adminDb = admin.firestore(adminApp);
    
    const [
      businessesSnap, 
      platformUsersSnap, 
      socioVipMembersSnap, 
      businessEntitiesSnap
    ] = await Promise.all([
      adminDb.collection('businesses').count().get(),
      adminDb.collection('platformUsers').count().get(),
      adminDb.collection('socioVipMembers').count().get(),
      adminDb.collection('businessEntities').get() 
    ]);

    let totalCodes = 0;
    businessEntitiesSnap.forEach(doc => {
      const data = doc.data();
      if (data.generatedCodes && Array.isArray(data.generatedCodes)) {
        totalCodes += data.generatedCodes.length;
      }
    });
    
    const stats = {
      totalBusinesses: businessesSnap.data().count,
      totalPlatformUsers: platformUsersSnap.data().count,
      totalSocioVipMembers: socioVipMembersSnap.data().count,
      totalQrCodesGenerated: totalCodes,
    };

    return NextResponse.json(stats);

  } catch (error: any) {
    console.error('API Route (admin-stats): Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor al obtener estadísticas.' },
      { status: 500 }
    );
  }
}
