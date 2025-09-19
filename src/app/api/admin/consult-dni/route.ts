
import { NextResponse } from 'next/server';
import { z } from 'zod';

const ConsultDniSchema = z.object({
  dni: z.string().length(8, 'El DNI debe tener 8 dígitos.'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ConsultDniSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'DNI inválido.', details: validation.error.flatten() }, { status: 400 });
    }

    const { dni } = validation.data;
    
    // Lógica adaptada del código C# para hacer scraping a dniperu.com
    const endpoint = "https://dniperu.com/querySelector";
    
    const formData = new URLSearchParams();
    formData.append('dni4', dni);
    formData.append('Buscar', 'Buscar');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://dniperu.com/',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
        return NextResponse.json({ error: `Error en la solicitud: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    
    // dniperu.com devuelve un campo "mensaje" en caso de error (ej: DNI no encontrado)
    if (data.mensaje) {
        return NextResponse.json({ error: data.mensaje }, { status: 404 });
    }
    
    // Extraer el nombre completo de la respuesta exitosa
    const nombreCompleto = `${data.prenombres} ${data.apPrimer} ${data.apSegundo}`.trim();
    
    if (!nombreCompleto || nombreCompleto.trim() === "") {
        return NextResponse.json({ error: "La consulta no devolvió un nombre válido." }, { status: 404 });
    }

    return NextResponse.json({ nombreCompleto });

  } catch (error: any) {
    console.error('API Route (consult-dni): Unexpected error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error interno al consultar el DNI.', details: error.message },
      { status: 500 }
    );
  }
}
