
import { NextResponse } from 'next/server';
import { z } from 'zod';

const ConsultDniSchema = z.object({
  dni: z.string().length(8, 'El DNI debe tener 8 dígitos.'),
});

export async function POST(request: Request) {
  const token = process.env.DNI_API_TOKEN;

  if (!token) {
    console.error('API Route (consult-dni): DNI_API_TOKEN is not set in .env file.');
    return NextResponse.json(
      { error: 'El servicio de consulta no está configurado en el servidor.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const validation = ConsultDniSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'DNI inválido.', details: validation.error.flatten() }, { status: 400 });
    }

    const { dni } = validation.data;

    const apiUrl = `https://www.apisperu.net/api/dni/${dni}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.warn(`DNI API returned an error for DNI ${dni}:`, data.error);
      return NextResponse.json(
        { error: data.error || 'No se pudo obtener la información del DNI.' },
        { status: response.status }
      );
    }
    
    // Combine names into a single string
    const nombreCompleto = [
      data.nombres,
      data.apellido_paterno,
      data.apellido_materno,
    ].filter(Boolean).join(' ');

    return NextResponse.json({ nombreCompleto });

  } catch (error: any) {
    console.error('API Route (consult-dni): Unexpected error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error interno al consultar el DNI.', details: error.message },
      { status: 500 }
    );
  }
}
