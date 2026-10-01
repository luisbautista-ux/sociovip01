
'use server';

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/firebaseAdmin';

async function consultExternalDniApi(
  dni: string
): Promise<{ nombreCompleto: string; fechaNacimiento: string | null } | null> {
  try {
    const url = `https://api.decolecta.com/v1/reniec/dni?numero=${dni}`;
    const token = '123456'; // Token proporcionado por el usuario

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    });

    if (!response.ok) {
      console.error('Error en Decolecta API:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();

    if (data && data.first_name) {
      // El frontend espera el formato "Nombres ApellidoPaterno ApellidoMaterno"
      // para poder separar correctamente nombre y apellido.
      const nombreCompleto = `${data.first_name} ${data.first_last_name} ${data.second_last_name}`
        .trim()
        .replace(/\s+/g, ' ');

      return {
        nombreCompleto,
        fechaNacimiento: null // Decolecta no devuelve fecha de nacimiento
      };
    }

    return null;
  } catch (e) {
    console.error("Error fetching from Decolecta DNI API in consult-document:", e);
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
