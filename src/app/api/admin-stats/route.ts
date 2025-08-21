
import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import type { ServiceAccount } from 'firebase-admin';
import type { AdminDashboardStats } from '@/lib/types';

// Helper function to initialize Firebase Admin SDK
// This ensures we don't try to initialize it multiple times
function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Ensure all required environment variables are present
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    console.error('API Route (admin-stats): Firebase Admin SDK credentials are not fully configured in environment variables.');
    throw new Error('Las credenciales del Firebase Admin SDK no están configuradas en las variables de entorno.');
  }

  const serviceAccount: ServiceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // Replace literal "\\n" with actual newline characters
    privateKey: privateKey.replace(/\\n/g, '\n'),
  };

  try {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error: any) {
    console.error('API Route (admin-stats): Error initializing Firebase Admin SDK:', error.message);
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
