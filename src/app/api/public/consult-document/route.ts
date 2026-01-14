
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
    
    return { nombreCompleto: result.nombreCompleto, fechaNacimiento: result.fechaNacimiento };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ConsultSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Datos inválidos.', details: validation.error.flatten() }, { status: 400 });
    }
    
    const { dni, docType } = validation.data;

    const collectionsToSearch = ['platformUsers', 'socioVipMembers', 'qrClients'];
    for (const collectionName of collectionsToSearch) {
        const querySnapshot = await adminDb.collection(collectionName).where('dni', '==', dni).limit(1).get();
        if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            const fullName = `${data.name || ''} ${data.surname || ''}`.trim();
            
            const dob = data.dob?.toDate ? data.dob.toDate() : (data.dob ? new Date(data.dob) : null);
            const formattedDob = dob ? `${dob.getDate().toString().padStart(2,'0')}/${(dob.getMonth() + 1).toString().padStart(2, '0')}/${dob.getFullYear()}` : null;
            
            return NextResponse.json({ 
                isPlatformUser: true, 
                source: 'internal', 
                nombreCompleto: fullName,
                phone: data.phone || null,
                fechaNacimiento: formattedDob
            });
        }
    }

    if (docType === 'dni') {
        const externalData = await consultExternalDniApi(dni);
        if (externalData.nombreCompleto) {
            return NextResponse.json({ 
                isPlatformUser: false, 
                source: 'external', 
                nombreCompleto: externalData.nombreCompleto,
                fechaNacimiento: externalData.fechaNacimiento,
                phone: null,
            });
        }
    }

    return NextResponse.json({ isPlatformUser: false, source: 'not_found', nombreCompleto: null, fechaNacimiento: null, phone: null });
  } catch (error: any) {
    console.error("API Route (consult-document): Error:", error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
