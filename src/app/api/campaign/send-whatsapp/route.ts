
import { NextResponse } from 'next/server';
import Twilio from 'twilio';

// Valida las credenciales de Twilio al iniciar
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromPhoneNumber) {
  console.error("Twilio credentials are not set in environment variables.");
  // No bloquees el inicio del servidor, pero deja claro que Twilio no funcionará.
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

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (const clientData of clients) {
      try {
        const fullPhoneNumber = clientData.phone.startsWith('51') ? clientData.phone : `51${clientData.phone}`;
        
        await client.messages.create({
            from: fromPhoneNumber,
            to: `whatsapp:+${fullPhoneNumber}`,
            body: clientData.message,
        });
        successCount++;
        // Pausa corta para no saturar la API
        await new Promise(resolve => setTimeout(resolve, 500)); 
      } catch (error: any) {
        failureCount++;
        const errorMessage = `Fallo al enviar a ${clientData.phone}: ${error.message}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    }

    if (failureCount > 0) {
       return NextResponse.json({ 
        success: false, 
        message: `Campaña procesada con ${failureCount} error(es).`,
        sentCount: successCount,
        failedCount: failureCount,
        errors: errors,
      }, { status: 500 });
    }

    return NextResponse.json({ 
        success: true, 
        message: `Campaña completada. Mensajes enviados exitosamente a ${successCount} cliente(s).`, 
        sentCount: successCount 
    });

  } catch (error: any) {
    console.error("API Error (send-whatsapp):", error);
    return NextResponse.json({ success: false, error: "Error al procesar la solicitud." }, { status: 500 });
  }
}
