// src/app/api/admin/consult-dni/route.ts
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import puppeteer from 'puppeteer-core';
import chromium from 'chrome-aws-lambda';

const ConsultDniSchema = z.object({
  dni: z.string().length(8, 'El DNI debe tener 8 dígitos.'),
});

/**
 * Limpia y normaliza una cadena de texto extraída del scraping.
 * @param s La cadena a limpiar.
 * @returns La cadena limpia o null si no es válida.
 */
function cleanValue(s: string): string | null {
  if (!s) return null;
  let clean = str(s).strip();
  clean = clean.replace(/(?i)(nombres?:?|apellidos?:?|apellido\s*(paterno|materno)?:?)/g, '');
  clean = clean.replace(/\n/g, " ").trim();
  clean = clean.replace(/(?i)(te puede interesar.*|consulta.*aquí.*|haz clic.*)$/g, '').trim();
  if (clean.length <= 1) return null;
  return clean;
}

/**
 * Parsea el texto extraído para encontrar el nombre completo.
 * @param text El texto completo del div de resultados.
 * @returns Un objeto con el nombre completo o null.
 */
function parseFieldsFromText(text: string): { nombreCompleto: string | null } {
  if (!text) {
    return { nombreCompleto: null };
  }

  // Patrón más robusto para buscar el nombre completo después de "Datos de la Persona:"
  const nameMatch = text.match(/Datos\s*de\s*la\s*Persona:\s*([\w\sÁÉÍÓÚÑáéíóúñ]+)/i);

  if (nameMatch && nameMatch[1]) {
    const nombreCompleto = nameMatch[1].trim().replace(/\s+/g, ' ');
    if (nombreCompleto && !/nombres y apellidos/i.test(nombreCompleto)) {
      return { nombreCompleto };
    }
  }
  
  // Fallback por si la estructura cambia ligeramente
  const fallbackMatch = text.match(/Nombres:\s*([^\n]+)[\s\S]*Apellido Paterno:\s*([^\n]+)[\s\S]*Apellido Materno:\s*([^\n]+)/i);
  if (fallbackMatch) {
      const nombres = fallbackMatch[1].trim();
      const paterno = fallbackMatch[2].trim();
      const materno = fallbackMatch[3].trim();
      const nombreCompleto = `${nombres} ${paterno} ${materno}`.trim().replace(/\s+/g, ' ');
      if (nombreCompleto) {
        return { nombreCompleto };
      }
  }
  
  return { nombreCompleto: null };
}

/**
 * Realiza la consulta de DNI utilizando Puppeteer para simular un navegador.
 * @param dni El número de DNI a consultar.
 * @returns Un objeto con el nombre completo o null si no se encuentra.
 */
async function consultDniData(dni: string): Promise<{ nombreCompleto: string } | null> {
  let browser = null;
  try {
    const executablePath = await chromium.executablePath;

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.goto("https://dniperu.com/buscar-dni-nombres-apellidos/", { waitUntil: 'domcontentloaded' });
    
    // Esperar al input, escribir DNI y hacer clic en el botón
    await page.waitForSelector("input[name='dni4']", { timeout: 8000 });
    await page.type("input[name='dni4']", dni);

    await page.waitForSelector("button.btn.btn-primary", { timeout: 8000 });
    await page.click("button.btn.btn-primary");
    
    // Esperar a que el div de resultados aparezca
    await page.waitForSelector("div.info-dni", { timeout: 8000 });
    
    // Extraer el texto del div de resultados
    const resultText = await page.evaluate(() => {
        const resultDiv = document.querySelector('div.info-dni');
        return resultDiv ? resultDiv.textContent : null;
    });

    if (!resultText) {
      return null;
    }

    const parsedData = parseFieldsFromText(resultText);

    return parsedData.nombreCompleto ? { nombreCompleto: parsedData.nombreCompleto } : null;

  } catch (error) {
    console.error('[consultDniData] Error durante la consulta con Puppeteer:', error);
    return null;
  } finally {
    if (browser !== null) {
      await browser.close();
    }
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ConsultDniSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'DNI inválido.', details: validation.error.flatten() }, { status: 400 });
    }
    
    const dni = validation.data.dni;
    const data = await consultDniData(dni);

    if (data && data.nombreCompleto) {
      return NextResponse.json(data);
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
