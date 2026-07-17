import { NextResponse } from "next/server";
import { getImageProvider } from "@/lib/imageProvider";
import { buildImagePrompt } from "@/lib/prompts";
import { DEFAULT_IMAGE_STYLE, generatedCharacterSchema } from "@/lib/schema";
import { extractVisualDetails } from "@/lib/visualDetails";
import { z } from "zod";

export const runtime = "nodejs";
// Bildgenerierung kann etwas dauern.
export const maxDuration = 120;

const bodySchema = z.object({
  character: generatedCharacterSchema,
  imageStyle: z.string().default(DEFAULT_IMAGE_STYLE),
  // Körpermerkmale in den Bild-Prompt aufnehmen
  includeTraits: z.boolean().default(true),
  // Visuelle Details aus dem Fließtext extrahieren und aufnehmen
  includeTextDetails: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungültige Eingaben.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { character, imageStyle, includeTraits, includeTextDetails } =
      parsed.data;

    const visualDetails = includeTextDetails
      ? await extractVisualDetails(character.beschreibung)
      : undefined;

    const prompt = buildImagePrompt(character, imageStyle, {
      includeTraits,
      visualDetails,
    });
    const imageData = await getImageProvider().generatePortrait(prompt);

    return NextResponse.json({ imageData });
  } catch (err) {
    console.error("generate-image error:", err);
    const message =
      err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
