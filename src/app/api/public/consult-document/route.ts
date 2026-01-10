
"use server";

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { z } from 'zod';
import { anyToDate } from '@/lib/utils';

const consultSchema = z.object({
    dni: z.string().min(7, "El documento debe tener al menos 7 caracteres.").max(20),
    docType: z.enum(['dni', 'ce']),
});

// Esta función es una réplica de la que se usa en otras partes para la consulta externa.
// En un futuro, podría centralizarse.
async function consultExternalDniApi(dni: string): Promise<{ nombreCompleto: string; fechaNacimiento: string | null }> {
    let result = {
        nombreCompleto: "",
        nombres: null as string | null,
        apellidoPaterno: null as string | null,
        apellidoMaterno: null as string | null,
        fechaNacimiento: null as string | null,
    };

    try {
        const endpointNombres = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formNombres = new URLSearchParams();
        formNombres.append('dni4', dni);
        formNombres.append('action', 'buscar_nombres');
        formNombres.append('security', '6b5762d689');

        const responseNombres = await fetch(endpointNombres, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://dniperu.com/buscar-dni-nombres-apellidos/',
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

        const endpointFecha = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formFecha = new URLSearchParams();
        formFecha.append('dni', dni);
        formFecha.append('action', 'buscar_fecha');
        formFecha.append('security', 'd65c3ae72d');

        const responseFecha = await fetch(endpointFecha, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://dniperu.com/consultar-dni/',
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
        console.error("Error en API externa de consulta de DNI:", e);
    }
    
    return { nombreCompleto: result.nombreCompleto, fechaNacimiento: result.fechaNacimiento };
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = consultSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Datos de consulta inválidos.', details: validation.error.flatten() }, { status: 400 });
    }
    const { dni, docType } = validation.data;

    // --- 1. Buscar en la base de datos interna ---
    const collectionsToSearch = ['qrClients', 'socioVipMembers', 'platformUsers'];
    for (const collectionName of collectionsToSearch) {
        const querySnapshot = await adminDb.collection(collectionName).where('dni', '==', dni).limit(1).get();
        if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            const fullName = `${data.name || ''} ${data.surname || ''}`.trim();
            const dobDate = anyToDate(data.dob);
            const fechaNacimiento = dobDate ? dobDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }) : null;
            return NextResponse.json({ nombreCompleto: fullName, fechaNacimiento, phone: data.phone || null, source: 'internal' });
        }
    }
    
    // --- 2. Si no se encuentra y es DNI, consultar API externa ---
    if (docType === 'dni') {
        const externalData = await consultExternalDniApi(dni);
        if (externalData && externalData.nombreCompleto) {
            return NextResponse.json({ ...externalData, source: 'external' });
        }
    }
    
    // --- 3. Si no se encuentra en ningún lado ---
    return NextResponse.json({ nombreCompleto: null, fechaNacimiento: null, phone: null, source: 'not_found' });

  } catch (error: any) {
    console.error("API Route (public/consult-document): Error:", error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
