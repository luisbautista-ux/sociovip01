
import { NextResponse } from 'next/server';
import { initializeAdminApp, admin } from '@/lib/firebase/firebaseAdmin';

export async function GET(request: Request) {
  try {
    // Inicializa la app de admin
    await initializeAdminApp();
    // Obtiene la instancia de Firestore desde el SDK de admin
    const adminDb = admin.firestore();
    
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
