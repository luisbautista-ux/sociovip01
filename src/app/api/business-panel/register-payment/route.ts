
'use server';

import {NextResponse} from 'next/server';
import {headers} from 'next/headers';
import {z} from 'zod';
import {admin, initializeAdminApp} from '@/lib/firebase/firebaseAdmin';
import type {PlatformUser, BusinessManagedEntity, GeneratedCode} from '@/lib/types';
import {getAuth} from 'firebase-admin/auth';
import {FieldValue} from 'firebase-admin/firestore';

const RegisterPaymentSchema = z.object({
  promoterUid: z.string().min(1, 'El UID del promotor es requerido.'),
  entityId: z.string().min(1, 'El ID de la entidad es requerido.'),
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

    const {promoterUid, entityId, amount: paymentAmount, notes} = validation.data;
    const businessId = callerProfile.businessId;

    const paymentRef = adminDb.collection('promoterPayments').doc();
    const entityRef = adminDb.collection('businessEntities').doc(entityId);
    
    let settledCodeIds: string[] = [];

    await adminDb.runTransaction(async (transaction) => {
        const entityDoc = await transaction.get(entityRef);
        if (!entityDoc.exists) { // Corrected: changed from exists() to exists
            throw new Error("La entidad (promoción/evento) no fue encontrada.");
        }
        
        const entityData = entityDoc.data() as BusinessManagedEntity;
        if (entityData.businessId !== businessId) {
            throw new Error("Permiso denegado. Esta entidad no pertenece a tu negocio.");
        }
        
        let remainingAmountToSettle = paymentAmount;
        const updatedCodes = (entityData.generatedCodes || []).map(code => {
            if (remainingAmountToSettle > 0 && code.generatedByUid === promoterUid && code.commissionStatus === 'unpaid' && (code.commissionGenerated ?? 0) > 0) {
                // For simplicity, we only settle full commission amounts.
                if (remainingAmountToSettle >= (code.commissionGenerated!)) {
                    remainingAmountToSettle -= code.commissionGenerated!;
                    settledCodeIds.push(code.id);
                    return {
                        ...code,
                        commissionStatus: 'paid' as const,
                        paymentId: paymentRef.id,
                    };
                }
            }
            return code;
        });

        // Create the payment document
        transaction.set(paymentRef, {
            businessId,
            promoterUid,
            entityId,
            amountPaid: paymentAmount,
            paymentDate: FieldValue.serverTimestamp(),
            paidByUid: callerProfile.uid,
            paidByName: callerProfile.name,
            notes: notes || null,
            settledCodeIds: settledCodeIds,
        });
        
        // Update the entity with the modified codes
        transaction.update(entityRef, { generatedCodes: updatedCodes });
    });


    return NextResponse.json({
      success: true,
      paymentId: paymentRef.id,
      message: `Pago registrado exitosamente. Se liquidaron ${settledCodeIds.length} comisiones.`,
    });


  } catch (error: any) {
    console.error('API Route (register-payment): Error:', error);
    return NextResponse.json({error: error.message || 'Ocurrió un error interno.'}, {status: 500});
  }
}
