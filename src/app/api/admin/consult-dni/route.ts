
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { admin, initializeAdminApp } from '@/lib/firebase/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import type { PlatformUser } from '@/lib/types';


const ConsultDniSchema = z.object({
  dni: z.string().length(8, 'El DNI debe tener 8 dígitos.'),
});

// Helper function to verify the token and get user profile
async function getCallerProfile(idToken: string) {
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        console.error("Token verification failed:", error);
        throw new Error("Invalid authentication token.");
    }
}

async function fetchExternalDniData(dni: string): Promise<{ nombreCompleto: string; nombres: string | null; apellidoPaterno: string | null; apellidoMaterno: string | null; fechaNacimiento: string | null; }> {
    let result = {
        nombreCompleto: "",
        nombres: null,
        apellidoPaterno: null,
        apellidoMaterno: null,
        fechaNacimiento: null,
    };

    try {
        // --- 1. Fetch Nombres y Apellidos ---
        const endpointNombres = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formNombres = new URLSearchParams();
        formNombres.append('dni4', dni);
        formNombres.append('company', '');
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

        // --- 2. Fetch Fecha de Nacimiento ---
        const endpointFecha = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formFecha = new URLSearchParams();
        formFecha.append('dni', dni); // <<<<<< CORRECCIÓN: USAR 'dni' en lugar de 'dni4'
        formFecha.append('company', '');
        formFecha.append('action', 'buscar_fecha');
        formFecha.append('security', '5c5665b196');

        const responseFecha = await fetch(endpointFecha, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Referer': 'https://dniperu.com/consultar-dni/' },
            body: formFecha.toString(),
        });

        if (responseFecha.ok) {
            const dataFecha = await responseFecha.json();
            if (dataFecha.success && dataFecha.data?.fecha_nacimiento) {
                result.fechaNacimiento = dataFecha.data.fecha_nacimiento.trim();
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
    await initializeAdminApp();
    const adminDb = admin.firestore();

    const body = await request.json();
    const validation = ConsultDniSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'DNI inválido.', details: validation.error.flatten() }, { status: 400 });
    }
    
    const dni = validation.data.dni;
    
    // --- 1. Search in internal DB ---
    const collectionsToSearch = ['qrClients', 'socioVipMembers', 'platformUsers'];
    for (const collectionName of collectionsToSearch) {
        const querySnapshot = await adminDb.collection(collectionName).where('dni', '==', dni).limit(1).get();
        if (!querySnapshot.empty) {
            const data = querySnapshot.docs[0].data();
            const fullName = `${data.name || ''} ${data.surname || ''}`.trim();
            let dob = null;
            if (data.dob) {
                const dateObj = data.dob.toDate ? data.dob.toDate() : new Date(data.dob);
                if (!isNaN(dateObj.getTime())) {
                    dob = dateObj.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                }
            }
            if (fullName) {
                return NextResponse.json({ 
                    nombreCompleto: fullName, 
                    nombres: data.name, 
                    apellidoPaterno: data.surname?.split(' ')[0] || '',
                    apellidoMaterno: data.surname?.split(' ').slice(1).join(' ') || '',
                    fechaNacimiento: dob 
                });
            }
        }
    }

    // --- 2. If not found, consult external API ---
    const externalData = await fetchExternalDniData(dni);

    if (externalData.nombres || externalData.fechaNacimiento) {
      return NextResponse.json(externalData);
    } else {
      return NextResponse.json({ error: "No se pudo obtener información para el DNI consultado." }, { status: 404 });
    }

  } catch (error: any) {
    console.error('API Route (admin/consult-dni): Unexpected error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error interno al consultar el documento.', details: error.message },
      { status: 500 }
    );
  }
}
