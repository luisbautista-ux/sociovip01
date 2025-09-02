
import { NextResponse } from 'next/server';
import { initializeAdminApp, admin } from '@/lib/firebase/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { PlatformUser, PlatformUserRole } from '@/lib/types';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2),
  firestoreData: z.object({
    dni: z.string(),
    name: z.string(),
    email: z.string().email(),
    roles: z.array(z.string()),
    businessId: z.string().nullable().optional(),
    businessIds: z.array(z.string()).nullable().optional(),
  }),
});

// Helper function to verify the token and get user profile
async function getCallerProfile(idToken: string) {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const adminDb = admin.firestore();
    const userDoc = await adminDb.collection('platformUsers').doc(uid).get();
    if (!userDoc.exists) {
        throw new Error('Caller profile not found.');
    }
    return userDoc.data() as PlatformUser;
}

export async function POST(request: Request) {
  let adminAuth;
  let adminDb;
  
  try {
    const adminApp = await initializeAdminApp();
    adminAuth = admin.auth();
    adminDb = admin.firestore();
  } catch (error: any) {
    console.error('API Route (create-user): Firebase Admin initialization failed.', error);
    return NextResponse.json(
      { error: `Error de inicialización del servidor: ${error.message}` },
      { status: 500 }
    );
  }

  try {
    const idToken = cookies().get('idToken')?.value;
    if (!idToken) {
        return NextResponse.json({ error: 'No autenticado. Token no proporcionado.' }, { status: 401 });
    }
    
    const callerProfile = await getCallerProfile(idToken);
    const callerIsSuperAdmin = callerProfile.roles.includes('superadmin');

    if (!callerIsSuperAdmin) {
        return NextResponse.json({ error: 'Permiso denegado. Solo un Super Administrador puede crear usuarios aquí.' }, { status: 403 });
    }
    
    const body = await request.json();
    const validation = CreateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Datos inválidos.', details: validation.error.flatten() }, { status: 400 });
    }
    
    const { email, password, displayName, firestoreData } = validation.data;
    
    try {
      await adminAuth.getUserByEmail(email);
      return NextResponse.json({ error: 'El correo electrónico ya está registrado en Firebase Authentication.' }, { status: 409 });
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }
    
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: true, 
    });
    
    const userProfilePayload: Omit<PlatformUser, 'id'> = {
      uid: userRecord.uid,
      dni: firestoreData.dni,
      name: firestoreData.name,
      email: firestoreData.email,
      roles: firestoreData.roles as PlatformUserRole[],
      businessId: firestoreData.businessId,
      businessIds: firestoreData.businessIds || [],
      lastLogin: FieldValue.serverTimestamp() as any, // Use admin SDK FieldValue
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
    } else if (error.message === 'Caller profile not found.') {
        errorMessage = 'No se encontró el perfil del usuario que realiza la solicitud.'
    }

    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: 500 }
    );
  }
}
