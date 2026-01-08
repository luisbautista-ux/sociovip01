
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

    // Usar la plantilla predeterminada para la prueba.
    // Una vez que tu plantilla personalizada esté aprobada, cambiaremos esto.
    const TWILIO_TEMPLATE_SID = "HX5b83221aa281f6887745ceb886076dc8"; // SID de campana_bienvenida

    // Responder inmediatamente y procesar en segundo plano
    (async () => {
        let successCount = 0;
        let failureCount = 0;
        
        for (const clientData of clients) {
            try {
                // Para la prueba, enviamos el mensaje completo como el cuerpo.
                // Esto podría no funcionar si la plantilla espera variables específicas,
                // pero es la mejor aproximación para una prueba rápida.
                await client.messages.create({
                    contentSid: TWILIO_TEMPLATE_SID,
                    from: fromPhoneNumber,
                    to: `whatsapp:${clientData.phone}`,
                    contentVariables: JSON.stringify({
                        // Asumimos que la plantilla tiene una variable {{1}} para el cuerpo del mensaje.
                        // Si no la tiene, el mensaje llegará con el texto por defecto de la plantilla.
                        '1': clientData.message
                    })
                });
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 500)); 
            } catch (error: any) {
                failureCount++;
                console.error(`Failed to send message to ${clientData.phone}:`, error.message);
            }
        }
        console.log(`WhatsApp campaign finished. Success: ${successCount}, Failures: ${failureCount}`);
    })();

    return NextResponse.json({ success: true, message: `Campaña iniciada para ${clients.length} cliente(s) usando la plantilla de prueba. Los mensajes se están enviando en segundo plano.`, sentCount: clients.length });

  } catch (error: any) {
    console.error("API Error (send-whatsapp):", error);
    return NextResponse.json({ success: false, error: "Error al procesar la solicitud." }, { status: 500 });
  }
}
