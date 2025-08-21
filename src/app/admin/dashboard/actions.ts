
'use server';

import * as admin from 'firebase-admin';
import type { AdminDashboardStats } from '@/lib/types';
import dotenv from 'dotenv';

dotenv.config();

// Función para inicializar Firebase Admin SDK de forma segura
function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    console.error('Firebase Admin SDK credenciales no configuradas. Verifica tu archivo .env');
    throw new Error('Las credenciales del Firebase Admin SDK no están configuradas en las variables de entorno.');
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  } catch (error: any) {
    console.error('Error en la inicialización del Firebase Admin SDK:', error.stack);
    throw new Error('No se pudo inicializar el Firebase Admin SDK.');
  }
}

/**
 * Server Action para obtener las estadísticas del dashboard de admin.
 * Esta función se ejecuta con privilegios de administrador.
 * @returns {Promise<AdminDashboardStats>} Las estadísticas consolidadas.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  try {
    const adminApp = initializeAdminApp();
    const adminDb = admin.firestore(adminApp);
    
    const businessesSnap = await adminDb.collection('businesses').count().get();
    const platformUsersSnap = await adminDb.collection('platformUsers').count().get();
    const socioVipMembersSnap = await adminDb.collection('socioVipMembers').count().get();
    
    // El conteo de códigos generados se ha omitido temporalmente para evitar errores de permisos en lecturas de colección amplias.
    // La solución ideal es un contador dedicado en el backend.
    const totalCodes = 0; 
    
    const stats: AdminDashboardStats = {
      totalBusinesses: businessesSnap.data().count,
      totalPlatformUsers: platformUsersSnap.data().count,
      totalSocioVipMembers: socioVipMembersSnap.data().count,
      totalQrCodesGenerated: totalCodes,
    };

    return stats;

  } catch (error) {
    console.error('Server Action: Error in getAdminDashboardStats:', error);
    // Relanzar el error para que el componente cliente pueda manejarlo
    throw error;
  }
}
