
'use server';

import { NextResponse } from 'next/server';
import { admin, initializeAdminApp } from '@/lib/firebase/firebaseAdmin';
import type { PlatformUser, QrClient, SocioVipMember } from '@/lib/types';
import { z } from 'zod';

const ConsultDocumentSchema = z.object({
  dni: z.string().min(7).max(20),
});

async function fetchExternalDniData(dni: string): Promise<{ nombreCompleto: string, fechaNacimiento: string | null, nombres: string | null, apellidoPaterno: string | null, apellidoMaterno: string | null }> {
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
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'Referer': 'https://dniperu.com/buscar-dni-nombres-apellidos/'
            },
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
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'Referer': 'https://dniperu.com/consultar-dni/' // Different referer
            },
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
        console.error("Error fetching from external DNI API in consult-document:", e);
    }
    
    return result;
}


export async function POST(request: Request) {
  try {
    await initializeAdminApp();
    const adminDb = admin.firestore();

    const body = await request.json();
    const validation = ConsultDocumentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'DNI inválido.', details: validation.error.flatten() }, { status: 400 });
    }
    const validatedDni = validation.data.dni;
    
    // --- 1. Search in internal DB ---
    const collectionsToSearch = ['qrClients', 'socioVipMembers'];
    for (const collectionName of collectionsToSearch) {
        const querySnapshot = await adminDb.collection(collectionName).where('dni', '==', validatedDni).limit(1).get();
        if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            const fullName = `${data.name} ${data.surname}`.trim();
            const dob = data.dob?.toDate ? data.dob.toDate().toLocaleDateString('es-PE', { timeZone: 'America/Lima' }) : null;
            
            const [day, month, year] = dob ? dob.split('/') : [null, null, null];
            
            return NextResponse.json({ 
              nombres: data.name,
              apellidoPaterno: data.surname,
              apellidoMaterno: "", // Not available in our DB
              fechaNacimiento: day && month && year ? `${day}/${month}/${year}` : null,
            });
        }
    }

    // --- 2. If not found internally, consult external API ---
    const externalData = await fetchExternalDniData(validatedDni);
    if (externalData.nombreCompleto) {
        return NextResponse.json(externalData);
    }

    return NextResponse.json({ error: "No se encontraron datos para el DNI proporcionado." }, { status: 404 });

  } catch (error: any) {
    console.error("API Route (public/consult-document): Error:", error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
