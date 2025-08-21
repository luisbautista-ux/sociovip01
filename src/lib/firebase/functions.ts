// src/lib/firebase/functions.ts
'use server';

import * as admin from 'firebase-admin';
import { config } from 'dotenv';
import type { AdminDashboardStats } from '../types';

// Cargar las variables de entorno desde el archivo .env
config();

// Función para inicializar Firebase Admin SDK de forma segura
// Esta función ahora garantiza que no se creen múltiples instancias
function initializeAdminApp() {
  if (admin.apps.length > 0) {
    // Si ya hay una instancia, la devuelve
    return admin.app();
  }
  
  // Reemplaza los caracteres de escape `\\n` por saltos de línea reales en la clave privada
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error('Las credenciales del Firebase Admin SDK no están configuradas en las variables de entorno. Asegúrate de que .env esté completo.');
  }

  try {
    // Crea y devuelve la nueva instancia de la aplicación de administrador
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
 * Cloud Function (ejecutada en el servidor) para obtener las estadísticas del dashboard de admin.
 * Esta función se ejecuta con privilegios de administrador, por lo que no está sujeta a las reglas de seguridad de Firestore.
 * @returns {Promise<AdminDashboardStats>} Las estadísticas consolidadas.
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  console.log('Cloud Function: getAdminDashboardStats invoked.');
  try {
    // Aseguramos la inicialización del SDK de Admin aquí
    const adminApp = initializeAdminApp();
    const adminDb = admin.firestore(adminApp);
    
    // Todas estas consultas ahora se ejecutan con permisos de administrador
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
