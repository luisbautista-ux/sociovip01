
'use server';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { z } from 'zod';

const ConsultDocumentSchema = z.object({
    dni: z.string().min(8, "DNI/CE debe tener al menos 8 caracteres.").max(15, "DNI/CE no debe exceder 15 caracteres."),
    docType: z.enum(['dni', 'ce']),
});

async function consultExternalDniApi(dni: string): Promise<{ nombreCompleto: string; fechaNacimiento: string | null } | null> {
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
        
        const dataNombres = await responseNombres.json();
        let nombres: string | null = null, apellidoPaterno: string | null = null, apellidoMaterno: string | null = null;
        if (dataNombres.success && dataNombres.data?.message) {
            const lines = dataNombres.data.message.split('\n');
            lines.forEach((line: string) => {
                if (line.startsWith("Nombres:")) nombres = line.replace("Nombres:", "").trim();
                else if (line.startsWith("Apellido Paterno:")) apellidoPaterno = line.replace("Apellido Paterno:", "").trim();
                else if (line.startsWith("Apellido Materno:")) apellidoMaterno = line.replace("Apellido Materno:", "").trim();
            });
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

        const dataFecha = await responseFecha.json();
        let fechaNacimiento: string | null = null;
        if (dataFecha.success && dataFecha.data?.message) {
            const lines = dataFecha.data.message.split('\n');
            lines.forEach((line: string) => {
                if (line.startsWith("Fecha de Nacimiento:")) {
                    fechaNacimiento = line.replace("Fecha de Nacimiento:", "").trim();
                }
            });
        }
        
        const nombreCompleto = `${nombres || ''} ${apellidoPaterno || ''} ${apellidoMaterno || ''}`.trim().replace(/\s+/g, ' ');

        return nombreCompleto ? { nombreCompleto, fechaNacimiento } : null;

    } catch (e) {
        console.error("Error en API externa de DNI:", e);
        return null;
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const validation = ConsultDocumentSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json({ error: 'Datos inválidos.', details: validation.error.flatten() }, { status: 400 });
        }
        const { dni, docType } = validation.data;
    
        // 1. Check if user exists in platformUsers (SocioVIP members)
        const platformUserQuery = adminDb.collection('platformUsers').where('dni', '==', dni).limit(1);
        const platformUserSnap = await platformUserQuery.get();
        if (!platformUserSnap.empty) {
            return NextResponse.json({ 
                error: "Este documento ya está registrado como un miembro de SocioVIP. Por favor, inicia sesión." 
            }, { status: 409 });
        }
        
        // 2. Check if user exists as a QR client
        const qrClientQuery = adminDb.collection('qrClients').where('dni', '==', dni).limit(1);
        const qrClientSnap = await qrClientQuery.get();
        if (!qrClientSnap.empty) {
            const client = qrClientSnap.docs[0].data();
            const dobDate = client.dob?.toDate?.();
            const fechaNacimiento = dobDate ? dobDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }) : null;
            return NextResponse.json({ 
                nombreCompleto: `${client.name} ${client.surname}`.trim(),
                phone: client.phone || null,
                fechaNacimiento: fechaNacimiento,
                source: 'internal'
            });
        }

        // 3. If it's a DNI and not found internally, consult external API
        if (docType === 'dni') {
            const externalData = await consultExternalDniApi(dni);
            if (externalData && externalData.nombreCompleto) {
                return NextResponse.json({ ...externalData, source: 'external' });
            }
        }
    
        // 4. If not found anywhere
        return NextResponse.json({ source: 'not_found' });

    } catch (error: any) {
        console.error("API Route (consult-document): Error:", error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
    }
}
