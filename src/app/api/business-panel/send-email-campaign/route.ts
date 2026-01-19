
import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { admin, adminDb } from '@/lib/firebase/firebaseAdmin';
import type { PlatformUser, Business } from '@/lib/types';
import { headers } from 'next/headers';

async function getCallerProfile(idToken: string): Promise<PlatformUser> {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userDoc = await adminDb.collection('platformUsers').doc(uid).get();
    if (!userDoc.exists) {
        throw new Error('Caller profile not found.');
    }
    return userDoc.data() as PlatformUser;
}

function encodeSubject(subject: string) {
    const utf8Subject = Buffer.from(subject, 'utf-8').toString('base64');
    return `=?UTF-8?B?${utf8Subject}?=`;
}

// ✅ PLANTILLA HTML MEJORADA CON ESTILOS EN LÍNEA, GIF Y MEJOR DISEÑO
function createHtmlBody(
    messageBody: string, 
    businessName: string, 
    businessLogoUrl?: string, 
    primaryColor: string = '#8E5EA2', 
    secondaryColor: string = '#B080D0',
    businessUrl: string = 'https://sociovip.app'
): string {
    const finalBody = messageBody.replace(/\n/g, '<br>');
    const gifUrl = "https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExMjlnanA4cGhidjNocDBlOGRyZXJzN2NnbmRtNzUzaXZiM2Y3dWI2ciZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/5piDYylE9mTtri4E2E/giphy.gif";

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
            body { margin: 0; padding: 0; font-family: 'Poppins', Arial, sans-serif; background-color: #f4f7f6; color: #333; }
        </style>
      </head>
      <body style="background-color: #f4f7f6; margin: 0; padding: 0;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
          <div style="padding: 30px; text-align: center; background-image: linear-gradient(to right, ${primaryColor} 0%, ${secondaryColor} 100%); color: white;">
            ${businessLogoUrl ? `<img src="${businessLogoUrl}" alt="${businessName} Logo" style="max-width: 80px; height: auto; margin: 0 auto 16px; border-radius: 8px; background-color: rgba(255,255,255,0.9); padding: 5px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);" />` : ''}
            <h1 style="font-size: 28px; margin:0; font-weight: 700; text-shadow: 1px 1px 3px rgba(0,0,0,0.2);">${businessName}</h1>
          </div>
          <div style="padding: 30px;">
            <div style="text-align: center; margin-bottom: 25px;">
              <img src="${gifUrl}" alt="Animación festiva" style="max-width: 150px; height: auto; margin: 0 auto;" />
            </div>
            <p style="font-size: 16px; line-height: 1.7; color: #555; text-align: left;">${finalBody}</p>
            <p style="text-align:center; margin-top: 30px;">
              <a href="${businessUrl}" target="_blank" style="display: inline-block; padding: 14px 30px; text-align: center; text-transform: uppercase; transition: 0.5s; background-image: linear-gradient(to right, ${primaryColor} 0%, ${secondaryColor} 51%, ${primaryColor} 100%); background-size: 200% auto; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; letter-spacing: 0.5px; box-shadow: 0 4px 15px 0 rgba(142, 94, 162, 0.45);">Ver Promociones</a>
            </p>
          </div>
          <div style="padding: 20px; text-align: center; font-size: 12px; color: #999; background-color: #f8f9fa; border-top: 1px solid #e2e8f0;">
            Enviado desde la plataforma SocioVIP para ${businessName}.
          </div>
        </div>
      </body>
      </html>
    `;
}

export async function POST(request: Request) {
    const { recipients, subject, body } = await request.json();

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
        if (!businessDoc.exists()) {
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
        
        const emailPromises = recipients.map(async (recipient: { email: string; name: string }) => {
            const clientName = recipient.name.split(' ')[0] || 'Socio';
            
            const personalizedBody = body.replace(/\[Nombre\]/g, clientName);
            const personalizedSubject = subject.replace(/\[Nombre\]/g, clientName);
            
            const businessUrl = businessData.customUrlPath ? `https://sociovip.app/${businessData.customUrlPath}` : 'https://sociovip.app';
            const htmlBody = createHtmlBody(personalizedBody, businessData.name, businessData.logoUrl, businessData.primaryColor, businessData.secondaryColor, businessUrl);

            const fromHeader = `"${businessData.name}" <${senderEmail}>`;
            const encodedSubject = encodeSubject(personalizedSubject);

            const rawMessage = [
                `From: ${fromHeader}`,
                `To: ${recipient.email}`,
                `Subject: ${encodedSubject}`,
                'Content-Type: text/html; charset=utf-8',
                'MIME-Version: 1.0',
                '',
                htmlBody,
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

        return NextResponse.json({ message: `Campaign sending initiated to ${recipients.length} recipients.` });

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
