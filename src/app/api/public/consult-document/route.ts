
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { spawn } from 'child_process';
import path from 'path';

const ConsultDocumentSchema = z.object({
  docNumber: z.string().length(8, 'El DNI debe tener 8 dígitos.'),
  docType: z.enum(['dni', 'ce']),
});

/**
 * Performs a search on an external page to get name, surname, and date of birth for a given DNI.
 * This function makes two separate API calls to retrieve all necessary data.
 *
 * @param dni The 8-digit DNI number to consult.
 * @returns An object with full name and date of birth, or null if not found.
 */
async function consultExternalDniApi(dni: string): Promise<{ nombreCompleto: string, nombres: string, apellidoPaterno: string, apellidoMaterno: string, fechaNacimiento: string } | null> {
  try {
    const securityToken = '4550295f30'; // Este token podría necesitar ser actualizado si la página cambia

    // --- 1. Get Names and Surnames ---
    const endpointNombres = "https://dniperu.com/wp-admin/admin-ajax.php";
    const formNombres = new URLSearchParams();
    formNombres.append('dni4', dni);
    formNombres.append('action', 'buscar_nombres');
    formNombres.append('security', securityToken);

    const responseNombres = await fetch(endpointNombres, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://dniperu.com/buscar-dni-nombres-apellidos/',
        },
        body: formNombres.toString(),
    });
    
    let nombres = "", apellidoPaterno = "", apellidoMaterno = "";
    if (responseNombres.ok) {
        const data = await responseNombres.json();
        const mensaje = data.data?.message;
        if (data.success && mensaje) {
            const lineas = mensaje.split('\n');
            lineas.forEach((linea: string) => {
                if (linea.startsWith("Nombres:")) nombres = linea.replace("Nombres:", "").trim();
                else if (linea.startsWith("Apellido Paterno:")) apellidoPaterno = linea.replace("Apellido Paterno:", "").trim();
                else if (linea.startsWith("Apellido Materno:")) apellidoMaterno = linea.replace("Apellido Materno:", "").trim();
            });
        }
    }

    if (!nombres) { // If we didn't get a name, no point in continuing
        return null;
    }

    // --- 2. Get Date of Birth ---
    const endpointNacimiento = "https://dniperu.com/wp-admin/admin-ajax.php";
    const formNacimiento = new URLSearchParams();
    formNacimiento.append('dni5', dni);
    formNacimiento.append('action', 'buscar_nacimiento');
    formNacimiento.append('security', securityToken);

    const responseNacimiento = await fetch(endpointNacimiento, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://dniperu.com/buscar-dni-nombres-apellidos/',
        },
        body: formNacimiento.toString(),
    });
    
    let fechaNacimiento = "";
    if (responseNacimiento.ok) {
        const data = await responseNacimiento.json();
        const mensaje = data.data?.message;
        if (data.success && mensaje) {
             const match = mensaje.match(/(\d{2}\/\d{2}\/\d{4})/);
             if (match) {
                fechaNacimiento = match[0];
             }
        }
    }

    const nombreCompleto = `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim().replace(/\s+/g, ' ');
    return { nombreCompleto, nombres, apellidoPaterno, apellidoMaterno, fechaNacimiento };

  } catch (e) {
      console.warn("External DNI API call failed:", e);
      return null;
  }
}


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ConsultDocumentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Documento inválido.', details: validation.error.flatten() }, { status: 400 });
    }

    const { docNumber, docType } = validation.data;

    // Currently, only DNI consultation is supported by this external method
    if (docType !== 'dni') {
      return NextResponse.json({ error: "Actualmente solo se soporta la consulta de DNI." }, { status: 400 });
    }
    
    const data = await consultExternalDniApi(docNumber);

    if (data && data.nombreCompleto) {
      return NextResponse.json({
        nombreCompleto: data.nombreCompleto,
        nombres: data.nombres,
        apellidoPaterno: data.apellidoPaterno,
        apellidoMaterno: data.apellidoMaterno,
        fechaNacimiento: data.fechaNacimiento
      });
    } else {
      return NextResponse.json({ error: "No se pudo obtener información para el DNI consultado." }, { status: 404 });
    }

  } catch (error: any) {
    console.error('API Route (public/consult-document): Unexpected error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error interno al consultar el documento.', details: error.message },
      { status: 500 }
    );
  }
}
