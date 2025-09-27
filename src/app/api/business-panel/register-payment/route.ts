
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

// ESTA FUNCIÓN AHORA SIEMPRE RECALCULA LA COMISIÓN BASADO EN LAS REGLAS, IGNORANDO CUALQUIER VALOR PREVIAMENTE GUARDADO.
const getCommissionValueForCode = (entity: BusinessManagedEntity, code: GeneratedCode): number => {
    
    // Si no hay promotor asignado al código, no hay comisión.
    if (!code.generatedByUid) {
      return 0;
    }

    // Buscar la asignación del promotor DENTRO de la entidad (evento/promoción).
    const promoterAssignment = (entity.assignedPromoters || []).find(p => p.promoterProfileId === code.generatedByUid);
    
    // Si el promotor no fue asignado a esta entidad, o no tiene reglas de comisión, la comisión es 0.
    if (!promoterAssignment || !promoterAssignment.commissionRules || promoterAssignment.commissionRules.length === 0) {
      return 0;
    }
    
    // Buscar la primera regla de tipo 'event_general' que tenga un valor numérico.
    const generalRule = promoterAssignment.commissionRules.find(
        r => r.appliesTo === 'event_general' && typeof r.commissionValue === 'number'
    );
    
    // Si se encuentra una regla general válida, se retorna su valor.
    if (generalRule) {
      return generalRule.commissionValue;
    }
    
    // Si no se encuentra ninguna regla aplicable, la comisión es 0.
    return 0;
};

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
    
    const finalMessage = await adminDb.runTransaction(async (transaction) => {
        const entityDoc = await transaction.get(entityRef);
        if (!entityDoc.exists) {
            throw new Error(`La entidad (promoción/evento) no fue encontrada.`);
        }
        
        const entityData = entityDoc.data() as BusinessManagedEntity;
        if (entityData.businessId !== businessId) {
            throw new Error(`Permiso denegado. Esta entidad no pertenece a tu negocio.`);
        }
        
        const codesToSettle = (entityData.generatedCodes || []).filter(code => 
            code.generatedByUid === promoterUid &&
            code.status === 'used' &&
            (code.commissionStatus === 'unpaid' || code.commissionStatus === undefined)
        );

        if (codesToSettle.length === 0) {
            throw new Error(`No se encontraron comisiones pendientes de pago para esta campaña y promotor.`);
        }
        
        let totalSettledAmount = 0;
        const settledCodeIds: string[] = [];

        codesToSettle.forEach(code => {
            const commissionValue = getCommissionValueForCode(entityData, code);
            totalSettledAmount += commissionValue;
            settledCodeIds.push(code.id);
        });

        // Validar que el monto a pagar coincida con el total calculado
        if (Math.abs(totalSettledAmount - paymentAmount) > 0.01) { // Compara con una tolerancia
            throw new Error(`El monto a pagar (S/ ${paymentAmount.toFixed(2)}) no coincide con el total de comisiones pendientes (S/ ${totalSettledAmount.toFixed(2)}) para esta campaña.`);
        }
        
        const originalCodes = entityData.generatedCodes || [];
        const updatedCodes = originalCodes.map(code => {
            if (settledCodeIds.includes(code.id)) {
                return {
                    ...code,
                    commissionStatus: 'paid' as const,
                    paymentId: paymentRef.id,
                };
            }
            return code;
        });

        transaction.set(paymentRef, {
            businessId,
            promoterUid,
            entityId,
            amountPaid: totalSettledAmount,
            paymentDate: FieldValue.serverTimestamp(),
            paidByUid: callerProfile.uid,
            paidByName: callerProfile.name,
            notes: notes || null,
            settledCodeIds: settledCodeIds,
        });
        
        transaction.update(entityRef, { generatedCodes: updatedCodes });

        return `Pago registrado exitosamente. Se liquidaron ${settledCodeIds.length} comisiones por un total de S/ ${totalSettledAmount.toFixed(2)}.`;
    });

    return NextResponse.json({
      success: true,
      paymentId: paymentRef.id,
      message: finalMessage,
    });

  } catch (error: any) {
    console.error('API Route (register-payment): Error:', error);
    return NextResponse.json({error: error.message || 'Ocurrió un error interno.'}, {status: 500});
  }
}
