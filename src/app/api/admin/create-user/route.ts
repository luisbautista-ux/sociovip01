
import { NextResponse } from 'next/server';
import { initializeAdminApp, admin } from '@/lib/firebase/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

// Esquema para validar los datos de entrada
const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(), // La contraseña es opcional ahora
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

    if (password) {
      // --- Flujo con Contraseña (Usuario de Plataforma Tradicional) ---
      
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

    } else {
      // --- Flujo SIN Contraseña (Preparado para Login con Google) ---
      
      // 1. Solo creamos el documento en Firestore. Usamos el DNI como ID temporal si no hay UID.
      // Esta lógica asume que el usuario final completará el proceso con Google.
      // Firestore NO permite crear un documento con un UID que aún no existe en Auth,
      // por lo que el documento se creará con un ID autogenerado y el UID se añadirá después.
      // La lógica del AuthContext se encargará de vincular el UID de Google al perfil correcto por email.
      // Esta API solo prepara el perfil.
      // Para evitar conflictos, se debe asegurar que el email sea único en la colección platformUsers.

      const usersRef = adminDb.collection('platformUsers');
      const q = usersRef.where('email', '==', email).limit(1);
      const existingUserSnap = await q.get();

      if (!existingUserSnap.empty) {
        return NextResponse.json({ error: 'Ya existe un perfil de usuario con este correo electrónico.' }, { status: 409 });
      }
      
      // Se crea el perfil sin UID de Auth, que se añadirá en el primer inicio de sesión social.
      const userProfilePayload = {
        ...firestoreData,
        uid: null, // UID se asignará en el primer login con Google
        lastLogin: null, // Se actualizará en el primer login
      };
      
      const docRef = await usersRef.add(userProfilePayload);

      return NextResponse.json({
        firestoreId: docRef.id,
        message: 'Perfil de usuario pre-creado. El usuario debe iniciar sesión con Google para activar la cuenta.'
      });
    }

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

