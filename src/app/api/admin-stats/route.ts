
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';

// Helper function to initialize Firebase Admin SDK
// This ensures we don't try to initialize it multiple times
function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    console.error('API Route (admin-stats): La variable de entorno FIREBASE_SERVICE_ACCOUNT_JSON no está configurada.');
    throw new Error('Las credenciales del Firebase Admin SDK no están configuradas.');
  }

  try {
    const serviceAccount: ServiceAccount = JSON.parse(serviceAccountJson);
    
    // Check if the parsed object has the required keys
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("El JSON de la cuenta de servicio es inválido o no tiene los campos requeridos (project_id, client_email, private_key).");
    }

    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error: any) {
    console.error('API Route (admin-stats): Error inicializando Firebase Admin SDK desde JSON:', error.message);
    // Throw a more specific error to help with debugging
    throw new Error(`No se pudo inicializar el Firebase Admin SDK: ${error.message}`);
  }
}

export async function GET(request: Request) {
  try {
    const adminApp = initializeAdminApp();
    const adminDb = admin.firestore(adminApp);
    
    // Fetch all counts in parallel
    const [
      businessesSnap, 
      platformUsersSnap, 
      socioVipMembersSnap, 
      businessEntitiesSnap
    ] = await Promise.all([
      adminDb.collection('businesses').count().get(),
      adminDb.collection('platformUsers').count().get(),
      adminDb.collection('socioVipMembers').count().get(),
      adminDb.collection('businessEntities').get() // Get all docs to sum nested codes
    ]);

    // Calculate total codes from all entities
    let totalCodes = 0;
    businessEntitiesSnap.forEach(doc => {
      const data = doc.data();
      if (data.generatedCodes && Array.isArray(data.generatedCodes)) {
        totalCodes += data.generatedCodes.length;
      }
    });
    
    const stats: AdminDashboardStats = {
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
