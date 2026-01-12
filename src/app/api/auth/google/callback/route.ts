
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { admin, adminDb } from '@/lib/firebase/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';

async function getUidFromIdToken(idToken: string): Promise<string> {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const idTokenCookie = request.headers.get('cookie')?.split('; ').find(c => c.startsWith('idToken='))?.split('=')[1];

  if (!code) {
    return NextResponse.json({ error: 'Authorization code not found.' }, { status: 400 });
  }

  if (!idTokenCookie) {
    return NextResponse.json({ error: 'User not authenticated.' }, { status: 401 });
  }

  try {
    const uid = await getUidFromIdToken(idTokenCookie);
    const userDocRef = adminDb.collection('platformUsers').doc(uid);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists || !userDoc.data()?.businessId) {
        return NextResponse.json({ error: 'User profile or business ID not found.' }, { status: 404 });
    }
    const businessId = userDoc.data()?.businessId;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/google/callback`
    );
    
    const { tokens } = await oauth2Client.getToken(code);
    const { refresh_token } = tokens;

    if (!refresh_token) {
        // This happens if the user has already granted consent before and didn't re-consent.
        // It's not a fatal error if we already have a token.
        console.warn("No refresh token received. User might have already granted consent.");
    }

    const businessDocRef = adminDb.collection('businesses').doc(businessId);
    await businessDocRef.update({
        gmailRefreshToken: refresh_token || admin.firestore.FieldValue.delete(),
    });

    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/business-panel/email-campaigns`);

  } catch (error: any) {
    console.error('Error during Google OAuth callback:', error);
    return NextResponse.json({ error: 'Failed to exchange authorization code.', details: error.message }, { status: 500 });
  }
}
