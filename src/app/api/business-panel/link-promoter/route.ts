import {NextResponse} from 'next/server';
import {headers} from 'next/headers';
import {z} from 'zod';

import {admin, adminDb} from '@/lib/firebase/firebaseAdmin';
import type {PlatformUser} from '@/lib/types';
import {FieldValue} from 'firebase-admin/firestore';
import {getAuth} from 'firebase-admin/auth';

const LinkPromoterSchema = z.object({
  promoterUid: z.string().min(1, 'UID del promotor es requerido.'),
  promoterData: z.object({
    promoterDni: z.string(),
    promoterName: z.string(),
    promoterEmail: z.string().email(),
    promoterPhone: z.string().optional(),
  }),
});

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

export async function POST(request: Request) {
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

    const body = await request.json();
    const validation = LinkPromoterSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {error: 'Datos inválidos.', details: validation.error.flatten()},
        {status: 400}
      );
    }

    const {promoterUid, promoterData} = validation.data;
    const businessId = callerProfile.businessId;

    const batch = adminDb.batch();

    const userDocRef = adminDb.collection('platformUsers').doc(promoterUid);
    batch.update(userDocRef, {
      businessIds: FieldValue.arrayUnion(businessId),
    });

    const linkPayload = {
      businessId: businessId,
      promoterDni: promoterData.promoterDni,
      promoterName: promoterData.promoterName,
      promoterEmail: promoterData.promoterEmail,
      promoterPhone: promoterData.promoterPhone || '',
      isActive: true,
      isPlatformUser: true,
      platformUserUid: promoterUid,
      joinDate: FieldValue.serverTimestamp(),
    };
    const linkDocRef = adminDb.collection('businessPromoterLinks').doc();
    batch.set(linkDocRef, linkPayload);

    await batch.commit();

    return NextResponse.json({
      linkId: linkDocRef.id,
      message: 'Promotor vinculado exitosamente.',
    });
  } catch (error: any) {
    console.error('API Route (link-promoter): Error linking promoter:', error);

    let errorMessage = 'Ocurrió un error interno al vincular el promotor.';
    if (
      error.message.includes('Caller profile not found') ||
      error.message.includes('Invalid authorization header')
    ) {
      errorMessage =
        'No se pudo verificar tu identidad para realizar esta acción.';
    }

    return NextResponse.json(
      {error: errorMessage, details: error.message},
      {status: 500}
    );
  }
}
