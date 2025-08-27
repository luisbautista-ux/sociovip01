
import { NextResponse } from 'next/server';
import { initializeAdminApp } from '@/lib/firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  let adminAuth;
  let adminDb;
  
  try {
    const adminApp = await initializeAdminApp();
    adminAuth = admin.auth(adminApp);
    adminDb = admin.firestore(adminApp);
  } catch (error: any) {
    console.error('API Route (create-user): Firebase Admin initialization failed.', error);
    return NextResponse.json(
      { error: `Error de inicialización del servidor: ${error.message}` },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { email, password, displayName, firestoreData } = body;

    if (!email || !password || !displayName || !firestoreData) {
      return NextResponse.json({ error: 'Faltan datos requeridos (email, password, displayName, firestoreData).' }, { status: 400 });
    }
    
    // 1. Create user in Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: true, // Mark as verified since it's created by an admin
    });

    // 2. Create user profile in Firestore
    const userProfilePayload = {
      ...firestoreData,
      uid: userRecord.uid,
      lastLogin: Timestamp.now(), // Use server timestamp
    };
    
    await adminDb.collection('platformUsers').doc(userRecord.uid).set(userProfilePayload);

    return NextResponse.json({
      uid: userRecord.uid,
      message: 'Usuario creado exitosamente en Auth y Firestore.'
    });

  } catch (error: any) {
    console.error('API Route (create-user): Error creating user:', error);

    let errorMessage = 'Ocurrió un error interno al crear el usuario.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'El correo electrónico ya está en uso por otro usuario.';
    } else if (error.code === 'auth/invalid-password') {
      errorMessage = `La contraseña proporcionada no es válida. ${error.message}`;
    }

    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: 500 }
    );
  }
}
