
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';

// Helper function to initialize Firebase Admin SDK
function initializeAdminApp() {
  // Check if the default app is already initialized
  if (admin.apps.length > 0) {
    console.log("Admin SDK already initialized. Using existing app.");
    return admin.app();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson || serviceAccountJson.startsWith('TU_JSON_DE')) {
    const errorMessage = 'El JSON de la cuenta de servicio de Firebase no ha sido configurado en el archivo .env.';
    console.error(`API Route (admin-stats): ${errorMessage}`);
    throw new Error(errorMessage);
  }

  try {
    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson);

    // Initialize the app if it hasn't been initialized yet
    console.log("Admin SDK not initialized. Initializing now.");
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
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
