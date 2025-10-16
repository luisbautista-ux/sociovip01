import { NextResponse } from 'next/server';
import { z } from 'zod';

const ConsultDocumentSchema = z.object({
  docNumber: z.string().min(7, 'El documento debe tener al menos 7 dígitos.'),
  docType: z.enum(['dni', 'ce']),
});

interface NombresResponse {
  success?: boolean;
  data?: { message?: string };
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
    const validation = ConsultDocumentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Documento inválido.', details: validation.error.flatten() }, { status: 400 });
    }

    const { docNumber, docType } = validation.data;
    
    if (docType !== 'dni' || docNumber.length !== 8) {
      return NextResponse.json({
        nombreCompleto: "",
        nombres: "",
        apellidoPaterno: "",
        apellidoMaterno: "",
        fechaNacimiento: ""
      });
    }

    let nombreCompleto = "";
    let nombres = "";
    let apellidoPaterno = "";
    let apellidoMaterno = "";
    let fechaNacimiento = "";

    // ✅ 1. Obtener Nombres y Apellidos (actualizado con el endpoint funcional)
    try {
        const endpointNombres = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formNombres = new URLSearchParams();
        formNombres.append('dni4', docNumber);
        formNombres.append('company', '');
        formNombres.append('action', 'buscar_nombres');
        formNombres.append('security', '51193e58f5'); // Token actualizado

        const responseNombres = await fetch(endpointNombres, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Referer': 'https://dniperu.com/buscar-dni-nombres-apellidos/',
            },
            body: formNombres.toString(),
        });
        
        if (responseNombres.ok) {
            const dataNombres = await responseNombres.json() as NombresResponse;
            const mensaje = dataNombres.data?.message;
            if (mensaje) {
                const lineas = mensaje.split('\n');
                lineas.forEach(linea => {
                    if (linea.startsWith("Nombres:")) nombres = linea.replace("Nombres:", "").trim();
                    else if (linea.startsWith("Apellido Paterno:")) apellidoPaterno = linea.replace("Apellido Paterno:", "").trim();
                    else if (linea.startsWith("Apellido Materno:")) apellidoMaterno = linea.replace("Apellido Materno:", "").trim();
                });
                nombreCompleto = `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim().replace(/\s+/g, ' ');
            }
        }
    } catch (error) {
        console.warn('API Route (consult-document): Falló la consulta de nombres.', error);
    }

    // 2. Obtener Fecha de Nacimiento
    try {
        const endpointFecha = "https://dniperu.com/wp-admin/admin-ajax.php";
        const formFecha = new URLSearchParams();
        formFecha.append('dni', docNumber);
        formFecha.append('company', '');
        formFecha.append('action', 'buscar_fecha');
        formFecha.append('security', 'd44b2bcdb8');

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
                if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataFecha.data.fechaNacimiento)) {
                    fechaNacimiento = dataFecha.data.fechaNacimiento;
                } else {
                    console.warn(`API Route (consult-document): formato de fecha de nacimiento inválido: ${dataFecha.data.fechaNacimiento}`);
                }
            }
        }
    } catch (error) {
        console.warn('API Route (consult-document): Falló la consulta de fecha de nacimiento.', error);
    }
    
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
    console.error('API Route (consult-document): Unexpected error:', error);
    return NextResponse.json(
      { error: 'Ocurrió un error interno al consultar el documento.', details: error.message },
      { status: 500 }
    );
  }
}
