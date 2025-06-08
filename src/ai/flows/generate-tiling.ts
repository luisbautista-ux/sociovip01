// src/ai/flows/generate-tiling.ts
'use server';

/**
 * @fileOverview Generates seamless tiling patterns from an uploaded image for QR code customization.
 *
 * - generateTiling - A function that handles the tiling generation process.
 * - GenerateTilingInput - The input type for the generateTiling function.
 * - GenerateTilingOutput - The return type for the generateTiling function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTilingInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A QR code image to tile, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateTilingInput = z.infer<typeof GenerateTilingInputSchema>;

const GenerateTilingOutputSchema = z.object({
  tiledImageDataUri: z
    .string()
    .describe("The data URI of the tiled image."),
});
export type GenerateTilingOutput = z.infer<typeof GenerateTilingOutputSchema>;

export async function generateTiling(input: GenerateTilingInput): Promise<GenerateTilingOutput> {
  return generateTilingFlow(input);
}

const imageTilingPrompt = ai.definePrompt({
  name: 'imageTilingPrompt',
  input: {schema: GenerateTilingInputSchema},
  output: {schema: GenerateTilingOutputSchema},
  prompt: `You are an AI that generates seamless tiling patterns from images for QR code customization.

  The goal is to create a visually consistent and aesthetically pleasing tiled image from the original image provided.

  Create a seamless tiling pattern using the uploaded image.

  Source Image: {{media url=imageDataUri}}
  `,
});

const generateTilingFlow = ai.defineFlow(
  {
    name: 'generateTilingFlow',
    inputSchema: GenerateTilingInputSchema,
    outputSchema: GenerateTilingOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-exp',
      prompt: [
        {media: {url: input.imageDataUri}},
        {text: 'generate a seamless tiling pattern from this image'},
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    return {tiledImageDataUri: media.url!};
  }
);
