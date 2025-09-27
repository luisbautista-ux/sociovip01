
'use server';

import {NextResponse} from 'next/server';
import {headers} from 'next/headers';
import {admin, initializeAdminApp} from '@/lib/firebase/firebaseAdmin';
import type {
  PlatformUser,
  BusinessManagedEntity,
  BusinessPromoterLink,
  PromoterCommissionEntry,
  Business,
  GeneratedCode,
} from '@/lib/types';
import {getAuth} from 'firebase-admin/auth';

async function getCallerProfile(
  authorizationHeader: string
): Promise<PlatformUser> {
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

const getCommissionValueForCode = (entity: BusinessManagedEntity, code: GeneratedCode): number => {
    // Si la comisión ya fue calculada y guardada en el código, usar ese valor. Es la fuente de verdad.
    if (typeof code.commissionGenerated === 'number' && code.commissionGenerated >= 0) {
        return code.commissionGenerated;
    }

    // --- Fallback de recálculo si `commissionGenerated` no existe ---
    // Esta lógica debe ser idéntica a la que se usa al validar el QR.
    if (!entity.assignedPromoters || !code.generatedByUid) {
      return 0; // Si no hay promotor, no hay comisión.
    }

    const promoterAssignment = entity.assignedPromoters.find(p => p.promoterProfileId === code.generatedByUid);
    if (!promoterAssignment || !promoterAssignment.commissionRules || promoterAssignment.commissionRules.length === 0) {
      return 0; // Si no hay reglas, no hay comisión.
    }
    
    // Buscar la primera regla de tipo 'event_general' que tenga un valor numérico.
    const generalRule = promoterAssignment.commissionRules.find(
        r => r.appliesTo === 'event_general' && typeof r.commissionValue === 'number'
    );
    
    if (generalRule) {
      return generalRule.commissionValue;
    }
    
    // Si no se encuentra una regla aplicable, la comisión es 0. NUNCA usar un valor por defecto.
    return 0;
};


export async function GET(request: Request) {
  let adminDb;

  try {
    await initializeAdminApp();
    adminDb = admin.firestore();
  } catch (error: any) {
    console.error(
      'API Route (get-commissions): Firebase Admin initialization failed.',
      error
    );
    return NextResponse.json(
      {error: `Error de inicialización del servidor: ${error.message}`},
      {status: 500}
    );
  }

  try {
    const authorization = headers().get('Authorization');
    if (!authorization) {
      return NextResponse.json(
        {error: 'No autenticado. Token no proporcionado.'},
        {status: 401}
      );
    }

    const callerProfile = await getCallerProfile(authorization);
    const isBusinessAdminOrStaff =
      callerProfile.roles.includes('business_admin') ||
      callerProfile.roles.includes('staff');
    const isPromoter = callerProfile.roles.includes('promoter');
    
    let businessIds: string[] | undefined;

    if (isBusinessAdminOrStaff && callerProfile.businessId) {
        businessIds = [callerProfile.businessId];
    } else if (isPromoter) {
        businessIds = callerProfile.businessIds;
    }

    if (!businessIds || businessIds.length === 0) {
        return NextResponse.json([]); // Return empty array if no businesses to check
    }

    const [businessesSnapshot, entitiesSnapshot] = await Promise.all([
        adminDb.collection('businesses').where('__name__', 'in', businessIds).get(),
        adminDb.collection('businessEntities').where('businessId', 'in', businessIds).get(),
    ]);
    
    const businessesMap = new Map(businessesSnapshot.docs.map(doc => [doc.id, doc.data() as Business]));
    
    const allEntities = entitiesSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as BusinessManagedEntity);
    
    const commissionEntries: PromoterCommissionEntry[] = [];

    allEntities.forEach(entity => {
      // REGLA DE NEGOCIO CLAVE: La comisión se debe solo si un código está 'used' (escaneado en puerta).
      const usedCodes = (entity.generatedCodes || []).filter(c => c.status === 'used' && c.generatedByUid);

      if(usedCodes.length === 0) return; // Si no hay códigos usados, saltar esta entidad.

      // Agrupar comisiones por promotor para esta entidad
      const promoterCommissionsForEntity: Record<string, { promoterName: string; pending: number; paid: number; codesRedeemed: number, commissionRateDisplay: Set<string> }> = {};

      usedCodes.forEach(code => {
        if (!code.generatedByUid) return;

        if (!promoterCommissionsForEntity[code.generatedByUid]) {
          promoterCommissionsForEntity[code.generatedByUid] = { 
            promoterName: code.generatedByName,
            pending: 0, 
            paid: 0,
            codesRedeemed: 0,
            commissionRateDisplay: new Set()
          };
        }
        
        const commission = getCommissionValueForCode(entity, code);
        
        promoterCommissionsForEntity[code.generatedByUid].commissionRateDisplay.add(`S/ ${commission.toFixed(2)}`);
        promoterCommissionsForEntity[code.generatedByUid].codesRedeemed += 1;
        
        if (commission > 0) {
          if (code.commissionStatus === 'paid') {
            promoterCommissionsForEntity[code.generatedByUid].paid += commission;
          } else { // 'unpaid' or undefined
            promoterCommissionsForEntity[code.generatedByUid].pending += commission;
          }
        }
      });

      for (const promoterId in promoterCommissionsForEntity) {
        const comm = promoterCommissionsForEntity[promoterId];
        // Solo agregar si hay deuda pendiente o ya se ha pagado algo (para el historial)
        if (comm.pending > 0 || comm.paid > 0) {
            if (isPromoter && promoterId !== callerProfile.uid) continue; 
            
            const uniqueRates = Array.from(comm.commissionRateDisplay);
            const finalRateDisplay = uniqueRates.length > 1 ? 'Variable' : uniqueRates[0] || 'S/ 0.00';

            commissionEntries.push({
                id: `${entity.id}-${promoterId}`,
                businessId: entity.businessId,
                businessName: businessesMap.get(entity.businessId)?.name || 'N/A',
                entityId: entity.id,
                entityName: entity.name,
                entityType: entity.type,
                promoterId: promoterId,
                promoterName: comm.promoterName,
                commissionPending: comm.pending,
                commissionPaid: comm.paid,
                promoterCodesRedeemed: comm.codesRedeemed,
                commissionRateApplied: finalRateDisplay,
                paymentStatus: comm.pending > 0 ? 'Pendiente' : 'Pagado',
                period: new Date(entity.startDate).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            });
        }
      }
    });

    return NextResponse.json(commissionEntries);
  } catch (error: any) {
    console.error('API Route (get-commissions): Error:', error);
    return NextResponse.json(
      {error: error.message || 'Ocurrió un error interno.'},
      {status: 500}
    );
  }
}

    