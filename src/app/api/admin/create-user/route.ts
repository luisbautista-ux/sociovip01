
import { NextResponse } from 'next/server';
import { initializeAdminApp, admin } from '@/lib/firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

// Esquema para validar los datos de entrada
const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6), // La contraseña es obligatoria ahora
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

    // --- Flujo con Contraseña (único flujo ahora) ---
    
    // 1. Verificar si ya existe un usuario con ese email en Firebase Auth
    try {
      await adminAuth.getUserByEmail(email);
      // Si no lanza error, el usuario ya existe.
      return NextResponse.json({ error: 'El correo electrónico ya está registrado en Firebase Authentication.' }, { status: 409 });
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') {
        // Si es un error diferente a "no encontrado", es un problema real.
        throw error;
      }
      // Si es 'auth/user-not-found', es lo que esperamos. Continuamos.
    }
    
    // 2. Crear usuario en Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: true, 
    });

    // 3. Crear perfil de usuario en Firestore
    const userProfilePayload = {
      ...firestoreData,
      uid: userRecord.uid,
      lastLogin: Timestamp.now(),
    };
    
    await adminDb.collection('platformUsers').doc(userRecord.uid).set(userProfilePayload);

    return NextResponse.json({
      uid: userRecord.uid,
      message: 'Usuario creado exitosamente en Auth y Firestore.'
    });

  } catch (error: any) {
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
