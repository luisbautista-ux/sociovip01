// src/app/api/redeem-code/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { admin, adminDb } from '@/lib/firebase/firebaseAdmin';
import { anyToDate, isEntityCurrentlyActivatable } from '@/lib/utils';
import type { BusinessManagedEntity, GeneratedCode, QrClient } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

const RedeemCodeSchema = z.object({
  entityId: z.string().min(1),
  codeId: z.string().min(1), // Can be 'PUBLIC_ACCESS' or a real ID
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
    
    const finalResult = await adminDb.runTransaction(async (transaction) => {
      const entityRef = adminDb.collection('businessEntities').doc(entityId);
      const entityDoc = await transaction.get(entityRef);
      
      if (!entityDoc.exists) throw new Error(`La entidad no fue encontrada.`);
      const entityData = entityDoc.data() as BusinessManagedEntity;

      if (!isEntityCurrentlyActivatable(entityData)) throw new Error('No está vigente.');

      // Check if DNI already has a QR for this entity
      const existing = (entityData.generatedCodes || []).find(
        (c) => c.redeemedByInfo?.dni === dni && (c.status === 'redeemed' || c.status === 'used')
      );

      const clientQuery = qrClientsRef.where('dni', '==', dni).limit(1);
      const clientSnap = await transaction.get(clientQuery);
      
      let clientDocId: string;
      let clientDataObj: any;

      if (!clientSnap.empty) {
        clientDocId = clientSnap.docs[0].id;
        clientDataObj = clientSnap.docs[0].data();
        // Update associations if needed
        const assoc = clientDataObj.associatedBusinessIds || [];
        if (!assoc.includes(businessId)) {
            transaction.update(clientSnap.docs[0].ref, { associatedBusinessIds: [...assoc, businessId] });
        }
      } else if (newClientData) {
        const newClientRef = qrClientsRef.doc();
        clientDocId = newClientRef.id;
        clientDataObj = {
            dni,
            name: newClientData.name,
            surname: newClientData.surname,
            phone: newClientData.phone,
            dob: Timestamp.fromDate(new Date(newClientData.dob)),
            registrationDate: Timestamp.now(),
            associatedBusinessIds: [businessId],
        };
        transaction.set(newClientRef, clientDataObj);
      } else {
        return { action: 'newUser' };
      }

      if (existing) {
          return { action: 'alreadyRedeemed', code: existing, clientData: { id: clientDocId, ...clientDataObj } };
      }

      let finalCode: GeneratedCode;
      const codes = [...(entityData.generatedCodes || [])];

      if (codeId === 'PUBLIC_ACCESS') {
          if (!entityData.isPublicAccess) throw new Error("No es de acceso público.");
          
          finalCode = {
              id: adminDb.collection('businessEntities').doc().id,
              entityId,
              value: `PUB-${dni.substring(0,5)}`,
              status: 'redeemed',
              generatedByName: 'Acceso Público',
              generatedDate: new Date().toISOString(),
              redemptionDate: new Date().toISOString(),
              redeemedByInfo: { dni, name: `${clientDataObj.name} ${clientDataObj.surname}`.trim() },
              checkIns: [],
          };
          codes.push(finalCode);
      } else {
          const idx = codes.findIndex(c => c.id === codeId);
          if (idx === -1 || codes[idx].status !== 'available') throw new Error('Código no válido.');
          
          codes[idx] = {
              ...codes[idx],
              status: 'redeemed',
              redemptionDate: new Date().toISOString(),
              redeemedByInfo: { dni, name: `${clientDataObj.name} ${clientDataObj.surname}`.trim() },
              checkIns: [],
          };
          finalCode = codes[idx];
      }

      transaction.update(entityRef, { generatedCodes: codes });
      return { action: 'success', code: finalCode, clientData: { id: clientDocId, ...clientDataObj } };
    });

    return NextResponse.json(finalResult);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
