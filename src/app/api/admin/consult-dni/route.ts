
import { NextResponse } from 'next/server';
import { z } from 'zod';

const ConsultDniSchema = z.object({
  dni: z.string().length(8, 'El DNI debe tener 8 dígitos.'),
});

interface NombresResponse {
  mensaje?: string;
}

interface FechaData {
  dni?: string;
  fechaNacimiento?: string;
  nombres?: string;
}
interface FechaResponse {
  success: boolean;
  data?: FechaData;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ConsultDniSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'DNI inválido.', details: validation.error.flatten() }, { status: 400 });
    }

    const { dni } = validation.data;
    
    let nombreCompleto = "";
    let nombres = "";
    let apellidoPaterno = "";
    let apellidoMaterno = "";
    let fechaNacimiento = "";

    // 1. Obtener Nombres y Apellidos
    try {
        const endpointNombres = "https://dniperu.com/querySelector";
        const formNombres = new URLSearchParams();
        formNombres.append('dni4', dni);
        formNombres.append('Buscar', 'Buscar');

        const responseNombres = await fetch(endpointNombres, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://dniperu.com/',
            },
            body: formNombres.toString(),
        });
        
        if (responseNombres.ok) {
            const dataNombres = await responseNombres.json() as NombresResponse;
            if (dataNombres.mensaje) {
                const lineas = dataNombres.mensaje.split('\n');
                lineas.forEach(linea => {
                    if (linea.startsWith("Nombres:")) nombres = linea.replace("Nombres:", "").trim();
                    else if (linea.startsWith("Apellido Paterno:")) apellidoPaterno = linea.replace("Apellido Paterno:", "").trim();
                    else if (linea.startsWith("Apellido Materno:")) apellidoMaterno = linea.replace("Apellido Materno:", "").trim();
                });
                nombreCompleto = `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim().replace(/\s+/g, ' ');
            }
        }
    } catch (error) {
        console.warn('API Route (consult-dni): Falló la consulta de nombres.', error);
        // No se detiene el flujo, se puede continuar para buscar la fecha de nacimiento.
    }

    // 2. Obtener Fecha de Nacimiento
    try {
        const endpointFecha = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formFecha = new URLSearchParams();
        formFecha.append('dni', dni);
        formFecha.append('company', '');
        formFecha.append('action', 'buscar_fecha');
        formFecha.append('security', '1807126567'); // Usando el token proporcionado

        const responseFecha = await fetch(endpointFecha, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://dniperu.com/fecha-de-nacimiento-con-dni/',
            },
            body: formFecha.toString(),
        });

        if (responseFecha.ok) {
            const dataFecha = await responseFecha.json() as FechaResponse;
            if (dataFecha.success && dataFecha.data?.fechaNacimiento) {
                fechaNacimiento = dataFecha.data.fechaNacimiento;
            }
        }
    } catch (error) {
        console.warn('API Route (consult-dni): Falló la consulta de fecha de nacimiento.', error);
    }
    
    // 3. Devolver el resultado combinado
    if (!nombreCompleto && !fechaNacimiento) {
        return NextResponse.json({ error: "No se pudo obtener información para el DNI consultado." }, { status: 404 });
    }

    return NextResponse.json({ 
        nombreCompleto, 
        nombres,
        apellidoPaterno,
        apellidoMaterno,
        fechaNacimiento 
    });

  } catch (error: any) {
    console.error('API Route (consult-dni): Unexpected error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error interno al consultar el DNI.', details: error.message },
      { status: 500 }
    );
  }
}
