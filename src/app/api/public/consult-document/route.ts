
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';

const ConsultDocumentSchema = z.object({
  dni: z.string().min(8, "DNI debe tener 8 caracteres.").max(8, "DNI debe tener 8 caracteres."),
});

async function fetchExternalDniData(dni: string): Promise<{ nombreCompleto: string; fechaNacimiento: string | null; }> {
    let result = {
        nombreCompleto: "",
        fechaNacimiento: null as string | null,
    };

    try {
        // --- 1. Fetch names ---
        const endpointNombres = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formNombres = new URLSearchParams();
        formNombres.append('dni4', dni);
        formNombres.append('company', '');
        formNombres.append('action', 'buscar_nombres');
        formNombres.append('security', 'b8d55f5c4f');

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
                const lineas = dataNombres.data.message.split('\n');
                let nombres = "";
                let apellidoPaterno = "";
                let apellidoMaterno = "";
                lineas.forEach((linea: string) => {
                    if (linea.startsWith("Nombres:")) nombres = linea.replace("Nombres:", "").trim();
                    else if (linea.startsWith("Apellido Paterno:")) apellidoPaterno = linea.replace("Apellido Paterno:", "").trim();
                    else if (linea.startsWith("Apellido Materno:")) apellidoMaterno = linea.replace("Apellido Materno:", "").trim();
                });
                result.nombreCompleto = `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim().replace(/\s+/g, ' ');
            }
        }

        // --- 2. Fetch birth date ---
        const endpointFecha = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formFecha = new URLSearchParams();
        formFecha.append('dni', dni);
        formFecha.append('company', '');
        formFecha.append('action', 'buscar_fecha');
        formFecha.append('security', 'c5a5d96362'); // Updated security token

        const responseFecha = await fetch(endpointFecha, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://dniperu.com/fecha-de-nacimiento-con-dni/',
            },
            body: formFecha.toString(),
        });

        if (responseFecha.ok) {
            const dataFecha = await responseFecha.json();
            if (dataFecha.success && dataFecha.data?.message) {
                const lineas = dataFecha.data.message.split('\n');
                lineas.forEach((linea: string) => {
                    if (linea.startsWith("Fecha de Nacimiento:")) {
                        result.fechaNacimiento = linea.replace("Fecha de Nacimiento:", "").trim();
                    }
                });
            }
        }
    } catch (e) {
        console.error("Error fetching from external DNI API:", e);
    }
    
    return result;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ConsultDocumentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'DNI inválido.', details: validation.error.flatten() }, { status: 400 });
    }
    const { dni } = validation.data;
    
    const externalData = await fetchExternalDniData(dni);
    
    return NextResponse.json({
        nombres: externalData.nombreCompleto.split(' ').slice(0, -2).join(' '),
        apellidoPaterno: externalData.nombreCompleto.split(' ').slice(-2, -1).join(' '),
        apellidoMaterno: externalData.nombreCompleto.split(' ').slice(-1).join(' '),
        fechaNacimiento: externalData.fechaNacimiento,
    });

  } catch (error: any) {
    console.error("API Route (public/consult-document): Error:", error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor.' }, { status: 500 });
  }
}
