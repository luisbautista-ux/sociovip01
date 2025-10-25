
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const ConsultDniSchema = z.object({
  dni: z.string().length(8, 'El DNI debe tener 8 dígitos.'),
});

async function runPuppeteer(dni: string): Promise<any> {
    let browser = null;
    try {
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        await page.goto('https://dniperu.com/buscar-dni-nombres-apellidos/', { waitUntil: 'networkidle2' });

        await page.type('input[name="dni4"]', dni);
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle2' }),
            page.click('button[type="submit"]')
        ]);
        
        const result = await page.evaluate(() => {
            const infoDiv = document.querySelector('.info-dni');
            if (!infoDiv) return { error: 'No se encontró el contenedor de información.' };
            
            const text = (infoDiv as HTMLElement).innerText;
            const nombresMatch = text.match(/Nombres:\s*([^\n]+)/);
            const paternoMatch = text.match(/Apellido Paterno:\s*([^\n]+)/);
            const maternoMatch = text.match(/Apellido Materno:\s*([^\n]+)/);
            const nacimientoMatch = text.match(/Fecha de Nacimiento:\s*([^\n]+)/);
            
            return {
                nombres: nombresMatch ? nombresMatch[1].trim() : null,
                apellidoPaterno: paternoMatch ? paternoMatch[1].trim() : null,
                apellidoMaterno: maternoMatch ? maternoMatch[1].trim() : null,
                fechaNacimiento: nacimientoMatch ? nacimientoMatch[1].trim() : null,
            };
        });

        return result;

    } catch (error: any) {
        console.error('Puppeteer error:', error);
        return { error: 'Error durante la consulta con Puppeteer.', details: error.message };
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
    const data = await runPuppeteer(dni);

    if (data.error) {
        return NextResponse.json({ error: "No se pudo obtener información para el DNI consultado.", details: data.error }, { status: 404 });
    }

    if (data.nombres || data.fechaNacimiento) {
      const nombreCompleto = `${data.nombres || ''} ${data.apellidoPaterno || ''} ${data.apellidoMaterno || ''}`.trim().replace(/\s+/g, ' ');
      return NextResponse.json({
          nombreCompleto,
          nombres: data.nombres,
          apellidoPaterno: data.apellidoPaterno,
          apellidoMaterno: data.apellidoMaterno,
          fechaNacimiento: data.fechaNacimiento,
      });
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
