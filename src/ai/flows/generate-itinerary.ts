'use server';

export type GenerateItineraryInput = {
  userPrompt: string;
  contextData: string;
};

export type GenerateItineraryOutput = {
  itineraryText: string;
};

export async function generateItinerary(input: GenerateItineraryInput): Promise<GenerateItineraryOutput>

const prompt = `
Contexto de negocios disponibles: ${input.contextData}

Mensaje del usuario: "${input.userPrompt}"

Instrucciones EXTREMADAMENTE ESTRICTAS para tu respuesta:
1. Eres un concierge conversacional. Tu objetivo AHORA MISMO es solo saludar, empatizar y PREGUNTAR OBLIGATORIAMENTE la ubicación del usuario (ej. "¿Desde dónde nos escribes hoy?").
2. ESTÁ ESTRICTAMENTE PROHIBIDO recomendar lugares o dar números de teléfono.
3. TAXIS Y TRANSPORTE: Bajo ninguna circunstancia trates a un servicio de taxi (ej. Taxi Premium) como un lugar físico para "visitar" o "celebrar". Los taxis son solo para transportarse.
4. HAZ SOLO UNA (1) PREGUNTA CORTA. Está prohibido hacer preguntas compuestas o múltiples preguntas seguidas.
5. REGLA DE ORO: Tu respuesta no puede contener más de un signo de interrogación de cierre (?).
   - Ejemplo CORRECTO: "¡Feliz cumpleaños para él! 🎉 ¿Qué tipo de ambiente están buscando para celebrar?"
   - Ejemplo INCORRECTO: "¿Qué tipo de ambiente buscan y cuántas personas serán? ¿Quieren comer o rumbear?" (¡NO HAGAS ESTO!)
6. Sé empático, entusiasta y usa emojis. Tu respuesta debe ser muy corta (máximo 2 líneas). RESPONDE SIEMPRE EN ESPAÑOL.
  `;

try {
  method: 'POST',
    headers: {
    'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`
  },
  body: JSON.stringify({
    model: "llama-3.3-70b-versatile",
    messages: [
      { role: "system", content: "Eres el conserje VIP de SocioVIP, experto en experiencias exclusivas y atención personalizada paso a paso." },
      { role: "user", content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 1024
  })
});

if (!response.ok) {
  throw new Error("Groq API Error");
}

const data = await response.json();
return { itineraryText: data.choices?.[0]?.message?.content || "¡Estoy listo para ayudarte!" };

} catch (error: any) {
  console.error("Groq Itinerary Error:", error.message);
  return { itineraryText: "Dime qué tipo de experiencia buscas y te armaré el mejor plan." };
}
}
