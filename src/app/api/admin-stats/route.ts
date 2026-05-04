
import { NextResponse } from 'next/server';
import { admin, adminDb } from '@/lib/firebase/firebaseAdmin';

export async function GET(request: Request) {
  try {
    // La inicialización ahora se maneja de forma centralizada.
    // adminDb ya está disponible para su uso.
    
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

    let totalCodesRedeemed = 0;
    businessEntitiesSnap.forEach(doc => {
      const data = doc.data();
      if (data.generatedCodes && Array.isArray(data.generatedCodes)) {
        totalCodesRedeemed += data.generatedCodes.filter(c => c.status === 'redeemed' || c.status === 'used').length;
      }
    });
    
    const stats = {
      totalBusinesses: businessesSnap.data().count,
      totalPlatformUsers: platformUsersSnap.data().count,
      totalSocioVipMembers: socioVipMembersSnap.data().count,
      totalQrCodesGenerated: totalCodesRedeemed,
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
