// src/lib/firebase/firebaseAdmin.ts
import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json';

const serviceAccountCredentials = {
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
};

// Evitar reinicialización en desarrollo
if (!admin.apps.length) {
    admin.initializeApp(serviceAccountCredentials);
}

export const adminDb = admin.firestore();
export { admin };
