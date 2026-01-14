
'use server';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';

// This function is now simplified as we removed the auth check
async function consultExternalDniApi(
  dni: string
): Promise<{ nombreCompleto: string; fechaNacimiento: string | null } | null> {
  try {
    /* =======================
       CONSULTA NOMBRES (NO TOCAR)
    ======================= */
    const endpointNombres = "https://dniperu.com/wp-admin/admin-ajax.php";
    const formNombres = new URLSearchParams();
    formNombres.append('dni4', dni);
    formNombres.append('action', 'buscar_nombres');
    formNombres.append('security', 'b66b4d3f23');

    const responseNombres = await fetch(endpointNombres, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://dniperu.com/buscar-dni-nombres-apellidos/',
      },
      body: formNombres.toString(),
    });

    const dataNombres = await responseNombres.json();

    let nombres: string | null = null;
    let apellidoPaterno: string | null = null;
    let apellidoMaterno: string | null = null;

    if (dataNombres.success && dataNombres.data?.message) {
      const lines = dataNombres.data.message.split('\n');
      lines.forEach((line: string) => {
        if (line.startsWith("Nombres:"))
          nombres = line.replace("Nombres:", "").trim();
        else if (line.startsWith("Apellido Paterno:"))
          apellidoPaterno = line.replace("Apellido Paterno:", "").trim();
        else if (line.startsWith("Apellido Materno:"))
          apellidoMaterno = line.replace("Apellido Materno:", "").trim();
      });
    }

    const nombreCompleto = `${nombres || ''} ${apellidoPaterno || ''} ${apellidoMaterno || ''}`
      .trim()
      .replace(/\s+/g, ' ');
      
    /* =======================
      CONSULTA FECHA (ACTUALIZADA - nuevo formato JSON directo)
    ======================= */
    const endpointFecha = "https://dniperu.com/wp-admin/admin-ajax.php";
    const formFecha = new URLSearchParams();
    formFecha.append('dni', dni);
    formFecha.append('action', 'buscar_fecha');
    formFecha.append('security', 'bd0dd5a548'); // Este nonce parece seguir funcionando

    const responseFecha = await fetch(endpointFecha, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://dniperu.com/consultas/buscar-fecha-de-nacimiento-con-dni/',
        // Opcional pero recomendado para simular mejor el navegador
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: formFecha.toString(),
    });

    if (!responseFecha.ok) {
      console.error('Error en responseFecha:', responseFecha.status);
      return { nombreCompleto, fechaNacimiento: null };
    }

    const dataFecha = await responseFecha.json();

    let fechaNacimiento: string | null = null;

    if (dataFecha.success && dataFecha.data) {
      // Nuevo formato: campo directo
      if (dataFecha.data.fechaNacimiento) {
        fechaNacimiento = dataFecha.data.fechaNacimiento.replace(/\//g, '/'); // limpia los escapes si vienen como 23\/03\/1980
      }
      // Opcional: también puedes aprovechar los nombres de aquí si quieres unificar
      // pero como ya consultas nombres por separado, no es necesario
    }

        return { nombreCompleto, fechaNacimiento };
      } catch (e) {
        console.error("Error fetching from external DNI API in consult-document:", e);
        return null;
      }
    }
export async function POST(request: Request) {
  try {
    const { dni, docType } = await request.json();

    if (!dni || typeof dni !== 'string') {
      return NextResponse.json(
        { error: 'DNI/CE inválido o no proporcionado.' },
        { status: 400 }
      );
    }

    // *** CAMBIO MÍNIMO: Primero verificar si ya es un usuario de plataforma ***
    const platformUserQuery = await adminDb.collection('platformUsers').where('dni', '==', dni).limit(1).get();
    if (!platformUserQuery.empty) {
        return NextResponse.json({ isPlatformUser: true });
    }

    // Search in other internal DBs first
    const collectionsToSearch = ['qrClients', 'socioVipMembers'];

    for (const collectionName of collectionsToSearch) {
      const querySnapshot = await adminDb
        .collection(collectionName)
        .where('dni', '==', dni)
        .limit(1)
        .get();

      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();

        const name = data.name || "";
        const surname = data.surname || "";
        const fullName = `${name} ${surname}`.trim();
        const phone = data.phone || null;

        const dobDate =
          data.dob?.toDate?.() ||
          (data.dob ? new Date(data.dob) : null);

        const fechaNacimiento = dobDate
          ? dobDate.toLocaleDateString('es-PE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              timeZone: 'America/Lima',
            })
          : null;

        return NextResponse.json({
          nombreCompleto: fullName,
          fechaNacimiento,
          phone,
          source: 'internal',
        });
      }
    }

    // External DNI only if docType === dni
    if (docType === 'dni') {
      const externalData = await consultExternalDniApi(dni);
      if (externalData && externalData.nombreCompleto) {
        return NextResponse.json({ ...externalData, source: 'external' });
      }
    }

    return NextResponse.json(
      { nombreCompleto: null, fechaNacimiento: null, source: 'not_found' },
      { status: 200 }
    );
  } catch (error) {
    console.error("API Route (consult-document): Error:", error);
    return NextResponse.json(
      { error: 'Error interno del servidor.' },
      { status: 500 }
    );
  }
}
