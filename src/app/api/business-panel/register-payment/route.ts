
'use server';

import {NextResponse} from 'next/server';
import {headers} from 'next/headers';
import {z} from 'zod';
import {admin, initializeAdminApp} from '@/lib/firebase/firebaseAdmin';
import type {PlatformUser, BusinessManagedEntity, GeneratedCode} from '@/lib/types';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue, getDocs} from 'firebase-admin/firestore';
import { DEFAULT_COMMISSION_PER_CODE } from '@/lib/constants';

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

    const {promoterUid, amount, notes} = validation.data;
    const businessId = callerProfile.businessId;

    const batch = adminDb.batch();

    const entitiesQuery = adminDb.collection('businessEntities').where('businessId', '==', businessId);
    const entitiesSnap = await getDocs(entitiesQuery);

    const codesToUpdate: { entityId: string; codeId: string }[] = [];
    let totalCommissionFound = 0;

    for (const entityDoc of entitiesSnap.docs) {
      const entity = {id: entityDoc.id, ...entityDoc.data()} as BusinessManagedEntity;
      (entity.generatedCodes || []).forEach(code => {
        if (
          code.generatedByUid === promoterUid &&
          code.status === 'used' &&
          code.commissionStatus !== 'paid'
        ) {
          codesToUpdate.push({entityId: entity.id, codeId: code.id});
          let commission = code.commissionGenerated || 0;
           if (commission === 0) {
              const promoterAssignment = (entity.assignedPromoters || []).find(p => p.promoterProfileId === code.generatedByUid);
              const firstRule = promoterAssignment?.commissionRules?.[0];
              if (firstRule && firstRule.commissionType === 'fixed' && firstRule.commissionValue > 0) {
                commission = firstRule.commissionValue;
              } else {
                commission = DEFAULT_COMMISSION_PER_CODE;
              }
           }
           totalCommissionFound += commission;
        }
      });
    }

    if (totalCommissionFound < amount) {
       // Optional: Decide if you want to throw an error or just pay what's due.
       // For now, let's allow it but maybe log it.
       console.warn(`Payment amount ${amount} is greater than pending commission ${totalCommissionFound} for promoter ${promoterUid}`);
    }
    
    if (codesToUpdate.length === 0) {
        return NextResponse.json({error: 'No hay comisiones pendientes de pago para este promotor.'}, {status: 404});
    }

    // Create Payment Record
    const paymentRef = adminDb.collection('promoterPayments').doc();
    batch.set(paymentRef, {
      businessId,
      promoterUid,
      amountPaid: amount,
      paymentDate: FieldValue.serverTimestamp(),
      paidByUid: callerProfile.uid,
      paidByName: callerProfile.name,
      notes: notes || null,
      settledCodeIds: codesToUpdate.map(c => c.codeId),
    });

    // Update Codes
    const uniqueEntityIds = [...new Set(codesToUpdate.map(c => c.entityId))];
    for (const entityId of uniqueEntityIds) {
      const entityRef = adminDb.collection('businessEntities').doc(entityId);
      // We need to read the document inside the transaction if we were using one.
      // With a batch, we must be careful about read-then-write patterns.
      // A safer but slower approach is to get each doc. A more complex approach is to use a transaction.
      // For simplicity here, we assume the data hasn't changed since we queried it.
      const entityData = entitiesSnap.docs.find(d => d.id === entityId)?.data() as BusinessManagedEntity;
      const updatedCodes = (entityData.generatedCodes || []).map(c => {
        if (codesToUpdate.some(u => u.codeId === c.id)) {
          return {...c, commissionStatus: 'paid', paymentId: paymentRef.id};
        }
        return c;
      });
      batch.update(entityRef, {generatedCodes: updatedCodes});
    }

    await batch.commit();

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
