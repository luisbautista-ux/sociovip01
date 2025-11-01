

'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';

const ConsultDocumentSchema = z.object({
  dni: z.string().min(7, "DNI/CE debe tener al menos 7 caracteres.").max(20, "DNI/CE no debe exceder 20 caracteres."),
  docType: z.enum(['dni', 'ce'], { required_error: "docType es requerido." }),
});

async function fetchExternalDniData(dni: string): Promise<{ nombreCompleto: string; fechaNacimiento: string | null }> {
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
        formNombres.append('security', '91ccab2039');

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

        // --- 2. Fetch birth date ---
        const endpointFecha = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formFecha = new URLSearchParams();
        formFecha.append('dni', dni); // param is 'dni'
        formFecha.append('action', 'buscar_fecha');
        formFecha.append('security', '74326411be');

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
    
    return { nombreCompleto: result.nombreCompleto, fechaNacimiento: result.fechaNacimiento };
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ConsultDocumentSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json({ error: 'DNI/CE inválido o no proporcionado.', details: validation.error.flatten() }, { status: 400 });
    }

    const { dni, docType } = validation.data;

    if (docType === 'dni') {
        const externalData = await fetchExternalDniData(dni);
        if (externalData.nombreCompleto) {
            return NextResponse.json(externalData);
        }
    }
    
    return NextResponse.json({ nombreCompleto: null, fechaNacimiento: null });

  } catch (error: any) {
    console.error("API Route (public/consult-document): Error:", error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
