
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { admin, adminDb } from '@/lib/firebase/firebaseAdmin';
import type { PlatformUser, Business, QrClient } from '@/lib/types';
import { headers } from 'next/headers';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function getCallerProfile(idToken: string): Promise<PlatformUser> {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userDoc = await adminDb.collection('platformUsers').doc(uid).get();
    if (!userDoc.exists) {
        throw new Error('Caller profile not found.');
    }
    return userDoc.data() as PlatformUser;
}

// Función para codificar correctamente el asunto para el header del email
function encodeSubject(subject: string) {
    const utf8Subject = Buffer.from(subject, 'utf-8').toString('base64');
    return `=?UTF-8?B?${utf8Subject}?=`;
}

export async function POST(request: Request) {
    const { recipientEmails, subject, body } = await request.json();

    const authorization = headers().get('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'User not authenticated. No token provided.' }, { status: 401 });
    }
    const idToken = authorization.split('Bearer ')[1];
    if (!idToken) {
        return NextResponse.json({ error: 'User not authenticated. Token is empty.' }, { status: 401 });
    }

    try {
        const caller = await getCallerProfile(idToken);
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
            return NextResponse.json({ error: 'Gmail account not connected for this business. Please connect it in the settings.' }, { status: 400 });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({ refresh_token: refreshToken });

        const { token: accessToken } = await oauth2Client.getAccessToken();
        if (!accessToken) {
            throw new Error("No se pudo obtener un nuevo token de acceso de Google.");
        }
        oauth2Client.setCredentials({ ...oauth2Client.credentials, access_token: accessToken });

        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
        
        const userInfo = await oauth2Client.getTokenInfo(accessToken);
        const senderEmail = userInfo.email;

        if (!senderEmail) {
            throw new Error("No se pudo obtener el email del remitente desde la cuenta de Google conectada.");
        }
        
        const emailPromises = recipientEmails.map(async (email: string) => {
            const clientName = "Socio"; // Saludo genérico
            
            const personalizedBody = body.replace(/\[Nombre\]/g, clientName);
            const personalizedSubject = subject.replace(/\[Nombre\]/g, clientName);

            const fromHeader = `"${businessData.name}" <${senderEmail}>`;
            
            // ✅ CORRECCIÓN: Se codifica el asunto para soportar caracteres especiales (UTF-8)
            const encodedSubject = encodeSubject(personalizedSubject);

            const rawMessage = [
                `From: ${fromHeader}`,
                `To: ${email}`,
                `Subject: ${encodedSubject}`, // Se usa el asunto codificado
                'Content-Type: text/html; charset=utf-8',
                'MIME-Version: 1.0',
                '',
                personalizedBody,
            ].join('\n');

            const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            
            return gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage,
                },
            });
        });

        await Promise.all(emailPromises);

        return NextResponse.json({ message: `Campaign sending initiated to ${recipientEmails.length} recipients.` });

    } catch (error: any) {
        console.error('Error detallado al enviar campaña de email:', error.response?.data?.error || error.message);
        
        const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to send email campaign.';
        const errorCode = error.response?.data?.error?.code;

        if (errorCode === 401 || (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('invalid_token'))) {
             return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
        }
        
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
