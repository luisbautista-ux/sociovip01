
'use server';

import { NextResponse } from 'next/server';
import { admin, initializeAdminApp } from '@/lib/firebase/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import type { PlatformUser } from '@/lib/types';
import { z } from 'zod';

const GetDocumentSchema = z.object({
    dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(20, "DNI/CE no debe exceder 20 caracteres."),
    docType: z.enum(['dni', 'ce']),
});

async function fetchExternalDniData(dni: string): Promise<{ nombreCompleto: string; nombres: string | null; apellidoPaterno: string | null; apellidoMaterno: string | null; fechaNacimiento: string | null; }> {
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
        formFecha.append('security', '94c643fd81');

        const responseFecha = await fetch(endpointFecha, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://dniperu.com/consultar-dni/' },
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
        console.error("Error fetching from external DNI API in public/consult-document:", e);
    }
    
    return result;
}


export async function POST(request: Request) {
  try {
    await initializeAdminApp();
    const adminDb = admin.firestore();

    const body = await request.json();
    const validation = GetDocumentSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: 'DNI/CE inválido o no proporcionado.', details: validation.error.flatten() }, { status: 400 });
    }
    const { dni, docType } = validation.data;

    // --- 1. Search in internal DB ---
    const collectionsToSearch = ['qrClients', 'socioVipMembers'];
    for (const collectionName of collectionsToSearch) {
        const querySnapshot = await adminDb.collection(collectionName).where('dni', '==', dni).limit(1).get();
        if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            const fullName = `${data.name} ${data.surname}`.trim();
            const dobDate = data.dob?.toDate?.();
            const fechaNacimiento = dobDate ? dobDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }) : null;
            return NextResponse.json({ 
                nombreCompleto: fullName, 
                nombres: data.name,
                apellidoPaterno: data.surname.split(' ')[0] || '',
                apellidoMaterno: data.surname.split(' ').slice(1).join(' ') || '',
                fechaNacimiento: fechaNacimiento,
            });
        }
    }

    // --- 2. If it's a DNI and not found internally, consult external API ---
    if (docType === 'dni') {
        const externalData = await fetchExternalDniData(dni);
        if (externalData && externalData.nombreCompleto) {
            return NextResponse.json(externalData);
        }
    }

    // --- 3. If not found anywhere ---
    return NextResponse.json({ 
        nombreCompleto: null, 
        nombres: null,
        apellidoPaterno: null,
        apellidoMaterno: null,
        fechaNacimiento: null 
    });

  } catch (error: any) {
    console.error("API Route (public/consult-document): Error:", error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
