
import { NextResponse } from 'next/server';
import { initializeAdminApp, admin } from '@/lib/firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { PlatformUser, PlatformUserRole } from '@/lib/types';


const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2),
  firestoreData: z.object({
    dni: z.string(),
    name: z.string(),
    email: z.string().email(),
    roles: z.array(z.string()),
    businessId: z.string().nullable().optional(),
  }),
});

export async function POST(request: Request) {
  let adminAuth;
  let adminDb;
  
  try {
    const adminApp = await initializeAdminApp();
    adminAuth = admin.auth();
    adminDb = admin.firestore();
  } catch (error: any) {
    console.error('API Route (create-user): Firebase Admin initialization failed.', error);
    return NextResponse.json(
      { error: `Error de inicialización del servidor: ${error.message}` },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const validation = CreateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Datos inválidos.', details: validation.error.flatten() }, { status: 400 });
    }
    
    const { email, password, displayName, firestoreData } = validation.data;
    
    try {
      await adminAuth.getUserByEmail(email);
      return NextResponse.json({ error: 'El correo electrónico ya está registrado en Firebase Authentication.' }, { status: 409 });
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }
    
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: true, 
    });

    // --- Validación de Roles y BusinessId ---
    // Un business_admin solo puede crear 'staff' o 'host' para SU negocio.
    // El businessId del admin que crea se obtiene del token o de su perfil en un caso real,
    // aquí asumimos que el front-end lo envía correctamente en `firestoreData.businessId`.
    // Las reglas de Firestore deben validar esto del lado del servidor.
    const allowedRolesForBusinessAdmin: PlatformUserRole[] = ['staff', 'host'];
    const finalRoles = firestoreData.roles.filter(role => 
        allowedRolesForBusinessAdmin.includes(role as PlatformUserRole)
    );
    
    if (finalRoles.length === 0) {
        // Si se intenta crear un usuario sin un rol válido (ej. un business_admin intenta crear un superadmin),
        // se podría eliminar el usuario recién creado en Auth y devolver error.
        await adminAuth.deleteUser(userRecord.uid);
        return NextResponse.json({ error: 'Rol no permitido. Un administrador de negocio solo puede crear personal (staff) o anfitriones (host).' }, { status: 403 });
    }
    
    const userProfilePayload: Omit<PlatformUser, 'id'> = {
      ...firestoreData,
      uid: userRecord.uid,
      roles: finalRoles as PlatformUserRole[], // Aseguramos que solo roles permitidos se guarden
      lastLogin: serverTimestamp() as any, // Cast to any to avoid type mismatch
    };
    
    await adminDb.collection('platformUsers').doc(userRecord.uid).set(userProfilePayload);

    return NextResponse.json({
      uid: userRecord.uid,
      message: 'Usuario creado exitosamente en Auth y Firestore.'
    });

  } catch (error: any)
   {
    console.error('API Route (create-user): Error creating user:', error);

    let errorMessage = 'Ocurrió un error interno al crear el usuario.';
    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'El correo electrónico ya está en uso por otro usuario.';
    } else if (error.code === 'auth/invalid-password') {
      errorMessage = `La contraseña proporcionada no es válida. ${error.message}`;
    }

    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: 500 }
    );
  }
}
