import {NextResponse} from 'next/server';
import {headers} from 'next/headers';
import {admin, adminDb} from '@/lib/firebase/firebaseAdmin';
import type {
  PlatformUser,
  BusinessManagedEntity,
  Business,
  GeneratedCode,
  PromoterCommissionEntry,
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
  const userDoc = await adminDb.collection('platformUsers').doc(uid).get();
  if (!userDoc.exists) {
    throw new Error('Caller profile not found.');
  }
  return userDoc.data() as PlatformUser;
}

const getCommissionValueForCode = (entity: BusinessManagedEntity, code: GeneratedCode): number => {
    
    if (!code.generatedByUid) {
      return 0;
    }

    const promoterAssignment = (entity.assignedPromoters || []).find(p => p.promoterProfileId === code.generatedByUid);
    
    if (!promoterAssignment || !promoterAssignment.commissionRules || promoterAssignment.commissionRules.length === 0) {
      return 0;
    }
    
    const generalRule = promoterAssignment.commissionRules.find(
        r => r.appliesTo === 'event_general' && typeof r.commissionValue === 'number'
    );
    
    if (generalRule) {
      return generalRule.commissionValue;
    }
    
    return 0;
};


export async function GET(request: Request) {
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
        return NextResponse.json([]);
    }

    const [businessesSnapshot, entitiesSnapshot] = await Promise.all([
        adminDb.collection('businesses').where('__name__', 'in', businessIds).get(),
        adminDb.collection('businessEntities').where('businessId', 'in', businessIds).get(),
    ]);
    
    const businessesMap = new Map(businessesSnapshot.docs.map(doc => [doc.id, doc.data() as Business]));
    
    const allEntities = entitiesSnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}) as BusinessManagedEntity);
    
    const commissionAggregator: Record<string, PromoterCommissionEntry> = {};

    allEntities.forEach(entity => {
      const usedCodes = (entity.generatedCodes || []).filter(c => c.status === 'used' && c.generatedByUid);

      if(usedCodes.length === 0) return;

      usedCodes.forEach(code => {
        if (!code.generatedByUid) return;
        
        const commissionKey = `${code.generatedByUid}-${entity.id}`;

        if (!commissionAggregator[commissionKey]) {
            commissionAggregator[commissionKey] = {
                id: commissionKey,
                businessId: entity.businessId,
                businessName: businessesMap.get(entity.businessId)?.name || 'N/A',
                entityId: entity.id,
                entityName: entity.name,
                entityType: entity.type,
                promoterId: code.generatedByUid,
                promoterName: code.generatedByName,
                commissionPending: 0,
                commissionPaid: 0,
                promoterCodesRedeemed: 0,
                commissionRateApplied: 'S/ 0.00',
                paymentStatus: 'Pendiente',
                period: new Date(entity.startDate).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
            };
        }

        const commission = getCommissionValueForCode(entity, code);
        
        commissionAggregator[commissionKey].promoterCodesRedeemed += 1;
        
        if (commission > 0) {
            if (code.commissionStatus === 'paid') {
              commissionAggregator[commissionKey].commissionPaid += commission;
            } else {
              commissionAggregator[commissionKey].commissionPending += commission;
            }
        }
        
        const generalRule = (entity.assignedPromoters || []).find(p => p.promoterProfileId === code.generatedByUid)?.commissionRules?.find(r => r.appliesTo === 'event_general');
        if (generalRule) {
             commissionAggregator[commissionKey].commissionRateApplied = `S/ ${generalRule.commissionValue.toFixed(2)}`;
        }
      });
    });
    
    const commissionEntries = Object.values(commissionAggregator).map(entry => ({
      ...entry,
      paymentStatus: entry.commissionPending > 0 ? 'Pendiente' : 'Pagado'
    })).filter(entry => entry.commissionPaid > 0 || entry.commissionPending > 0);
    
    if (isPromoter) {
        return NextResponse.json(commissionEntries.filter(c => c.promoterId === callerProfile.uid));
    }

    return NextResponse.json(commissionEntries);
  } catch (error: any) {
    console.error('API Route (get-commissions): Error:', error);
    return NextResponse.json(
      {error: error.message || 'Ocurrió un error interno.'},
      {status: 500}
    );
  }
}
