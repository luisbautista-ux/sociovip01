
'use server';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';

// This function is now simplified as we removed the auth check
async function consultExternalDniApi(dni: string): Promise<{ nombreCompleto: string; fechaNacimiento: string | null } | null> {
    try {
        const endpointNombres = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formNombres = new URLSearchParams();
        formNombres.append('dni4', dni);
        formNombres.append('action', 'buscar_nombres');
        formNombres.append('security', '6b5762d689');

        const responseNombres = await fetch(endpointNombres, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://dniperu.com/buscar-dni-nombres-apellidos/' },
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
        const nombreCompleto = `${nombres || ''} ${apellidoPaterno || ''} ${apellidoMaterno || ''}`.trim().replace(/\s+/g, ' ');

        const endpointFecha = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formFecha = new URLSearchParams();
        formFecha.append('dni', dni);
        formFecha.append('action', 'buscar_fecha');
        formFecha.append('security', 'd65c3ae72d');

        const responseFecha = await fetch(endpointFecha, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://dniperu.com/consultar-dni/' },
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
        
        return { nombreCompleto, fechaNacimiento };
    } catch (e) {
        console.error("Error fetching from external DNI API in consult-document:", e);
        return null;
    }
}


export async function POST(request: Request) {
    try {
        const { dni, docType } = await request.json();

        if (!dni || typeof dni !== 'string') {
            return NextResponse.json({ error: 'DNI/CE inválido o no proporcionado.' }, { status: 400 });
        }
        
        // Search in internal DB first
        const collectionsToSearch = ['qrClients', 'socioVipMembers', 'platformUsers'];
        for (const collectionName of collectionsToSearch) {
            const querySnapshot = await adminDb.collection(collectionName).where('dni', '==', dni).limit(1).get();
            if (!querySnapshot.empty) {
                const data = querySnapshot.docs[0].data();
                const name = data.name || "";
                const surname = data.surname || "";
                const fullName = `${name} ${surname}`.trim();
                
                const dobDate = data.dob?.toDate?.() || (data.dob ? new Date(data.dob) : null);
                const fechaNacimiento = dobDate ? dobDate.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Lima' }) : null;
                
                return NextResponse.json({ nombreCompleto: fullName, fechaNacimiento: fechaNacimiento });
            }
        }
        
        // If it's a DNI and not found, consult external API
        if (docType === 'dni') {
            const externalData = await consultExternalDniApi(dni);
            if (externalData && externalData.nombreCompleto) {
                return NextResponse.json(externalData);
            }
        }
        
        // If not found anywhere
        return NextResponse.json({ nombreCompleto: null, fechaNacimiento: null }, { status: 200 });

    } catch (error: any) {
        console.error("API Route (consult-document): Error:", error);
        return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
    }
}
