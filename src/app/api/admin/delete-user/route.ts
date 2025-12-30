
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebase/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { headers } from 'next/headers';
import { z } from 'zod';

const DeleteUserSchema = z.object({
  uidToDelete: z.string().min(1, 'El UID del usuario a eliminar es requerido.'),
});

export async function POST(request: Request) {
  try {
    const adminAuth = admin.auth();
    const adminDb = admin.firestore();

    const authorization = headers().get('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autenticado. Token no proporcionado.' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const callerUid = decodedToken.uid;
    
    const callerDoc = await adminDb.collection('platformUsers').doc(callerUid).get();
    if (!callerDoc.exists || !callerDoc.data()?.roles.includes('superadmin')) {
        return NextResponse.json({ error: 'Permiso denegado. Se requiere rol de Super Administrador.' }, { status: 403 });
    }
    
    const body = await request.json();
    const validation = DeleteUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: 'Datos inválidos.', details: validation.error.flatten() }, { status: 400 });
    }
    
    const { uidToDelete } = validation.data;

    if (callerUid === uidToDelete) {
        return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta desde este panel.' }, { status: 400 });
    }
    
    const batch = adminDb.batch();

    await adminAuth.deleteUser(uidToDelete);

    const userProfileRef = adminDb.collection('platformUsers').doc(uidToDelete);
    batch.delete(userProfileRef);

    await batch.commit();

    return NextResponse.json({ success: true, message: `Usuario con UID ${uidToDelete} eliminado exitosamente.` });

  } catch (error: any) {
    console.error('API Route (delete-user): Error:', error);

    let errorMessage = 'Ocurrió un error interno al eliminar el usuario.';
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'El usuario no existe en Firebase Authentication.';
    } else if (error.message.includes('Permiso denegado')) {
      errorMessage = 'Permiso denegado. No tienes autorización para realizar esta acción.';
    }

    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: 500 }
    );
  }
}
