
'use server';

import { NextResponse } from 'next/server';
import { admin, initializeAdminApp, adminDb } from '@/lib/firebase/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import type { PlatformUser } from '@/lib/types';
import { z } from 'zod';

const GetClientNameSchema = z.object({
    dni: z.string().min(7).max(20),
    docType: z.enum(['dni', 'ce']),
});

async function consultExternalDniApi(dni: string): Promise<{ nombreCompleto: string; fechaNacimiento: string | null; nombres: string | null; apellidoPaterno: string | null; apellidoMaterno: string | null; }> {
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
        console.error("Error fetching from external DNI API in consult-document:", e);
    }
    
    return result;
}


export async function POST(request: Request) {
  try {
    await initializeAdminApp();
    const { dni, docType } = await request.json();
    
    const validation = GetClientNameSchema.safeParse({ dni, docType });
    if (!validation.success) {
      return NextResponse.json({ error: 'DNI/CE inválido o no proporcionado.', details: validation.error.flatten() }, { status: 400 });
    }
    const validatedDni = validation.data.dni;

    const collectionsToSearch = ['qrClients', 'socioVipMembers', 'platformUsers'];
    for (const collectionName of collectionsToSearch) {
        const querySnapshot = await adminDb.collection(collectionName).where('dni', '==', validatedDni).limit(1).get();
        if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            
            let name = data.name || "";
            let surname = data.surname || "";
            if (collectionName !== 'qrClients' && collectionName !== 'socioVipMembers') {
              const nameParts = String(data.name || '').split(' ');
              surname = nameParts.length > 1 ? nameParts.slice(-2).join(' ') : '';
              name = nameParts.length > 1 ? nameParts.slice(0, -2).join(' ') : data.name;
            }

            const fullName = `${name} ${surname}`.trim();
            const dobDate = data.dob?.toDate?.();
            const fechaNacimiento = dobDate ? dobDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }) : null;
            return NextResponse.json({ nombreCompleto: fullName, nombres: name, apellidoPaterno: surname.split(' ')[0] || '', apellidoMaterno: surname.split(' ')[1] || '', fechaNacimiento });
        }
    }

    if (validation.data.docType === 'dni') {
        const externalData = await consultExternalDniApi(validatedDni);
        if (externalData && externalData.nombreCompleto) {
            return NextResponse.json(externalData);
        }
    }

    return NextResponse.json({ nombreCompleto: null, fechaNacimiento: null });

  } catch (error: any) {
    console.error("API Route (consult-document): Error:", error);
    let status = 500;
    let errorMessage = error.message || 'Error interno del servidor.';
    
    return NextResponse.json({ error: errorMessage, details: error.message }, { status });
  }
}
