
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
    if (!adminDb) {
      throw new Error("Error Crítico del Servidor: La conexión a la base de datos no está disponible. Revisa la configuración de FIREBASE_SERVICE_ACCOUNT_JSON.");
    }
    
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
    
    const finalClientData = await adminDb.runTransaction(async (transaction) => {
      const clientSnapshot = await transaction.get(clientQuery);
      const entityRef = adminDb.collection('businessEntities').doc(entityId);
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
      
      let clientDoc;
      let clientData: Omit<QrClient, 'id'>;
      let finalClientId: string;
      let clientAction: 'userExists' | 'newUser' = 'userExists';

      if (!clientSnapshot.empty) {
        clientDoc = clientSnapshot.docs[0];
        clientData = clientDoc.data() as Omit<QrClient, 'id'>;
        finalClientId = clientDoc.id;

        const currentAssociatedIds = clientData.associatedBusinessIds || [];
        if (!currentAssociatedIds.includes(businessId)) {
            transaction.update(clientDoc.ref, {
                associatedBusinessIds: [...currentAssociatedIds, businessId]
            });
        }
      } else if (newClientData) {
        clientAction = 'newUser';
        clientData = {
          dni: dni,
          name: newClientData.name,
          surname: newClientData.surname,
          phone: newClientData.phone,
          dob: admin.firestore.Timestamp.fromDate(new Date(newClientData.dob)),
          registrationDate: admin.firestore.Timestamp.now(), // Usar Timestamp ahora
          generatedForBusinessId: businessId,
          associatedBusinessIds: [businessId],
        } as Omit<QrClient, 'id'>;
        const newClientRef = qrClientsRef.doc();
        transaction.set(newClientRef, clientData);
        finalClientId = newClientRef.id;
      } else {
        return { action: 'newUser' }; // Devuelve un objeto para que el frontend pida más datos
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

      const dobDate = clientData.dob instanceof admin.firestore.Timestamp
          ? clientData.dob.toDate()
          : new Date();
      const regDate = clientData.registrationDate instanceof admin.firestore.Timestamp
          ? clientData.registrationDate.toDate()
          : new Date();
          
      return {
        action: clientAction,
        clientData: {
          id: finalClientId,
          ...clientData,
          dob: dobDate.toISOString(),
          registrationDate: regDate.toISOString(),
        }
      };
    });

    if(finalClientData.action === 'newUser' && !finalClientData.clientData) {
        return NextResponse.json({ action: 'newUser' });
    }

    return NextResponse.json(finalClientData);
  } catch (error: any) {
    console.error('API Route (redeem-code): Error detallado:', error);
    return NextResponse.json(
      { error: error.message || 'Ocurrió un error interno del servidor.' },
      { status: 500 }
    );
  }
}
