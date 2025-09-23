
'use server';

import {NextResponse} from 'next/server';
import {headers} from 'next/headers';
import {z} from 'zod';

import {admin, initializeAdminApp} from '@/lib/firebase/firebaseAdmin';
import type {
  PlatformUser,
  BusinessPromoterLink,
  BusinessManagedEntity,
  PromoterPayment,
} from '@/lib/types';
import {getAuth} from 'firebase-admin/auth';

const RequestSchema = z.object({
  businessId: z.string().min(1, 'businessId es requerido.'),
});

interface BusinessPromoterLinkWithCommissions extends BusinessPromoterLink {
  pendingAmount: number;
  paidAmount: number;
}

// Helper para obtener el perfil del llamador y validar su rol/businessId
async function getAndValidateCaller(
  authorizationHeader: string,
  requestedBusinessId: string
): Promise<{valid: boolean; error?: string}> {
  if (!authorizationHeader.startsWith('Bearer ')) {
    return {valid: false, error: 'Formato de token inválido.'};
  }
  const idToken = authorizationHeader.split('Bearer ')[1];
  const decodedToken = await getAuth().verifyIdToken(idToken);
  const uid = decodedToken.uid;
  const adminDb = admin.firestore();
  const userDoc = await adminDb.collection('platformUsers').doc(uid).get();

  if (!userDoc.exists) {
    return {valid: false, error: 'Perfil del llamador no encontrado.'};
  }

  const callerProfile = userDoc.data() as PlatformUser;
  const isBusinessAdminOrStaff =
    callerProfile.roles.includes('business_admin') ||
    callerProfile.roles.includes('staff');

  if (!isBusinessAdminOrStaff || callerProfile.businessId !== requestedBusinessId) {
    return {
      valid: false,
      error:
        'Permiso denegado. No eres admin/staff del negocio solicitado.',
    };
  }

  return {valid: true};
}

export async function POST(request: Request) {
  let adminDb;

  try {
    await initializeAdminApp();
    adminDb = admin.firestore();
  } catch (error: any) {
    console.error(
      'API Route (get-promoter-commissions): Firebase Admin initialization failed.',
      error
    );
    return NextResponse.json(
      {error: `Error de inicialización del servidor: ${error.message}`},
      {status: 500}
    );
  }

  try {
    const body = await request.json();
    const validation = RequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {error: 'Datos inválidos.', details: validation.error.flatten()},
        {status: 400}
      );
    }

    const {businessId} = validation.data;

    const authorization = headers().get('Authorization');
    if (!authorization) {
      return NextResponse.json(
        {error: 'No autenticado. Token no proporcionado.'},
        {status: 401}
      );
    }

    const {valid, error} = await getAndValidateCaller(authorization, businessId);
    if (!valid) {
      return NextResponse.json({error: error}, {status: 403});
    }

    // --- Lógica principal con privilegios de admin ---

    const [entitiesSnap, paymentsSnap, linksSnap] = await Promise.all([
      adminDb.collection('businessEntities').where('businessId', '==', businessId).get(),
      adminDb.collection('promoterPayments').where('businessId', '==', businessId).get(),
      adminDb.collection('businessPromoterLinks').where('businessId', '==', businessId).get()
    ]);
    
    const allEntities = entitiesSnap.docs.map(doc => doc.data() as BusinessManagedEntity);
    const allPayments = paymentsSnap.docs.map(doc => doc.data() as PromoterPayment);
    const promoterLinks = linksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as BusinessPromoterLink);

    const linksWithCommissions: BusinessPromoterLinkWithCommissions[] = promoterLinks.map(link => {
      let pendingAmount = 0;
      allEntities.forEach(entity => {
        (entity.generatedCodes || []).forEach(code => {
          if (code.generatedByUid === link.platformUserUid && code.commissionStatus === 'unpaid' && code.status === 'used') {
            pendingAmount += code.commissionGenerated || 0;
          }
        });
      });

      const paidAmount = allPayments
        .filter(p => p.promoterUid === link.platformUserUid)
        .reduce((sum, p) => sum + p.amountPaid, 0);

      // Convertir Timestamps a ISO strings para serialización JSON segura
      const joinDateISO = link.joinDate instanceof admin.firestore.Timestamp
            ? (link.joinDate as admin.firestore.Timestamp).toDate().toISOString()
            : String(link.joinDate);
      
      return {
        ...link,
        joinDate: joinDateISO,
        pendingAmount,
        paidAmount,
      };
    });

    const sortedData = linksWithCommissions.sort((a,b) => (a.promoterName || "").localeCompare(b.promoterName || ""));

    return NextResponse.json({data: sortedData});

  } catch (error: any) {
    console.error('API Route (get-promoter-commissions): Error:', error);
    return NextResponse.json(
      {error: 'Ocurrió un error interno en el servidor.', details: error.message},
      {status: 500}
    );
  }
}
