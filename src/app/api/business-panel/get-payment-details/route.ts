
'use server';

import {NextResponse, type NextRequest} from 'next/server';
import {headers} from 'next/headers';
import {admin, initializeAdminApp} from '@/lib/firebase/firebaseAdmin';
import type {PlatformUser, PromoterPayment} from '@/lib/types';
import {getAuth} from 'firebase-admin/auth';
import { anyToDate } from '@/lib/utils';

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

export async function GET(request: NextRequest) {
  let adminDb;

  try {
    await initializeAdminApp();
    adminDb = admin.firestore();
  } catch (error: any) {
    return NextResponse.json({error: `Error de inicialización del servidor: ${error.message}`}, {status: 500});
  }

  try {
    const authorization = headers().get('Authorization');
    if (!authorization) {
      return NextResponse.json({error: 'No autenticado.'}, {status: 401});
    }

    const callerProfile = await getCallerProfile(authorization);
    const isBusinessAdminOrStaff = callerProfile.roles.includes('business_admin') || callerProfile.roles.includes('staff');
    
    if (!isBusinessAdminOrStaff || !callerProfile.businessId) {
      return NextResponse.json({error: 'Permiso denegado.'}, {status: 403});
    }
    
    const { searchParams } = new URL(request.url);
    const promoterUid = searchParams.get('promoterUid');

    if (!promoterUid) {
      return NextResponse.json({ error: 'Falta el UID del promotor.' }, { status: 400 });
    }
    
    const paymentsQuery = adminDb.collection('promoterPayments')
        .where('businessId', '==', callerProfile.businessId)
        .where('promoterUid', '==', promoterUid)
        .orderBy('paymentDate', 'desc');
        
    const paymentsSnap = await paymentsQuery.get();
    
    const payments = paymentsSnap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            paymentDate: anyToDate(data.paymentDate)?.toISOString() || new Date().toISOString(),
        } as PromoterPayment;
    });

    return NextResponse.json(payments);

  } catch (error: any) {
    console.error('API Route (get-payment-details): Error:', error);
    return NextResponse.json({error: error.message || 'Ocurrió un error interno.'}, {status: 500});
  }
}
