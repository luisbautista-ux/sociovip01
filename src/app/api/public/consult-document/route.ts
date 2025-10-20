// src/app/api/public/consult-document/route.ts
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as cheerio from 'cheerio';

const ConsultDocumentSchema = z.object({
  docNumber: z.string().length(8, 'El documento debe tener 8 dígitos.'),
  docType: z.enum(['dni', 'ce']),
});

/**
 * Performs a search on an external page to get name and surname data for a given DNI.
 * This function is designed to be more resilient by parsing HTML instead of relying on tokens.
 *
 * @param dni The 8-digit DNI number to consult.
 * @returns An object with the full name, or null if not found.
 */
async function consultDniData(dni: string): Promise<{ nombreCompleto: string, nombres: string, apellidoPaterno: string, apellidoMaterno: string } | null> {
  try {
    const endpoint = "https://dniperu.com/buscar-dni-nombres-apellidos/";
    const formData = new URLSearchParams();
    formData.append('dni', dni);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://dniperu.com/buscar-dni-nombres-apellidos/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.warn(`[consultDniData] API call failed with status: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Find the div that contains the DNI information.
    // This selector might need to be adjusted if the target website changes its structure.
    const resultDiv = $('div.info-dni');
    
    if (resultDiv.length > 0) {
      const textContent = resultDiv.text();
      const matchNombres = textContent.match(/Nombres:\s*([^\n]+)/);
      const matchPaterno = textContent.match(/Apellido Paterno:\s*([^\n]+)/);
      const matchMaterno = textContent.match(/Apellido Materno:\s*([^\n]+)/);

      if (matchNombres && matchPaterno && matchMaterno) {
        const nombres = matchNombres[1].trim();
        const apellidoPaterno = matchPaterno[1].trim();
        const apellidoMaterno = matchMaterno[1].trim();
        const nombreCompleto = `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim().replace(/\s+/g, ' ');
        return { nombreCompleto, nombres, apellidoPaterno, apellidoMaterno };
      }
    }

    return null;
  } catch (error) {
    console.error('[consultDniData] Error during DNI consultation:', error);
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

    // Currently, only DNI consultation is supported by the scraping method
    if (docType !== 'dni') {
      return NextResponse.json({ error: "Actualmente solo se soporta la consulta de DNI." }, { status: 400 });
    }
    
    const data = await consultDniData(docNumber);

    if (data && data.nombreCompleto) {
      return NextResponse.json({
        nombreCompleto: data.nombreCompleto,
        nombres: data.nombres,
        apellidoPaterno: data.apellidoPaterno,
        apellidoMaterno: data.apellidoMaterno,
        fechaNacimiento: "" // Fecha de nacimiento no se obtiene con este método
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
