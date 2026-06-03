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
  businesses?: Partial<Business>[];
};

export async function chatWithBusiness(input: BusinessChatInput) {


  // Formateamos los datos para que incluyan el teléfono y la dirección exacta
  const promoList = input.promotions.map(p => `- [DIRECCIÓN EXACTA: ${(p as any).locationAddress || 'No especificada'} | UBICACIÓN GENERAL: ${(p as any).district || 'No especificado'}, ${(p as any).province || 'No especificado'}, ${(p as any).department || 'No especificado'}] | TIPO: ${(p as any).businessType} | NEGOCIO: "${(p as any).businessName}" | TELÉFONO: ${(p as any).businessPhone || 'No disponible'} | PROMOCIÓN: "${p.name}"`).join('\n');
  const eventList = input.events.map(e => `- [DIRECCIÓN EXACTA: ${(e as any).locationAddress || 'No especificada'} | UBICACIÓN GENERAL: ${(e as any).district || 'No especificado'}, ${(e as any).province || 'No especificado'}, ${(e as any).department || 'No especificado'}] | TIPO: ${(e as any).businessType} | NEGOCIO: "${(e as any).businessName}" | TELÉFONO: ${(e as any).businessPhone || 'No disponible'} | EVENTO: "${e.name}"`).join('\n');
  const businessList = (input.businesses || []).map(b => `- [DIRECCIÓN EXACTA: ${(b as any).publicAddress || 'No especificada'} | UBICACIÓN GENERAL: ${(b as any).district || 'No especificado'}, ${(b as any).province || 'No especificado'}, ${(b as any).department || 'No especificado'}] | TIPO: ${(b as any).businessType || 'Local'} | NEGOCIO: "${b.name}" | TELÉFONO: ${(b as any).businessPhone || 'No disponible'} | DESCRIPCIÓN: "${(b as any).description || ''}"`).join('\n');

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
3. VENDE LA EXPERIENCIA: Una vez completados los 4 pasos:
   - Identifica la ubicación del usuario (ej. Chincha o sus distritos).
   - Busca en "DATOS OFICIALES DE NEGOCIOS" y en "NEGOCIOS REGISTRADOS EN SOCIOVIP" los negocios que coincidan con la ubicación del usuario.
   - Si existen promociones o eventos oficiales activos en la sección "DATOS OFICIALES DE NEGOCIOS" para esa ubicación, recomiéndalos primero de forma atractiva.
   - Si no hay promociones/eventos activos para esa ubicación, o adicionalmente a ellos, recomienda de forma elegante y atractiva los negocios locales registrados de la sección "NEGOCIOS REGISTRADOS EN SOCIOVIP" que correspondan a dicha ubicación. Menciona siempre el nombre del negocio registrado explícitamente.
   - Si no hay absolutamente ningún negocio registrado en la ubicación del usuario, debes explicarle de manera muy educada y elegante que en este momento no contamos con socios registrados en esa zona específica, y sugerirle explorar otras zonas cercanas disponibles.
4. PROHIBICIÓN ABSOLUTA DE NEGOCIOS NO REGISTRADOS (REGLA CRÍTICA):
   - Está COMPLETAMENTE PROHIBIDO inventar, alucinar, sugerir, mencionar o recomendar cualquier negocio, hotel, resort, restaurante, bar, club, o atractivo turístico que NO esté explícitamente listado en las secciones "DATOS OFICIALES DE NEGOCIOS" o "NEGOCIOS REGISTRADOS EN SOCIOVIP" de este prompt.
   - No menciones actividades genéricas como "un resort de lujo con spa y golf" o "degustación de vinos" si no están asociadas directamente a un negocio que figure en la lista con su nombre comercial (por ejemplo: recomendar "Casa Hacienda San José" para hospedaje o "Tabernero" / "Viña Vieja" / "Descorchados" / "Amador Ballumbrosio" para experiencias y degustaciones en Chincha). Todo lo recomendado debe estar vinculado a un negocio registrado real de la lista.
5. TAXIS Y TRANSPORTE: Solo recomiéndalos según la lógica de ubicación (Chincha vs Otros Departamentos) una vez terminado el perfilamiento.
6. GEOGRAFÍA: Chincha Alta, Chincha Baja, Sunampe, Grocio Prado, Pueblo Nuevo, El Carmen, Tambo de Mora, Alto Larán son distritos de la provincia de CHINCHA, departamento de ICA. Cualquier negocio en estos distritos está en CHINCHA.
7. DIRECCIÓN EXACTA: Cuando el usuario solicite explícitamente la ubicación o dirección exacta de un negocio (ej: "necesito la ubicación exacta", "dónde queda exactamente"), DEBES proporcionarle obligatoriamente el valor del campo "DIRECCIÓN EXACTA" que figura en su respectivo registro en "NEGOCIOS REGISTRADOS EN SOCIOVIP" o "DATOS OFICIALES DE NEGOCIOS" (por ejemplo: "Cal. Carrizo Nro. Sn Bar. Porvenir..."), en lugar de solo mencionar el distrito, provincia o departamento.

DATOS OFICIALES DE NEGOCIOS:
${promoList}
${eventList}

NEGOCIOS REGISTRADOS EN SOCIOVIP:
${businessList}
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
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
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
