
'use server';

import {NextResponse} from 'next/server';
import {headers} from 'next/headers';
import {z} from 'zod';
import {admin, initializeAdminApp} from '@/lib/firebase/firebaseAdmin';
import type {PlatformUser, BusinessManagedEntity, GeneratedCode} from '@/lib/types';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue} from 'firebase-admin/firestore';
import { DEFAULT_COMMISSION_PER_CODE } from '@/lib/constants';
import { anyToDate } from '@/lib/utils';

const RegisterPaymentSchema = z.object({
  promoterUid: z.string().min(1, 'El UID del promotor es requerido.'),
  amount: z.coerce.number().positive('El monto debe ser mayor a cero.'),
  notes: z.string().optional(),
});

async function getCallerProfile(authorizationHeader: string): Promise<PlatformUser> {
  if (!authorizationHeader.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header format.');
  }
  const idToken = authorizationHeader.split('Bearer ')[1];
  const decodedToken = await getAuth().verifyIdToken(idToken);
  const uid = decodedToken.uid;
  const adminDb = admin.firestore();
  const userDoc = await adminDb.collection('platformUsers').doc(uid).get();
  if (!userDoc.exists) {
    throw new Error('Caller profile not found.');
  }
  return userDoc.data() as PlatformUser;
}

export async function POST(request: Request) {
  let adminDb;

  try {
    await initializeAdminApp();
    adminDb = admin.firestore();
  } catch (error: any) {
    console.error('API Route (register-payment): Firebase Admin initialization failed.', error);
    return NextResponse.json({error: `Error de inicialización del servidor: ${error.message}`}, {status: 500});
  }

  try {
    const authorization = headers().get('Authorization');
    if (!authorization) {
      return NextResponse.json({error: 'No autenticado. Token no proporcionado.'}, {status: 401});
    }

    const callerProfile = await getCallerProfile(authorization);
    const isBusinessAdminOrStaff = callerProfile.roles.includes('business_admin') || callerProfile.roles.includes('staff');

    if (!isBusinessAdminOrStaff || !callerProfile.businessId) {
      return NextResponse.json({error: 'Permiso denegado. No eres admin/staff de un negocio o no tienes un negocio asociado.'}, {status: 403});
    }

    const body = await request.json();
    const validation = RegisterPaymentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({error: 'Datos inválidos.', details: validation.error.flatten()}, {status: 400});
    }

    const {promoterUid, amount: paymentAmount, notes} = validation.data;
    const businessId = callerProfile.businessId;

    const paymentRef = adminDb.collection('promoterPayments').doc();

    await adminDb.runTransaction(async (transaction) => {
      // 1. ALL READS FIRST
      const entitiesQuery = adminDb.collection('businessEntities').where('businessId', '==', businessId);
      const entitiesSnap = await transaction.get(entitiesQuery);

      const unpaidCodes: { entityId: string; entityRef: admin.firestore.DocumentReference; code: GeneratedCode, commission: number}[] = [];
      
      for (const entityDocSnap of entitiesSnap.docs) {
        const entityData = entityDocSnap.data() as BusinessManagedEntity;
        
        if (!entityData.generatedCodes || entityData.generatedCodes.length === 0) {
            continue;
        }

        entityData.generatedCodes.forEach(code => {
          if (code.generatedByUid === promoterUid && code.status === 'used' && code.commissionStatus !== 'paid') {
            let commission = code.commissionGenerated || 0;
            if (commission === 0) {
              const promoterAssignment = (entityData.assignedPromoters || []).find(p => p.promoterProfileId === code.generatedByUid);
              const firstRule = promoterAssignment?.commissionRules?.[0];
              if (firstRule && firstRule.commissionType === 'fixed' && firstRule.commissionValue > 0) {
                commission = firstRule.commissionValue;
              } else {
                commission = DEFAULT_COMMISSION_PER_CODE;
              }
            }
            if (commission > 0) {
              unpaidCodes.push({ entityId: entityDocSnap.id, entityRef: entityDocSnap.ref, code, commission });
            }
          }
        });
      }
      
      if (unpaidCodes.length === 0) {
          throw new Error('No hay comisiones pendientes de pago para este promotor.');
      }
      
      unpaidCodes.sort((a, b) => {
        const dateA = anyToDate(a.code.usedDate)?.getTime() || 0;
        const dateB = anyToDate(b.code.usedDate)?.getTime() || 0;
        return dateA - dateB;
      });

      let remainingAmountToSettle = paymentAmount;
      const settledCodeIds: string[] = [];
      const entityUpdates: Map<string, {ref: admin.firestore.DocumentReference, codesToUpdate: string[]}> = new Map();

      for (const { entityId, entityRef, code, commission } of unpaidCodes) {
        if (remainingAmountToSettle >= commission) {
          settledCodeIds.push(code.id);
          remainingAmountToSettle -= commission;
          
          if (!entityUpdates.has(entityId)) {
            entityUpdates.set(entityId, { ref: entityRef, codesToUpdate: [] });
          }
          entityUpdates.get(entityId)!.codesToUpdate.push(code.id);

        } else {
          break;
        }
      }
      
      if (settledCodeIds.length === 0) {
        throw new Error(`El monto S/ ${paymentAmount.toFixed(2)} es insuficiente para cubrir la comisión más antigua de S/ ${unpaidCodes[0].commission.toFixed(2)}.`);
      }

      // 2. ALL WRITES LAST

      // Write the payment document
      transaction.set(paymentRef, {
        businessId, promoterUid, amountPaid: paymentAmount,
        paymentDate: FieldValue.serverTimestamp(),
        paidByUid: callerProfile.uid, paidByName: callerProfile.name,
        notes: notes || null, settledCodeIds: settledCodeIds,
      });
      
      // Update all affected entities
      for (const docSnap of entitiesSnap.docs) {
          const entityId = docSnap.id;
          if (entityUpdates.has(entityId)) {
              const updateInfo = entityUpdates.get(entityId)!;
              const entityData = docSnap.data() as BusinessManagedEntity;
              
              const updatedCodes = (entityData.generatedCodes || []).map(c => {
                  if (updateInfo.codesToUpdate.includes(c.id)) {
                      return {...c, commissionStatus: 'paid', paymentId: paymentRef.id};
                  }
                  return c;
              });

              transaction.update(docSnap.ref, { generatedCodes: updatedCodes });
          }
      }
    });

    return NextResponse.json({
      success: true,
      paymentId: paymentRef.id,
      message: 'Pago registrado y comisiones actualizadas exitosamente.',
    });
  } catch (error: any) {
    console.error('API Route (register-payment): Error:', error);
    return NextResponse.json({error: error.message || 'Ocurrió un error interno.'}, {status: 500});
  }
}
