
import { NextResponse } from 'next/server';
import Twilio from 'twilio';

// Valida las credenciales de Twilio al iniciar
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !fromPhoneNumber) {
  console.error("Twilio credentials are not set in environment variables.");
}

const twilioClient = (accountSid && authToken) ? Twilio(accountSid, authToken) : null;

interface ClientPayload {
  phone: string;
  message: string;
}

export async function POST(request: Request) {
  if (!twilioClient) {
    return NextResponse.json({ success: false, error: "El servicio de envío de Twilio no está configurado en el servidor." }, { status: 500 });
  }

  try {
    const { clients }: { clients: ClientPayload[] } = await request.json();

    if (!Array.isArray(clients) || clients.length === 0) {
      return NextResponse.json({ success: false, error: "No se proporcionó una lista de clientes válida." }, { status: 400 });
    }

    let successCount = 0;
    const errors: { phone: string, message: string }[] = [];

    // Usamos Promise.all para procesar todos los envíos en paralelo
    await Promise.all(clients.map(async (clientData) => {
      try {
        const fullPhoneNumber = clientData.phone.startsWith('51') ? clientData.phone : `51${clientData.phone}`;
        
        // CORRECCIÓN: El Sandbox de Twilio NO usa `contentSid` para plantillas de prueba.
        // Se envía un `body` predefinido donde las variables se llenan con `contentVariables`.
        await twilioClient.messages.create({
            from: fromPhoneNumber,
            to: `whatsapp:+${fullPhoneNumber}`,
            // Este es el cuerpo de la plantilla de prueba del Sandbox. No se puede cambiar.
            // Las variables como `{{1}}` en este string se reemplazan con `contentVariables`.
            body: `Your appointment is coming up on {{1}} at {{2}}`,
            // Aquí inyectamos nuestro mensaje personalizado en la primera variable de la plantilla.
            contentVariables: JSON.stringify({
                '1': clientData.message, // Nuestro mensaje va aquí.
                '2': new Date().toLocaleTimeString('es-PE'), // La segunda variable necesita un valor, usamos la hora.
            }),
        });
        successCount++;
      } catch (error: any) {
        // Mejor log de error
        const errorMessage = `Fallo al enviar a ${clientData.phone}: ${error.message} (Code: ${error.code})`;
        console.error('Twilio Send Error:', errorMessage, error);
        errors.push({ phone: clientData.phone, message: error.message });
      }
    }));

    if (errors.length > 0) {
       return NextResponse.json({ 
        success: false, 
        message: `Campaña procesada con ${errors.length} error(es).`,
        sentCount: successCount,
        failedCount: errors.length,
        errors: errors.map(e => `A ${e.phone}: ${e.message}`),
      }, { status: 500 });
    }

    return NextResponse.json({ 
        success: true, 
        message: `Campaña completada. Se enviaron ${successCount} mensajes.`, 
        sentCount: successCount 
    });

  } catch (error: any) {
    // Error al procesar el cuerpo de la solicitud u otro error inesperado.
    console.error("API Route (send-whatsapp) - General Error:", error);
    return NextResponse.json({ success: false, error: `Error inesperado en el servidor: ${error.message}` }, { status: 500 });
  }
}
