
import {NextResponse} from 'next/server';
import {ai} from '@/ai/genkit';
import {defineFlow} from 'genkit';
import {z} from 'genkit';
import {GenerateTilingInput, GenerateTilingOutput} from '@/ai/flows/generate-tiling';


// This is the definition of the generateTilingFlow from src/ai/flows/generate-tiling.ts
// It's duplicated here because the original file seems to export the flow already defined.
// If generateTiling from '@/ai/flows/generate-tiling' is the actual flow, we should use that.
// Assuming generateTiling is the function that *runs* the flow, and we need to expose the flow *definition*.

// Let's check if the imported generateTiling is actually the flow object or the runner function.
// The provided src/ai/flows/generate-tiling.ts defines and exports `generateTilingFlow`.
// It also exports a function `generateTiling` that calls `generateTilingFlow`.
// So we need to import `generateTilingFlow` itself if it's exported, or redefine it here.
// Based on the existing `dev.ts` which imports '@/ai/flows/generate-tiling.ts',
// it seems the flows are registered globally upon import.

// For the API route, we need a list of flow *definitions*.
// If `generateTilingFlow` is not directly exportable or accessible in a clean way,
// we might need to slightly adjust how flows are structured or registered for API exposure.

// Let's assume `generateTilingFlow` is available as expected, either by direct import
// or because importing '@/ai/flows/generate-tiling.ts' in `dev.ts` makes it available
// via a Genkit registry (which is typical for Genkit).

// If `ai.registry.lookup('flow', 'generateTilingFlow')` works after the import in `dev.ts`,
// that would be the cleanest. Otherwise, direct import or re-definition is needed.

// Re-defining for clarity based on the provided flow file, ensuring schema names match.
const GenerateTilingInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A QR code image to tile, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
const GenerateTilingOutputSchema = z.object({
  tiledImageDataUri: z
    .string()
    .describe("The data URI of the tiled image."),
});

const generateTilingFlowForApi = ai.defineFlow(
  {
    name: 'generateTilingFlow', // Name must match the one used in the application
    inputSchema: GenerateTilingInputSchema, // Use the redefined schema
    outputSchema: GenerateTilingOutputSchema, // Use the redefined schema
  },
  async (input: z.infer<typeof GenerateTilingInputSchema>) => {
    // This is the core logic of the flow, duplicated from src/ai/flows/generate-tiling.ts
    // In a real scenario, you'd call the actual flow execution logic here if it's separate.
    // For now, replicating the logic:
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp', // Ensure model is consistent
      prompt: [
        {media: {url: input.imageDataUri}},
        {text: 'generate a seamless tiling pattern from this image'},
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'], // Important for image output
      },
    });

    if (!media || !media.url) {
        throw new Error("AI did not return media URL for tiled image.");
    }
    return {tiledImageDataUri: media.url};
  }
);


const list = [
  generateTilingFlowForApi,
  // Add other flows here if any
];

export function GET(req: Request, {params}: {params: {flow: string[]}}) {
  const id = params.flow?.join('/');
  const found = list.find(f => f.name === id);
  if (!found) {
    return NextResponse.json({error: 'not found'}, {status: 404});
  }
  return NextResponse.json(found.toJSON());
}

export async function POST(req: Request, {params}: {params: {flow: string[]}}) {
  const id = params.flow.join('/');
  const found = list.find(f => f.name === id);
  if (!found) {
    return NextResponse.json({error: 'not found'}, {status: 404});
  }
  const input = await req.json();
  try {
    const result = await found.run(input);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({error: e.message, details: e.stack}, {status: 500});
  }
}

export async function OPTIONS(req: Request) {
  return NextResponse.json(list.map(f => f.name));
}

// Ensure that the actual flow logic in src/ai/flows/generate-tiling.ts
// is consistent with what's defined here if this route is meant to expose it.
// Ideally, the flow definition itself should be imported to avoid duplication.
// However, the structure `import '@/ai/flows/generate-tiling.ts'` in dev.ts suggests
// flows are registered globally, and this API route might be part of a standard Genkit setup
// for listing and running flows.
