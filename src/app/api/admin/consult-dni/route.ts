
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
    
    // Check if the response status is not OK
    if (!response.ok) {
        let errorMessage = `Error de la API externa: ${response.status} ${response.statusText}`;
        try {
            const errorBody = await response.json();
            errorMessage = errorBody.message || errorBody.error || errorMessage;
        } catch (e) {
            // Could not parse error JSON, use status text
        }
        console.warn(`DNI API returned a non-OK status for DNI ${dni}:`, errorMessage);
        return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const data = await response.json();

    // After getting a 200 OK, check if the body contains a specific error message
    if (data.error) {
      console.warn(`DNI API returned an error in the response body for DNI ${dni}:`, data.error);
      return NextResponse.json(
        { error: data.error },
        { status: 404 } // Not Found is a common status for this case
      );
    }
    
    // Check if essential data is present
    if (!data.nombres || !data.apellido_paterno) {
        console.warn(`DNI API returned incomplete data for DNI ${dni}:`, data);
        return NextResponse.json({ error: 'La API no devolvió datos completos para este DNI.' }, { status: 404 });
    }

    // Combine names into a single string
    const nombreCompleto = [
      data.nombres,
      data.apellido_paterno,
      data.apellido_materno,
    ].filter(Boolean).join(' ').trim();

    return NextResponse.json({ nombreCompleto });

  } catch (error: any) {
    console.error('API Route (consult-dni): Unexpected error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error interno al consultar el DNI.', details: error.message },
      { status: 500 }
    );
  }
}
