"use server";

import type { Business, BusinessManagedEntity } from "@/lib/types";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type BusinessChatInput = {
  message: string;
  history: ChatMessage[];
  business: Partial<Business>;
  promotions: BusinessManagedEntity[];
  events: BusinessManagedEntity[];
};

export async function chatWithBusiness(input: BusinessChatInput) {


  // Formateamos los datos para que incluyan el teléfono
  const promoList = input.promotions.map(p => `- [UBICACIÓN: ${(p as any).district}, ${(p as any).province}, ${(p as any).department}] | TIPO: ${(p as any).businessType} | NEGOCIO: "${(p as any).businessName}" | TELÉFONO: ${(p as any).businessPhone || 'No disponible'} | PROMOCIÓN: "${p.name}"`).join('\n');
  const eventList = input.events.map(e => `- [UBICACIÓN: ${(e as any).district}, ${(e as any).province}, ${(e as any).department}] | TIPO: ${(e as any).businessType} | NEGOCIO: "${(e as any).businessName}" | TELÉFONO: ${(e as any).businessPhone || 'No disponible'} | EVENTO: "${e.name}"`).join('\n');

  const systemPrompt = `
Eres el AGENTE SOCIOVIP, un concierge de lujo experto en experiencias de alto nivel.
TU MISIÓN PRINCIPAL es guiar al usuario a través de un proceso de perfilamiento OBLIGATORIO de 4 PASOS antes de realizar cualquier recomendación.

PASOS OBLIGATORIOS (Sigue este orden estricto):
1. ORIGEN: Pregunta "¿Desde dónde nos escribes hoy?".
2. TIPO DE EXPERIENCIA (Múltiple): Presenta estas opciones:
   A: Fullday en pareja
   B: Fin de semana
   C: Viaje familiar
   D: Entretenimiento nocturno
   E: Restaurantes
   F: Eventos y ferias
   G: OTROS
3. GRUPO: Presenta estas opciones:
   A: Solo yo
   B: Yo +1
   C: 3 a 5
   D: +5
4. PRESUPUESTO: Presenta estas opciones:
   A: 50 a 200
   B: 201 a 400
   C: 401 a 700
   D: 701 a más

REGLA DE ORO DE FLUJO:
- NUNCA recomiendes un negocio hasta haber completado los 4 pasos.
- Si el usuario intenta saltarse un paso o pide recomendaciones antes de tiempo, recuérdale amablemente que necesitas completar su perfil VIP para darle la mejor experiencia.
- Mantén un tono extremadamente profesional, elegante y servicial.

DEBES RESPONDER ÚNICAMENTE EN FORMATO JSON VÁLIDO:
{
  "content": "Tu mensaje elegante...",
  "suggestions": ["Opción A", "Opción B"]
}

REGLAS DE DISEÑO DE RESPUESTA:
1. SUGERENCIAS: Crea EXACTAMENTE entre 2 y 4 sugerencias cortas que correspondan a las opciones del paso actual.
2. CERO "LORO": No repitas lo que el usuario acaba de decir.
3. VENDE LA EXPERIENCIA: Una vez completados los 4 pasos, cuando recomiendes, menciona atractivamente el evento o promoción oficial.
4. TAXIS Y TRANSPORTE: Solo recomiéndalos según la lógica de ubicación (Chincha vs Otros Departamentos) una vez terminado el perfilamiento.
5. GEOGRAFÍA: Sunampe, Grocio Prado, Pueblo Nuevo son parte de CHINCHA.

DATOS OFICIALES DE NEGOCIOS:
${promoList}
${eventList}
  `;

  const messages = [
    { role: "system", content: systemPrompt },
    ...input.history.map(m => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content
    })),
    { role: "user", content: input.message }
  ];

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) throw new Error("Error en Groq");

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;

    let parsedText = { content: "¡Hola! Soy tu Agente SocioVip. ¿En qué puedo ayudarte?", suggestions: [] as string[] };
    try {
      if (text) {
        parsedText = JSON.parse(text);
      }
    } catch (e) {
      console.error("Error parsing JSON from Groq:", e);
      parsedText = { content: text || parsedText.content, suggestions: [] };
    }

    return {
      content: parsedText.content,
      suggestions: parsedText.suggestions || []
    };
  } catch (error: any) {
    console.error("Groq Chat Error:", error.message);
    return { content: "Estamos experimentando mucha demanda, pero dime qué tipo de experiencia buscas.", suggestions: [] };
  }
}
