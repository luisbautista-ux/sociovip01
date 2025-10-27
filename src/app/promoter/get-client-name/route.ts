
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

async function consultExternalDniApi(dni: string): Promise<{ nombreCompleto: string; fechaNacimiento: string | null }> {
    let result = {
        nombreCompleto: "",
        nombres: null as string | null,
        apellidoPaterno: null as string | null,
        apellidoMaterno: null as string | null,
        fechaNacimiento: null as string | null,
    };

    try {
        // --- 1. Fetch names ---
        const endpointNombres = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formNombres = new URLSearchParams();
        formNombres.append('dni4', dni);
        formNombres.append('action', 'buscar_nombres');
        formNombres.append('security', 'b8d55f5c4f');

        const responseNombres = await fetch(endpointNombres, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://dniperu.com/buscar-dni-nombres-apellidos/' },
            body: formNombres.toString(),
        });
        
        if (responseNombres.ok) {
            const dataNombres = await responseNombres.json();
            if (dataNombres.success && dataNombres.data?.message) {
                const lines = dataNombres.data.message.split('\n');
                lines.forEach((line: string) => {
                    if (line.startsWith("Nombres:")) result.nombres = line.replace("Nombres:", "").trim();
                    else if (line.startsWith("Apellido Paterno:")) result.apellidoPaterno = line.replace("Apellido Paterno:", "").trim();
                    else if (line.startsWith("Apellido Materno:")) result.apellidoMaterno = line.replace("Apellido Materno:", "").trim();
                });
            }
        }

        // --- 2. Fetch birth date ---
        const endpointFecha = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formFecha = new URLSearchParams();
        formFecha.append('dni', dni); // param is 'dni' not 'dni4'
        formFecha.append('action', 'buscar_fecha');
        formFecha.append('security', '94c643fd81'); // The new security token

        const responseFecha = await fetch(endpointFecha, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://dniperu.com/consultar-dni/' }, // Different referer
            body: formFecha.toString(),
        });

        if (responseFecha.ok) {
            const dataFecha = await responseFecha.json();
            if (dataFecha.success && dataFecha.data?.message) {
                const lines = dataFecha.data.message.split('\n');
                lines.forEach((line: string) => {
                    if (line.startsWith("Fecha de Nacimiento:")) {
                        result.fechaNacimiento = line.replace("Fecha de Nacimiento:", "").trim();
                    }
                });
            }
        }

        result.nombreCompleto = `${result.nombres || ''} ${result.apellidoPaterno || ''} ${result.apellidoMaterno || ''}`.trim().replace(/\s+/g, ' ');

    } catch (e) {
        console.error("Error fetching from external DNI API in get-client-name:", e);
    }
    
    return { nombreCompleto: result.nombreCompleto, fechaNacimiento: result.fechaNacimiento };
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
      return NextResponse.json({ error: 'DNI/CE inválido o no proporcionado.', details: validation.error.flatten() }, { status: 400 });
    }
    const validatedDni = validation.data.dni;

    const authorization = request.headers.get('Authorization');
    if (!authorization) {
        return NextResponse.json({ error: 'No autenticado. Token no proporcionado.' }, { status: 401 });
    }

    await getCallerProfile(authorization);

    // --- 1. Search in internal DB ---
    const collectionsToSearch = ['qrClients', 'socioVipMembers'];
    for (const collectionName of collectionsToSearch) {
        const querySnapshot = await adminDb.collection(collectionName).where('dni', '==', validatedDni).limit(1).get();
        if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            const fullName = `${data.name} ${data.surname}`.trim();
            const dob = data.dob?.toDate?.()?.toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) || null;
            return NextResponse.json({ name: fullName, phone: data.phone || null, dob: dob });
        }
    }

    // --- 2. If it's a DNI and not found internally, consult external API ---
    if (validation.data.docType === 'dni') {
        const externalData = await consultExternalDniApi(validatedDni);
        if (externalData && externalData.nombreCompleto) {
            return NextResponse.json({ name: externalData.nombreCompleto, phone: null, dob: externalData.fechaNacimiento });
        }
    }

    return NextResponse.json({ name: null, phone: null, dob: null });

  } catch (error: any) {
    console.error("API Route (get-client-name): Error:", error);
    let status = 500;
    let errorMessage = error.message || 'Error interno del servidor.';

    if (errorMessage.includes('No se proporcionó un token') || errorMessage.includes('Perfil del solicitante no encontrado')) {
        status = 403;
    } else if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
        status = 401;
        errorMessage = 'Token de sesión inválido o expirado.';
    }
    
    return NextResponse.json({ error: errorMessage, details: error.message }, { status });
  }
}
