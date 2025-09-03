
import { NextResponse } from 'next/server';
import { initializeAdminApp, admin } from '@/lib/firebase/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { PlatformUser, PlatformUserRole } from '@/lib/types';
import { getAuth } from 'firebase-admin/auth';
import { headers } from 'next/headers';

const CreateStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2),
  firestoreData: z.object({
    dni: z.string(),
    name: z.string(),
    email: z.string().email(),
    roles: z.array(z.string()),
  }),
});

async function getCallerProfile(authorizationHeader: string) {
    if (!authorizationHeader.startsWith('Bearer ')) {
        throw new Error('Invalid authorization header format.');
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
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
    console.error('API Route (create-staff): Firebase Admin initialization failed.', error);
    return NextResponse.json(
      { error: `Error de inicialización del servidor: ${error.message}` },
      { status: 500 }
    );
  }

  try {
    const authorization = headers().get('Authorization');
    if (!authorization) {
        return NextResponse.json({ error: 'No autenticado. Token no proporcionado.' }, { status: 401 });
    }
    
    const callerProfile = await getCallerProfile(authorization);
    const isBusinessAdminOrStaff = callerProfile.roles.includes('business_admin') || callerProfile.roles.includes('staff');
    
    if (!isBusinessAdminOrStaff || !callerProfile.businessId) {
        return NextResponse.json({ error: 'Permiso denegado. No eres admin/staff de un negocio o no tienes un negocio asociado.' }, { status: 403 });
    }

    const body = await request.json();
    const validation = CreateStaffSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Datos inválidos.', details: validation.error.flatten() }, { status: 400 });
    }
    
    const { email, password, displayName, firestoreData } = validation.data;
    
    const allowedRoles: PlatformUserRole[] = ['staff', 'host'];
    const finalRoles = firestoreData.roles.filter(role => allowedRoles.includes(role as PlatformUserRole)) as PlatformUserRole[];
    
    if (finalRoles.length === 0) {
        return NextResponse.json({ error: 'Rol no permitido. Un admin de negocio solo puede crear Staff o Anfitriones.' }, { status: 403 });
    }
    
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
    
    const userProfilePayload: Omit<PlatformUser, 'id' | 'businessIds'> = {
      uid: userRecord.uid,
      dni: firestoreData.dni,
      name: firestoreData.name,
      email: firestoreData.email,
      roles: finalRoles,
      businessId: callerProfile.businessId,
      lastLogin: FieldValue.serverTimestamp() as any,
    };
    
    await adminDb.collection('platformUsers').doc(userRecord.uid).set(userProfilePayload);

    return NextResponse.json({
      uid: userRecord.uid,
      message: 'Personal creado exitosamente en Auth y Firestore.'
    });

  } catch (error: any) {
    console.error('API Route (create-staff): Error creating staff:', error);

    let errorMessage = 'Ocurrió un error interno al crear el personal.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'El correo electrónico ya está en uso por otro usuario.';
    } else if (error.code === 'auth/invalid-password') {
      errorMessage = `La contraseña proporcionada no es válida. ${error.message}`;
    } else if (error.message.includes('Caller profile not found') || error.message.includes('Invalid authorization header')) {
        errorMessage = 'No se pudo verificar tu identidad para realizar esta acción.'
    }

    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: 500 }
    );
  }
}
