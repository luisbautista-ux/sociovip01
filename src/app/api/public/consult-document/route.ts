
'use server';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { anyToDate } from '@/lib/utils';

// This function is now simplified to use a single, more reliable endpoint.
async function consultExternalDniApi(
  dni: string
): Promise<{ nombreCompleto: string; fechaNacimiento: string | null } | null> {
  try {
    const endpoint = "https://dniperu.com/wp-admin/admin-ajax.php";
    const formData = new URLSearchParams();
    formData.append('action', 'buscar_dni');
    formData.append('dni', dni);
    formData.append('security', 'a2efa2b361'); // Security nonce updated to a working one

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://dniperu.com/', // Main referer
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      console.error('Error en response de la API externa:', response.status, await response.text());
      return null;
    }

    const data = await response.json();

    if (data.success && data.data) {
        const fullName = `${data.data.nombres || ''} ${data.data.apellidoPaterno || ''} ${data.data.apellidoMaterno || ''}`.trim().replace(/\s+/g, ' ');
        // The date usually comes in YYYY-MM-DD, needs to be converted to dd/MM/yyyy
        let birthDate: string | null = null;
        if(data.data.fechaNacimiento) {
             const [year, month, day] = data.data.fechaNacimiento.split('-');
             if(day && month && year) {
                birthDate = `${day}/${month}/${year}`;
             }
        }
        return {
            nombreCompleto: fullName,
            fechaNacimiento: birthDate
        };
    }
    
    return null;

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

    // Search in internal DB first
    const collectionsToSearch = ['platformUsers', 'qrClients', 'socioVipMembers'];

    for (const collectionName of collectionsToSearch) {
      const querySnapshot = await adminDb
        .collection(collectionName)
        .where('dni', '==', dni)
        .limit(1)
        .get();

      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        const isPlatformUser = collectionName === 'platformUsers';
        
        const fullName = data.name ? data.name.trim() : `${data.name || ''} ${data.surname || ''}`.trim();
        const dobDate = anyToDate(data.dob);

        const fechaNacimiento = dobDate
          ? dobDate.toLocaleDateString('es-PE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              timeZone: 'America/Lima',
            })
          : null;
        
        return NextResponse.json({
          source: 'internal',
          isPlatformUser: isPlatformUser,
          nombreCompleto: fullName,
          fechaNacimiento,
          phone: data.phone || null,
        });
      }
    }

    // External DNI only if docType === dni
    if (docType === 'dni') {
      const externalData = await consultExternalDniApi(dni);
      if (externalData && externalData.nombreCompleto) {
        return NextResponse.json({
            source: 'external',
            isPlatformUser: false,
            ...externalData
        });
      }
    }
    
    // Not found anywhere
    return NextResponse.json(
      { source: 'not_found', isPlatformUser: false, nombreCompleto: null, fechaNacimiento: null },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("API Route (consult-document): Error:", error);
    return NextResponse.json(
      { error: 'Error interno del servidor.', details: error.message },
      { status: 500 }
    );
  }
}
