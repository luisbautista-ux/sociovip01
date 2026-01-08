
import { NextResponse } from 'next/server';
import Twilio from 'twilio';

// Valida las credenciales de Twilio al iniciar
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromPhoneNumber) {
  console.error("Twilio credentials are not set in environment variables.");
}

const client = (accountSid && authToken) ? Twilio(accountSid, authToken) : null;

interface ClientPayload {
  phone: string;
  message: string;
}

export async function POST(request: Request) {
  if (!client) {
    return NextResponse.json({ success: false, error: "El servicio de envío no está configurado en el servidor." }, { status: 500 });
  }

  try {
    const { clients }: { clients: ClientPayload[] } = await request.json();

    if (!Array.isArray(clients) || clients.length === 0) {
      return NextResponse.json({ success: false, error: "No se proporcionó una lista de clientes válida." }, { status: 400 });
    }

    // Responder inmediatamente y procesar en segundo plano
    (async () => {
        let successCount = 0;
        let failureCount = 0;
        
        for (const clientData of clients) {
            try {
                // Asegúrate de que el número de teléfono esté en el formato E.164 (ej: +51987654321)
                // y que el número de Twilio esté en formato whatsapp:+...
                await client.messages.create({
                    from: fromPhoneNumber,
                    to: `whatsapp:${clientData.phone}`,
                    body: clientData.message,
                });
                successCount++;
                // Pausa corta para no saturar la API
                await new Promise(resolve => setTimeout(resolve, 500)); 
            } catch (error: any) {
                failureCount++;
                console.error(`Failed to send message to ${clientData.phone}:`, error.message);
            }
        }
        console.log(`WhatsApp campaign finished. Success: ${successCount}, Failures: ${failureCount}`);
    })();

    return NextResponse.json({ success: true, message: `Campaña iniciada para ${clients.length} cliente(s). Los mensajes se están enviando en segundo plano.`, sentCount: clients.length });

  } catch (error: any) {
    console.error("API Error (send-whatsapp):", error);
    return NextResponse.json({ success: false, error: "Error al procesar la solicitud." }, { status: 500 });
  }
}
