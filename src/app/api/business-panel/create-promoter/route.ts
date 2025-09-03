'use server';

import {NextResponse} from 'next/server';
import {headers} from 'next/headers';
import {z} from 'zod';

import {admin, initializeAdminApp} from '@/lib/firebase/firebaseAdmin';
import type {PlatformUser} from '@/lib/types';
import {FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';

const CreatePromoterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2),
  firestoreData: z.object({
    dni: z.string(),
    name: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    commissionRate: z.string().optional(),
  }),
});

async function getCallerProfile(
  authorizationHeader: string
): Promise<PlatformUser> {
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
    await initializeAdminApp();
    adminAuth = admin.auth();
    adminDb = admin.firestore();
  } catch (error: any) {
    console.error(
      'API Route (create-promoter): Firebase Admin initialization failed.',
      error
    );
    return NextResponse.json(
      {error: `Error de inicialización del servidor: ${error.message}`},
      {status: 500}
    );
  }

  try {
    const authorization = headers().get('Authorization');
    if (!authorization) {
      return NextResponse.json(
        {error: 'No autenticado. Token no proporcionado.'},
        {status: 401}
      );
    }

    const callerProfile = await getCallerProfile(authorization);
    const isBusinessAdminOrStaff =
      callerProfile.roles.includes('business_admin') ||
      callerProfile.roles.includes('staff');

    if (!isBusinessAdminOrStaff || !callerProfile.businessId) {
      return NextResponse.json(
        {
          error:
            'Permiso denegado. No eres admin/staff de un negocio o no tienes un negocio asociado.',
        },
        {status: 403}
      );
    }

    const body = await request.json();
    const validation = CreatePromoterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {error: 'Datos inválidos.', details: validation.error.flatten()},
        {status: 400}
      );
    }

    const {email, password, displayName, firestoreData} = validation.data;

    try {
      await adminAuth.getUserByEmail(email);
      return NextResponse.json(
        {error: 'El correo electrónico ya está registrado en la plataforma.'},
        {status: 409}
      );
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    const batch = adminDb.batch();

    // 1. Create Firebase Auth user
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: true,
    });

    // 2. Create platformUsers document
    const userProfilePayload: Omit<PlatformUser, 'id'> = {
      uid: userRecord.uid,
      dni: firestoreData.dni,
      name: firestoreData.name,
      email: firestoreData.email,
      phone: firestoreData.phone || '',
      roles: ['promoter'],
      businessIds: [callerProfile.businessId],
      lastLogin: FieldValue.serverTimestamp() as any,
    };
    const userDocRef = adminDb.collection('platformUsers').doc(userRecord.uid);
    batch.set(userDocRef, userProfilePayload);

    // 3. Create businessPromoterLinks document
    const linkPayload = {
      businessId: callerProfile.businessId,
      promoterDni: firestoreData.dni,
      promoterName: firestoreData.name,
      promoterEmail: firestoreData.email,
      promoterPhone: firestoreData.phone || '',
      commissionRate: firestoreData.commissionRate || '',
      isActive: true,
      isPlatformUser: true,
      platformUserUid: userRecord.uid,
      joinDate: FieldValue.serverTimestamp(),
    };
    const linkDocRef = adminDb.collection('businessPromoterLinks').doc();
    batch.set(linkDocRef, linkPayload);

    // Commit the batch
    await batch.commit();

    return NextResponse.json({
      uid: userRecord.uid,
      message: 'Promotor creado y vinculado exitosamente.',
    });
  } catch (error: any) {
    console.error('API Route (create-promoter): Error creating promoter:', error);

    let errorMessage = 'Ocurrió un error interno al crear el promotor.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'El correo electrónico ya está en uso por otro usuario.';
    } else if (error.code === 'auth/invalid-password') {
      errorMessage = `La contraseña proporcionada no es válida. ${error.message}`;
    } else if (
      error.message.includes('Caller profile not found') ||
      error.message.includes('Invalid authorization header')
    ) {
      errorMessage =
        'No se pudo verificar tu identidad para realizar esta acción.';
    }

    return NextResponse.json(
      {error: errorMessage, details: error.message},
      {status: 500}
    );
  }
}
