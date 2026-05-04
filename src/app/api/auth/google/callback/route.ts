
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { admin, adminDb } from '@/lib/firebase/firebaseAdmin';

async function getUidFromIdToken(idToken: string): Promise<string> {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  
  // El token ahora viene en el parámetro 'state'
  const idToken = state ? decodeURIComponent(state) : null;

  if (!code) {
    return NextResponse.json({ error: 'Authorization code not found.' }, { status: 400 });
  }

  if (!idToken) {
    return NextResponse.json({ error: 'User not authenticated.' }, { status: 401 });
  }

  try {
    const uid = await getUidFromIdToken(idToken);
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
        // This can happen if the user has already granted consent and didn't re-consent ("offline" access type is key).
        console.warn("No refresh token received. This is expected if consent was already granted. The existing refresh token will be used if available.");
        // Redirect without updating, as we have nothing new to save.
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/business-panel/email-campaigns`);
    }

    const businessDocRef = adminDb.collection('businesses').doc(businessId);
    await businessDocRef.update({
        gmailRefreshToken: refresh_token,
    });

    // Redirect back to the email campaigns page upon success
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_BASE_URL}/business-panel/email-campaigns`);

  } catch (error: any) {
    console.error('Error during Google OAuth callback:', error);
    return NextResponse.json({ error: 'Failed to exchange authorization code.', details: error.message }, { status: 500 });
  }
}
