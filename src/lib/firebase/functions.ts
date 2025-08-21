// src/lib/firebase/functions.ts
'use server';

import * as admin from 'firebase-admin';
import { config } from 'dotenv';
import type { AdminDashboardStats } from '../types';

// Cargar las variables de entorno desde el archivo .env
config();

// Función para inicializar Firebase Admin SDK de forma segura
function initializeAdminApp() {
  if (admin.apps.length > 0) {
    return admin.app();
  }
  
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error('Firebase Admin SDK credentials are not set in environment variables.');
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
    console.error('Firebase Admin SDK initialization error inside function:', error.stack);
    throw new Error('Could not initialize Firebase Admin SDK.');
  }
}

/**
 * Cloud Function (ejecutada en el servidor) para obtener las estadísticas del dashboard de admin.
 * Esta función se ejecuta con privilegios de administrador, por lo que no está sujeta a las reglas de seguridad de Firestore.
 * @returns {Promise<AdminDashboardStats>} Las estadísticas consolidadas.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  console.log('Cloud Function: getAdminDashboardStats invoked.');
  try {
    const adminApp = initializeAdminApp();
    const adminDb = admin.firestore(adminApp);
    
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
