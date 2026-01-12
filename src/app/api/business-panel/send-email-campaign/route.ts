
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { adminDb } from '@/lib/firebase/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import type { PlatformUser, Business } from '@/lib/types';
import jsCookie from 'js-cookie';

async function getCallerProfile(idToken: string): Promise<PlatformUser> {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userDoc = await adminDb.collection('platformUsers').doc(uid).get();
    if (!userDoc.exists) {
        throw new Error('Caller profile not found.');
    }
    return userDoc.data() as PlatformUser;
}

export async function POST(request: Request) {
    const { recipientEmails, subject, body } = await request.json();

    const idTokenCookie = request.headers.get('cookie')?.split('; ').find(c => c.startsWith('idToken='))?.split('=')[1];
    if (!idTokenCookie) {
        return NextResponse.json({ error: 'User not authenticated.' }, { status: 401 });
    }

    try {
        const caller = await getCallerProfile(idTokenCookie);
        if (!caller.businessId) {
            return NextResponse.json({ error: 'User is not associated with a business.' }, { status: 403 });
        }

        const businessDoc = await adminDb.collection('businesses').doc(caller.businessId).get();
        if (!businessDoc.exists) {
            return NextResponse.json({ error: 'Business not found.' }, { status: 404 });
        }

        const businessData = businessDoc.data() as Business;
        const refreshToken = businessData.gmailRefreshToken;

        if (!refreshToken) {
            return NextResponse.json({ error: 'Gmail account not connected for this business.' }, { status: 400 });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const sendEmail = async (to: string) => {
            const rawMessage = [
                `From: "SocioVIP - ${businessData.name}" <me>`,
                `To: ${to}`,
                `Subject: ${subject}`,
                'Content-Type: text/html; charset=utf-8',
                'MIME-Version: 1.0',
                '',
                body,
            ].join('\n');

            const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            
            await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage,
                },
            });
        };
        
        // Don't await, send in background
        Promise.all(recipientEmails.map(sendEmail)).catch(err => {
            console.error("Error sending bulk emails:", err);
            // Optionally, log this failure to a specific collection in Firestore
        });

        return NextResponse.json({ message: `Campaign sending initiated to ${recipientEmails.length} recipients.` });

    } catch (error: any) {
        console.error('Error sending email campaign:', error);
        return NextResponse.json({ error: 'Failed to send email campaign.', details: error.message }, { status: 500 });
    }
}
