
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {admin, initializeAdminApp} from '@/lib/firebase/firebaseAdmin';
import {anyToDate, isEntityCurrentlyActivatable} from '@/lib/utils';
import type {BusinessManagedEntity, GeneratedCode, QrClient} from '@/lib/types';

// Esquema para validar el cuerpo de la solicitud
const RedeemCodeSchema = z.object({
  entityId: z.string().min(1),
  codeId: z.string().min(1),
  dni: z.string().min(7),
  businessId: z.string().min(1),
  newClientData: z
    .object({
      name: z.string().min(2),
      surname: z.string().min(2),
      phone: z.string().regex(/^9\d{8}$/),
      dob: z.string().datetime(),
    })
    .optional(),
});

export async function POST(request: Request) {
  try {
    await initializeAdminApp();
    const adminDb = admin.firestore();

    const body = await request.json();
    const validation = RedeemCodeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {error: 'Datos inválidos.', details: validation.error.flatten()},
        {status: 400}
      );
    }

    const {entityId, codeId, dni, businessId, newClientData} = validation.data;

    // Verificar si el cliente ya existe por DNI
    const qrClientsRef = adminDb.collection('qrClients');
    const clientQuery = qrClientsRef.where('dni', '==', dni).limit(1);
    const clientSnapshot = await clientQuery.get();

    let clientDoc;
    let clientData: Omit<QrClient, 'id'>;
    let clientAction: 'userExists' | 'newUser' = 'userExists';

    if (!clientSnapshot.empty) {
      // El cliente ya existe
      clientDoc = clientSnapshot.docs[0];
      clientData = clientDoc.data() as Omit<QrClient, 'id'>;
    } else if (newClientData) {
      // Es un nuevo cliente y se proporcionaron datos para crearlo
      clientAction = 'newUser';
      clientData = {
        dni: dni,
        name: newClientData.name,
        surname: newClientData.surname,
        phone: newClientData.phone,
        dob: admin.firestore.Timestamp.fromDate(new Date(newClientData.dob)),
        registrationDate: admin.firestore.FieldValue.serverTimestamp(),
        generatedForBusinessId: businessId,
        associatedBusinessIds: [businessId],
        generatedForEntityId: entityId,
      } as Omit<QrClient, 'id'>;
    } else {
      // El cliente no existe, pero no se proporcionaron datos para crearlo
      return NextResponse.json({action: 'newUser'});
    }

    // --- Transacción para actualizar la entidad y crear el cliente si es necesario ---
    const entityRef = adminDb.collection('businessEntities').doc(entityId);

    const finalClientData = await adminDb.runTransaction(async transaction => {
      const entityDoc = await transaction.get(entityRef);
      if (!entityDoc.exists) {
        throw new Error(`La entidad (promoción/evento) no fue encontrada.`);
      }
      const entityData = entityDoc.data() as BusinessManagedEntity;

      // Validar si la entidad está activa
      if (!isEntityCurrentlyActivatable(entityData)) {
        throw new Error('Esta promoción o evento no está vigente.');
      }

      // Validar si este DNI ya canjeó un código para esta entidad
      const dniAlreadyUsed = (entityData.generatedCodes || []).some(
        c => c.redeemedByInfo?.dni === dni && (c.status === 'redeemed' || c.status === 'used')
      );
      if (dniAlreadyUsed) {
        throw new Error(
          'Este DNI ya ha generado un código QR para esta promoción/evento.'
        );
      }

      const codes = (entityData.generatedCodes || []) as GeneratedCode[];
      const codeIndex = codes.findIndex(c => c.id === codeId);

      if (codeIndex === -1) {
        throw new Error('El código del promotor no es válido.');
      }
      if (codes[codeIndex].status !== 'available') {
        throw new Error('Este código ya ha sido utilizado o no está disponible.');
      }

      // Actualizar el código
      codes[codeIndex] = {
        ...codes[codeIndex],
        status: 'redeemed',
        redemptionDate: new Date().toISOString(),
        redeemedByInfo: {
          dni: dni,
          name: `${clientData.name} ${clientData.surname}`,
        },
      };

      transaction.update(entityRef, {generatedCodes: codes});

      // Crear o actualizar cliente
      let finalClientId: string;
      if (clientAction === 'newUser') {
        const newClientRef = qrClientsRef.doc();
        transaction.set(newClientRef, clientData);
        finalClientId = newClientRef.id;
      } else {
        // El cliente ya existe, solo se actualiza su lista de negocios asociados
        transaction.update(clientDoc!.ref, {
          associatedBusinessIds:
            admin.firestore.FieldValue.arrayUnion(businessId),
        });
        finalClientId = clientDoc!.id;
      }

      // Preparar los datos del cliente para devolverlos (convirtiendo Timestamps)
      const dobDate =
        clientData.dob instanceof admin.firestore.Timestamp
          ? clientData.dob.toDate()
          : new Date();
      const regDate =
        clientData.registrationDate instanceof admin.firestore.Timestamp
          ? clientData.registrationDate.toDate()
          : new Date();

      return {
        id: finalClientId,
        ...clientData,
        dob: dobDate.toISOString(),
        registrationDate: regDate.toISOString(),
      };
    });

    return NextResponse.json({
      action: clientAction,
      clientData: finalClientData,
    });
  } catch (error: any) {
    console.error('API Route (redeem-code): Error:', error);
    return NextResponse.json(
      {error: error.message || 'Ocurrió un error interno.'},
      {status: 500}
    );
  }
}
