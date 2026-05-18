// src/lib/firebase/firebaseAdmin.ts
import admin from 'firebase-admin';

if (!admin.apps.length) {
    // Si estamos en tu computadora local (modo desarrollo)
    if (process.env.NODE_ENV === 'development') {
        // Usamos require en vez de import para que la nube no se bloquee buscándolo
        const serviceAccount = require('./serviceAccountKey.json');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } 
    // Si estamos en la nube (producción)
    else {
        admin.initializeApp(); // Usa la auto-autenticación de Firebase
    }
}

export const adminDb = admin.firestore();
export { admin };
