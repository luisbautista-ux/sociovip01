
'use server';

import { NextResponse } from 'next/server';
import { admin, initializeAdminApp } from '@/lib/firebase/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import type { PlatformUser } from '@/lib/types';

// Helper to get caller profile and ensure they are authenticated
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

    if (!dni || dni.length < 7) {
      return NextResponse.json({ error: 'DNI/CE inválido o no proporcionado.' }, { status: 400 });
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization) {
        return NextResponse.json({ error: 'No autenticado. Token no proporcionado.' }, { status: 401 });
    }

    // Authenticate the caller (e.g., promoter)
    await getCallerProfile(authorization);

    // --- Search in internal DB ---
    // 1. qrClients
    const qrClientQuery = adminDb.collection('qrClients').where('dni', '==', dni).limit(1);
    const qrClientSnap = await qrClientQuery.get();
    if (!qrClientSnap.empty) {
        const client = qrClientSnap.docs[0].data();
        return NextResponse.json({ name: `${client.name} ${client.surname}`.trim(), source: 'qrClient' });
    }

    // 2. socioVipMembers
    const socioVipQuery = adminDb.collection('socioVipMembers').where('dni', '==', dni).limit(1);
    const socioVipSnap = await socioVipQuery.get();
    if (!socioVipSnap.empty) {
        const socio = socioVipSnap.docs[0].data();
        return NextResponse.json({ name: `${socio.name} ${socio.surname}`.trim(), source: 'socioVip' });
    }
    
    // --- Fallback to external API ---
    if (dni.length === 8) { // Only call external for DNI
        try {
            const apiBaseUrl = new URL(request.url).origin;
            const apiResponse = await fetch(`${apiBaseUrl}/api/admin/consult-dni`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dni }),
            });

            if (apiResponse.ok) {
                const data = await apiResponse.json();
                if (data.nombreCompleto) {
                     return NextResponse.json({ name: data.nombreCompleto.trim(), source: 'external' });
                }
            }
        } catch (apiError) {
            console.warn(`API Route (get-client-by-dni): External DNI consultation failed for DNI ${dni}.`, apiError);
        }
    }

    // If no client is found anywhere, return a specific response.
    return NextResponse.json({ name: null, message: "No se encontró cliente con ese DNI." }, { status: 200 });

  } catch (error: any) {
    console.error("API Route (get-client-by-dni): Error:", error);
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
