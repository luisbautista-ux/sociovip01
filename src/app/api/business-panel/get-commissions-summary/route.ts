
'use server';

import {NextResponse} from 'next/server';
import {headers} from 'next/headers';
import {admin, initializeAdminApp} from '@/lib/firebase/firebaseAdmin';
import type {
  PlatformUser,
  BusinessManagedEntity,
  BusinessPromoterLink,
  BusinessPromoterLinkWithCommissions,
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

    if (!isBusinessAdminOrStaff || !callerProfile.businessId) {
      return NextResponse.json(
        {
          error:
            'Permiso denegado. No eres admin/staff de un negocio o no tienes un negocio asociado.',
        },
        {status: 403}
      );
    }
    const businessId = callerProfile.businessId;

    const linksQuery = adminDb
      .collection('businessPromoterLinks')
      .where('businessId', '==', businessId);
    const entitiesQuery = adminDb
      .collection('businessEntities')
      .where('businessId', '==', businessId);

    const [linksSnapshot, entitiesSnapshot] = await Promise.all([
      linksQuery.get(),
      entitiesQuery.get(),
    ]);

    const allEntities = entitiesSnapshot.docs.map(
      doc => ({id: doc.id, ...doc.data()}) as BusinessManagedEntity
    );
    const allLinks = linksSnapshot.docs.map(
      doc => ({id: doc.id, ...doc.data()}) as BusinessPromoterLink
    );

    const commissionsByPromoter: Record<
      string,
      {pending: number; paid: number}
    > = {};

    allEntities.forEach(entity => {
      (entity.generatedCodes || []).forEach(code => {
        if (
          code.generatedByUid &&
          (code.status === 'redeemed' || code.status === 'used')
        ) {
          if (!commissionsByPromoter[code.generatedByUid]) {
            commissionsByPromoter[code.generatedByUid] = {pending: 0, paid: 0};
          }
          const commission = code.commissionGenerated || 0;
          if (code.commissionStatus === 'paid') {
            commissionsByPromoter[code.generatedByUid].paid += commission;
          } else {
            commissionsByPromoter[code.generatedByUid].pending += commission;
          }
        }
      });
    });

    const linksWithCommissions: BusinessPromoterLinkWithCommissions[] =
      allLinks.map(link => {
        const promoterUid = link.platformUserUid;
        const commissions = promoterUid
          ? commissionsByPromoter[promoterUid]
          : {pending: 0, paid: 0};
        return {
          ...link,
          joinDate:
            (link.joinDate as any).toDate?.().toISOString() ||
            new Date().toISOString(),
          pendingAmount: commissions?.pending || 0,
          paidAmount: commissions?.paid || 0,
        };
      });

    return NextResponse.json(linksWithCommissions);
  } catch (error: any) {
    console.error('API Route (get-commissions): Error:', error);
    return NextResponse.json(
      {error: error.message || 'Ocurrió un error interno.'},
      {status: 500}
    );
  }
}

    