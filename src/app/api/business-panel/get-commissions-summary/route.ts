
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
} from '@/lib/types';
import {getAuth} from 'firebase-admin/auth';
import {DEFAULT_COMMISSION_PER_CODE} from '@/lib/constants';

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

    const [businessesSnapshot, entitiesSnapshot, linksSnapshot] = await Promise.all([
        adminDb.collection('businesses').where('__name__', 'in', businessIds).get(),
        adminDb.collection('businessEntities').where('businessId', 'in', businessIds).get(),
        adminDb.collection('businessPromoterLinks').where('businessId', 'in', businessIds).get(),
    ]);
    
    const businessesMap = new Map(businessesSnapshot.docs.map(doc => [doc.id, doc.data() as Business]));
    const promoterLinks = linksSnapshot.docs.map(doc => doc.data() as BusinessPromoterLink);
    const validPromoterUids = new Set(promoterLinks.map(link => link.platformUserUid));

    const allEntities = entitiesSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as BusinessManagedEntity);
    
    const commissionEntries: PromoterCommissionEntry[] = [];

    allEntities.forEach(entity => {
      const promoterCommissionsForEntity: Record<string, { promoterName: string, pending: number, paid: number, codesRedeemed: number, commissionRate: string }> = {};

      (entity.generatedCodes || []).forEach(code => {
        // CORRECTION: Commission is generated when 'redeemed' OR 'used'
        if (!code.generatedByUid || (code.status !== 'redeemed' && code.status !== 'used') || !validPromoterUids.has(code.generatedByUid)) return;

        if (!promoterCommissionsForEntity[code.generatedByUid]) {
          promoterCommissionsForEntity[code.generatedByUid] = { 
            promoterName: code.generatedByName,
            pending: 0, 
            paid: 0,
            codesRedeemed: 0,
            commissionRate: `S/ ${DEFAULT_COMMISSION_PER_CODE.toFixed(2)}`
          };
        }
        
        let commission = 0;
        let commissionDesc = `S/ ${DEFAULT_COMMISSION_PER_CODE.toFixed(2)}`;

        if (code.commissionGenerated && code.commissionGenerated > 0) {
            commission = code.commissionGenerated;
            commissionDesc = `S/ ${commission.toFixed(2)}`;
        } else {
            const promoterAssignment = (entity.assignedPromoters || []).find(p => p.promoterProfileId === code.generatedByUid);
            const firstRule = promoterAssignment?.commissionRules?.[0];
            if (firstRule && firstRule.commissionType === 'fixed' && firstRule.commissionValue > 0) {
              commission = firstRule.commissionValue;
              commissionDesc = `S/ ${commission.toFixed(2)}`;
            } else {
              commission = DEFAULT_COMMISSION_PER_CODE;
            }
        }
        
        promoterCommissionsForEntity[code.generatedByUid].commissionRate = commissionDesc;
        
        if (commission > 0) {
          // A code that is "used" was previously "redeemed", so we count it here
          promoterCommissionsForEntity[code.generatedByUid].codesRedeemed += 1;
          
          if (code.commissionStatus === 'paid') {
            promoterCommissionsForEntity[code.generatedByUid].paid += commission;
          } else { // 'unpaid' or undefined
            promoterCommissionsForEntity[code.generatedByUid].pending += commission;
          }
        }
      });

      for (const promoterId in promoterCommissionsForEntity) {
        const comm = promoterCommissionsForEntity[promoterId];
        if (comm.pending > 0 || comm.paid > 0) {
            if (isPromoter && promoterId !== callerProfile.uid) continue; 

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
                commissionRateApplied: comm.commissionRate,
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
