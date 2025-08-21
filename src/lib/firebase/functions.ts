// src/lib/firebase/functions.ts
'use server';

import { adminDb } from './firebaseAdmin';
import type { AdminDashboardStats } from '../types';

/**
 * Cloud Function (ejecutada en el servidor) para obtener las estadísticas del dashboard de admin.
 * Esta función se ejecuta con privilegios de administrador, por lo que no está sujeta a las reglas de seguridad de Firestore.
 * @returns {Promise<AdminDashboardStats>} Las estadísticas consolidadas.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  console.log('Cloud Function: getAdminDashboardStats invoked.');
  try {
    const businessesSnap = await adminDb.collection('businesses').count().get();
    const platformUsersSnap = await adminDb.collection('platformUsers').count().get();
    const socioVipMembersSnap = await adminDb.collection('socioVipMembers').count().get();
    const businessEntitiesSnap = await adminDb.collection('businessEntities').get();

    const totalCodes = businessEntitiesSnap.docs.reduce((acc, doc) => {
      const codes = doc.data().generatedCodes;
      return acc + (Array.isArray(codes) ? codes.length : 0);
    }, 0);

    const stats: AdminDashboardStats = {
      totalBusinesses: businessesSnap.data().count,
      totalPlatformUsers: platformUsersSnap.data().count,
      totalSocioVipMembers: socioVipMembersSnap.data().count,
      totalQrCodesGenerated: totalCodes,
    };

    console.log('Cloud Function: Stats calculated successfully:', stats);
    return stats;
  } catch (error) {
    console.error('Cloud Function: Error in getAdminDashboardStats:', error);
    // En caso de error, devolver un objeto de estadísticas vacío para no romper el frontend.
    return {
      totalBusinesses: 0,
      totalPlatformUsers: 0,
      totalSocioVipMembers: 0,
      totalQrCodesGenerated: 0,
    };
  }
}
