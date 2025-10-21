
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { spawn } from 'child_process';
import path from 'path';

const ConsultDniSchema = z.object({
  dni: z.string().length(8, 'El DNI debe tener 8 dígitos.'),
});

// Esta función invoca el script de Python y devuelve su salida
async function runPythonScript(dni: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // Construye la ruta al script de Python dentro del proyecto
    const scriptPath = path.join(process.cwd(), 'src', 'scripts', 'consulta_dni.py');
    
    // Ejecuta el script de Python como un proceso hijo, pasando el DNI como argumento
    const pythonProcess = spawn('python3', [scriptPath, dni]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error(`Python script exited with code ${code}`);
        console.error(`stderr: ${stderr}`);
        return reject(new Error(`El script de consulta falló. Código: ${code}`));
      }
      
      try {
        // Intenta parsear la última línea JSON válida de la salida
        const jsonOutput = stdout.trim().split('\n').pop();
        if (jsonOutput) {
          resolve(JSON.parse(jsonOutput));
        } else {
          throw new Error("La salida del script de Python está vacía.");
        }
      } catch (e) {
        console.error("Error al parsear la salida del script de Python:", e);
        console.error("Salida recibida (stdout):", stdout);
        reject(new Error("No se pudo interpretar la respuesta del script de consulta."));
      }
    });

    pythonProcess.on('error', (err) => {
      console.error('Failed to start python subprocess.', err);
      reject(err);
    });
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validation = ConsultDniSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'DNI inválido.', details: validation.error.flatten() }, { status: 400 });
    }
    
    const dni = validation.data.dni;
    const data = await runPythonScript(dni);

    if (data && (data.nombres || data.fecha_nacimiento)) {
      // Combinar los nombres para formar nombreCompleto
      const nombreCompleto = `${data.nombres || ''} ${data.apellido_paterno || ''} ${data.apellido_materno || ''}`.trim().replace(/\s+/g, ' ');
      
      return NextResponse.json({
          nombreCompleto,
          nombres: data.nombres,
          apellidoPaterno: data.apellido_paterno,
          apellidoMaterno: data.apellido_materno,
          fechaNacimiento: data.fecha_nacimiento,
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
