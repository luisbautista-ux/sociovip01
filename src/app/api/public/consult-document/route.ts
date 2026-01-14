// src/app/api/public/consult-document/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase/firebaseAdmin';

const ConsultSchema = z.object({
  dni: z.string().min(8).max(15),
  docType: z.enum(['dni', 'ce']),
});

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
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
        console.error("Error fetching from external DNI API:", e);
    }
    
    return result;
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ConsultSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Datos inválidos.', details: validation.error.flatten() }, { status: 400 });
    }
    const { dni, docType } = validation.data;

    // 1. Check if user is already a platform user (the most important check)
    const platformUserQuery = await adminDb.collection('platformUsers').where('dni', '==', dni).limit(1).get();
    if (!platformUserQuery.empty) {
        return NextResponse.json({ isPlatformUser: true, source: 'internal' });
    }

    // 2. Check internal DBs first (QrClient, SocioVip)
    const collectionsToSearch = ['qrClients', 'socioVipMembers'];
    for (const collectionName of collectionsToSearch) {
      const querySnapshot = await adminDb.collection(collectionName).where('dni', '==', dni).limit(1).get();
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        const dobDate = data.dob?.toDate?.();
        return NextResponse.json({ 
            nombreCompleto: `${data.name} ${data.surname}`.trim(),
            phone: data.phone || null,
            fechaNacimiento: dobDate ? dobDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }) : null,
            source: 'internal'
        });
      }
    }

    // 3. If it's a DNI and not found, consult external API
    if (docType === 'dni') {
      const externalData = await consultExternalDniApi(dni);
      if (externalData.nombreCompleto) {
        return NextResponse.json({ ...externalData, source: 'external' });
      }
    }

    // 4. If not found anywhere
    return NextResponse.json({ source: 'not_found' });

  } catch (error: any) {
    console.error("API Route (consult-document): Error:", error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}