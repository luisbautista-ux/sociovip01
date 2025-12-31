
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { admin, adminDb } from '@/lib/firebase/firebaseAdmin';
import { anyToDate, isEntityCurrentlyActivatable } from '@/lib/utils';
import type { BusinessManagedEntity, GeneratedCode, QrClient } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';


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
    
    const finalClientData = await adminDb.runTransaction(async (transaction) => {
      const entityRef = adminDb.collection('businessEntities').doc(entityId);
      const entityDoc = await transaction.get(entityRef);
      
      if (!entityDoc.exists) {
        throw new Error(`La entidad (promoción/evento) no fue encontrada.`);
      }
      const entityData = entityDoc.data() as BusinessManagedEntity;

      if (!isEntityCurrentlyActivatable(entityData)) {
        throw new Error('Esta promoción o evento no está vigente.');
      }

      // Check if DNI has already redeemed a code for this entity
      const existingRedemption = (entityData.generatedCodes || []).find(
        (c) => c.redeemedByInfo?.dni === dni
      );
      if (existingRedemption) {
        // DNI already exists, retrieve the QR and client data
        const clientQuery = qrClientsRef.where('dni', '==', dni).limit(1);
        const existingClientSnap = await transaction.get(clientQuery);

        if (!existingClientSnap.empty) {
            const clientDoc = existingClientSnap.docs[0];
            const clientData = clientDoc.data() as Omit<QrClient, 'id'>;
            
            const dobDate = clientData.dob instanceof Timestamp ? clientData.dob.toDate() : new Date();
            const regDate = clientData.registrationDate instanceof Timestamp ? clientData.registrationDate.toDate() : new Date();

            return {
                action: 'alreadyRedeemed',
                clientData: {
                    id: clientDoc.id,
                    ...clientData,
                    dob: dobDate.toISOString(),
                    registrationDate: regDate.toISOString(),
                },
                code: existingRedemption
            };
        } else {
            // This is an inconsistent state, but we should still handle it.
            // Let the flow continue to create a new client, but log a warning.
            console.warn(`DNI ${dni} found in entity ${entityId} but not in qrClients collection.`);
        }
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

      const clientQuery = qrClientsRef.where('dni', '==', dni).limit(1);
      const clientSnapshot = await transaction.get(clientQuery);

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
          dob: Timestamp.fromDate(new Date(newClientData.dob)),
          registrationDate: Timestamp.now(),
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

      const dobDate = clientData.dob instanceof Timestamp
          ? clientData.dob.toDate()
          : new Date();
      const regDate = clientData.registrationDate instanceof Timestamp
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
