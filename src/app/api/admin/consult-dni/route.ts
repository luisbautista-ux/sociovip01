
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

    // --- CORRECCIÓN: URL de la API cambiada al endpoint correcto de Factiliza API ---
    const apiUrl = `https://api.factiliza.com/v1/dni/info/${dni}`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    const data = await response.json();

    if (!response.ok) {
        let errorMessage = `Error de la API externa: ${response.status} ${response.statusText}`;
        if(data.message) {
            errorMessage = data.message;
        }
        console.warn(`DNI API (Factiliza) returned a non-OK status for DNI ${dni}:`, errorMessage);
        return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    if (data.success === false || !data.data || !data.data.nombre_completo) {
      console.warn(`DNI API (Factiliza) returned an unsuccessful or incomplete response for DNI ${dni}:`, data);
      return NextResponse.json(
        { error: data.message || 'La API no devolvió datos completos para este DNI.' },
        { status: 404 } 
      );
    }
    
    // --- CORRECCIÓN: Usar el campo "nombre_completo" directamente ---
    const nombreCompleto = data.data.nombre_completo;

    return NextResponse.json({ nombreCompleto });

  } catch (error: any) {
    console.error('API Route (consult-dni): Unexpected error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error interno al consultar el DNI.', details: error.message },
      { status: 500 }
    );
  }
}
