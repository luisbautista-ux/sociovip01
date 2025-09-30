
'use server';

import { NextResponse } from 'next/server';
import { admin, initializeAdminApp } from '@/lib/firebase/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import type { PlatformUser } from '@/lib/types';
import { z } from 'zod';

const GetClientNameSchema = z.object({
    dni: z.string().min(7).max(20),
    docType: z.enum(['dni', 'ce']),
});

async function getCallerProfile(authorizationHeader: string): Promise<PlatformUser> {
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new Error('No se proporcionó un token de autorización válido.');
    }
    const idToken = authorizationHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const adminDb = admin.firestore();
    const userDoc = await adminDb.collection('platformUsers').doc(uid).get();
    if (!userDoc.exists) {
      throw new Error('Perfil del solicitante no encontrado.');
    }
    return userDoc.data() as PlatformUser;
}

export async function GET(request: Request) {
  try {
    await initializeAdminApp();
    const adminDb = admin.firestore();

    const { searchParams } = new URL(request.url);
    const dni = searchParams.get('dni');
    const docType = searchParams.get('docType');
    
    const validation = GetClientNameSchema.safeParse({ dni, docType });
    if (!validation.success) {
      return NextResponse.json({ error: 'DNI/CE inválido o no proporcionado.' }, { status: 400 });
    }
    const validatedDni = validation.data.dni;

    const authorization = request.headers.get('Authorization');
    if (!authorization) {
        return NextResponse.json({ error: 'No autenticado. Token no proporcionado.' }, { status: 401 });
    }

    // Authenticate the caller (promoter)
    await getCallerProfile(authorization);

    // --- Search in internal DB ---
    // 1. qrClients
    const qrClientQuery = adminDb.collection('qrClients').where('dni', '==', validatedDni).limit(1);
    const qrClientSnap = await qrClientQuery.get();
    if (!qrClientSnap.empty) {
        const client = qrClientSnap.docs[0].data();
        return NextResponse.json({ name: `${client.name} ${client.surname}`.trim() });
    }

    // 2. socioVipMembers
    const socioVipQuery = adminDb.collection('socioVipMembers').where('dni', '==', validatedDni).limit(1);
    const socioVipSnap = await socioVipQuery.get();
    if (!socioVipSnap.empty) {
        const socio = socioVipSnap.docs[0].data();
        return NextResponse.json({ name: `${socio.name} ${socio.surname}`.trim() });
    }

    // 3. If it's a DNI and not found internally, consult external API
    if (validation.data.docType === 'dni') {
      try {
        const externalApiResponse = await fetch(`${new URL(request.url).origin}/api/admin/consult-dni`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dni: validatedDni }),
        });
        if (externalApiResponse.ok) {
            const externalData = await externalApiResponse.json();
            if (externalData.nombreCompleto) {
                return NextResponse.json({ name: externalData.nombreCompleto });
            }
        }
      } catch (e) {
          console.warn("External DNI API call failed in get-client-name:", e);
      }
    }

    return NextResponse.json({ name: null });

  } catch (error: any) {
    console.error("API Route (get-client-name): Error:", error);
    let status = 500;
    let errorMessage = error.message || 'Error interno del servidor.';

    if (errorMessage.includes('No se proporcionó un token') || errorMessage.includes('Perfil del solicitante no encontrado')) {
        status = 403; // Forbidden
    } else if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        status = 401; // Unauthorized
        errorMessage = 'Token de sesión inválido o expirado.';
    }
    
    return NextResponse.json({ error: errorMessage }, { status });
  }
}
