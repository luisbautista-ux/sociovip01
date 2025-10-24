
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as cheerio from 'cheerio';

const ConsultDocumentSchema = z.object({
  docNumber: z.string().length(8, 'El documento debe tener 8 dígitos.'),
  docType: z.enum(['dni', 'ce']),
});

/**
 * Performs two separate searches on an external page to get name/surname and birth date for a given DNI.
 *
 * @param dni The 8-digit DNI number to consult.
 * @returns An object with the full profile, or null if not found.
 */
async function consultExternalDniApi(dni: string): Promise<{ nombreCompleto: string, nombres: string, apellidoPaterno: string, apellidoMaterno: string, fechaNacimiento: string } | null> {
  const commonHeaders = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
  };

  try {
    // --- 1. Fetch Names and Surnames ---
    const formNombres = new URLSearchParams();
    formNombres.append('dni4', dni);
    formNombres.append('company', '');
    formNombres.append('action', 'buscar_nombres');
    formNombres.append('security', '4550295f30');

    const responseNombres = await fetch("https://dniperu.com/wp-admin/admin-ajax.php", {
      method: 'POST',
      headers: {
        ...commonHeaders,
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
    
    // Si no se obtuvieron los nombres, no continuar.
    if (!nombres) {
        console.warn(`[consultExternalDniApi] Could not fetch names for DNI: ${dni}`);
        return null;
    }
    
    // --- 2. Fetch Birth Date ---
    const formFecha = new URLSearchParams();
    formFecha.append('dni', dni);
    formFecha.append('company', '');
    formFecha.append('action', 'buscar_fecha');
    formFecha.append('security', 'b8f54a1fcd');

    const responseFecha = await fetch("https://dniperu.com/wp-admin/admin-ajax.php", {
        method: 'POST',
        headers: {
          ...commonHeaders,
          'Referer': 'https://dniperu.com/fecha-de-nacimiento-con-dni/',
        },
        body: formFecha.toString(),
    });

    let fechaNacimiento = "";
    if (responseFecha.ok) {
        const dataFecha = await responseFecha.json();
        const mensajeFecha = dataFecha.data?.message;
        if (dataFecha.success && mensajeFecha) {
            const match = mensajeFecha.match(/(\d{2}\/\d{2}\/\d{4})/);
            if (match) {
                fechaNacimiento = match[1];
            }
        }
    }
    
    const nombreCompleto = `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim().replace(/\s+/g, ' ');
    return { nombreCompleto, nombres, apellidoPaterno, apellidoMaterno, fechaNacimiento };

  } catch (error) {
    console.error('[consultExternalDniApi] Error during DNI consultation:', error);
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
        fechaNacimiento: data.fechaNacimiento // Ahora sí se devuelve la fecha.
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
