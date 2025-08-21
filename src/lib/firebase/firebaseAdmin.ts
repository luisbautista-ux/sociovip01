// src/lib/firebase/firebaseAdmin.ts
import * as admin from 'firebase-admin';

// Asegúrate de que el SDK de Firebase Admin no se inicialice más de una vez.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Reemplaza los caracteres de escape `\n` en la clave privada por saltos de línea reales.
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.stack);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
