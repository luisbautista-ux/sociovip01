
// src/app/api/user/update-last-login/route.ts
import { NextResponse } from 'next/server';
import { admin, adminDb } from '@/lib/firebase/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { headers } from 'next/headers';

async function getUidFromToken(authorizationHeader: string): Promise<string> {
  if (!authorizationHeader.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header format.');
  }
  const idToken = authorizationHeader.split('Bearer ')[1];
  const decodedToken = await getAuth().verifyIdToken(idToken);
  return decodedToken.uid;
}

export async function POST(request: Request) {
  try {
    const authorization = headers().get('Authorization');

    if (!authorization) {
      return NextResponse.json({ error: 'Token de autenticación no proporcionado.' }, { status: 401 });
    }

    const uid = await getUidFromToken(authorization);
    
    if (!uid) {
       return NextResponse.json({ error: 'UID de usuario no válido.' }, { status: 400 });
    }

    const userDocRef = adminDb.collection('platformUsers').doc(uid);
    
    await userDocRef.update({
      lastLogin: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, message: `lastLogin actualizado para el usuario ${uid}.` });

  } catch (error: any) {
    console.error('API Route (update-last-login): Error:', error);
    
    let errorMessage = 'Ocurrió un error interno al actualizar la hora de acceso.';
    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'El token de sesión ha expirado. Por favor, inicia sesión de nuevo.';
    } else if (error.code === 'auth/argument-error' || error.message.includes('Invalid authorization header')) {
       errorMessage = 'Token de sesión inválido.';
    }

    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: 500 }
    );
  }
}
