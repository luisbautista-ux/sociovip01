
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { admin, adminDb } from '@/lib/firebase/firebaseAdmin';
import { anyToDate, isEntityCurrentlyActivatable } from '@/lib/utils';
import type { BusinessManagedEntity, GeneratedCode, QrClient } from '@/lib/types';

const RedeemCodeSchema = z.object({
  entityId: z.string().min(1),
  codeId: z.string().min(1),
  dni: z.string().min(7),
  businessId: z.string().min(1),
  newClientData: z
    .object({
      name: z.string().min(2),
      surname: z.string().min(2),
      phone: z.string().regex(/^9\d{8}$/),
      dob: z.string().datetime(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    // ================== NUEVA VERIFICACIÓN DE DIAGNÓSTICO ==================
    if (!adminDb) {
      console.error("API Route (redeem-code): adminDb is not initialized. Check firebaseAdmin.ts and environment variables.");
      return NextResponse.json(
        { error: "Error Crítico del Servidor: La conexión a la base de datos no está disponible. Revisa la configuración de FIREBASE_SERVICE_ACCOUNT_JSON." },
        { status: 500 }
      );
    }
    // =======================================================================
    
    const body = await request.json();
    const validation = RedeemCodeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos.', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { entityId, codeId, dni, businessId, newClientData } = validation.data;

    const qrClientsRef = adminDb.collection('qrClients');
    const clientQuery = qrClientsRef.where('dni', '==', dni).limit(1);
    const clientSnapshot = await clientQuery.get();

    let clientDoc;
    let clientData: Omit<QrClient, 'id'>;
    let clientAction: 'userExists' | 'newUser' = 'userExists';

    if (!clientSnapshot.empty) {
      clientDoc = clientSnapshot.docs[0];
      clientData = clientDoc.data() as Omit<QrClient, 'id'>;
    } else if (newClientData) {
      clientAction = 'newUser';
      clientData = {
        dni: dni,
        name: newClientData.name,
        surname: newClientData.surname,
        phone: newClientData.phone,
        dob: admin.firestore.Timestamp.fromDate(new Date(newClientData.dob)),
        registrationDate: admin.firestore.FieldValue.serverTimestamp(),
        generatedForBusinessId: businessId,
        associatedBusinessIds: [businessId],
        generatedForEntityId: entityId,
      } as Omit<QrClient, 'id'>;
    } else {
      return NextResponse.json({ action: 'newUser' });
    }

    const entityRef = adminDb.collection('businessEntities').doc(entityId);

    const finalClientData = await adminDb.runTransaction(async (transaction) => {
      const entityDoc = await transaction.get(entityRef);
      if (!entityDoc.exists) {
        throw new Error(`La entidad (promoción/evento) no fue encontrada.`);
      }
      const entityData = entityDoc.data() as BusinessManagedEntity;

      if (!isEntityCurrentlyActivatable(entityData)) {
        throw new Error('Esta promoción o evento no está vigente.');
      }

      const dniAlreadyUsed = (entityData.generatedCodes || []).some(
        (c) => c.redeemedByInfo?.dni === dni
      );
      if (dniAlreadyUsed) {
        throw new Error(
          'Este DNI ya ha generado un código QR para esta promoción/evento.'
        );
      }

      const codes = (entityData.generatedCodes || []) as GeneratedCode[];
      const codeIndex = codes.findIndex((c) => c.id === codeId);

      if (codeIndex === -1) {
        throw new Error('El código del promotor no es válido.');
      }
      if (codes[codeIndex].status !== 'available') {
        throw new Error('Este código ya ha sido utilizado o no está disponible.');
      }

      codes[codeIndex] = {
        ...codes[codeIndex],
        status: 'redeemed',
        redemptionDate: new Date().toISOString(),
        redeemedByInfo: {
          dni: dni,
          name: `${clientData.name} ${clientData.surname}`,
        },
      };

      transaction.update(entityRef, { generatedCodes: codes });

      let finalClientId: string;
      if (clientAction === 'newUser') {
        const newClientRef = qrClientsRef.doc();
        transaction.set(newClientRef, clientData);
        finalClientId = newClientRef.id;
      } else {
        transaction.update(clientDoc!.ref, {
          associatedBusinessIds:
            admin.firestore.FieldValue.arrayUnion(businessId),
        });
        finalClientId = clientDoc!.id;
      }

      const dobDate =
        clientData.dob instanceof admin.firestore.Timestamp
          ? clientData.dob.toDate()
          : new Date();
      const regDate =
        clientData.registrationDate instanceof admin.firestore.FieldValue
          ? new Date() // Approximate for immediate return
          : (clientData.registrationDate instanceof admin.firestore.Timestamp ? clientData.registrationDate.toDate() : new Date());


      return {
        id: finalClientId,
        ...clientData,
        dob: dobDate.toISOString(),
        registrationDate: regDate.toISOString(),
      };
    });

    return NextResponse.json({
      action: clientAction,
      clientData: finalClientData,
    });
  } catch (error: any) {
    console.error('API Route (redeem-code): Error detallado:', error);
    return NextResponse.json(
      { error: error.message || 'Ocurrió un error interno del servidor.' },
      { status: 500 }
    );
  }
}
