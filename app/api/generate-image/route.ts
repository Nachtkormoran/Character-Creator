import { NextResponse } from "next/server";
import { getImageProvider } from "@/lib/imageProvider";
import { buildImagePrompt } from "@/lib/prompts";
import { DEFAULT_IMAGE_STYLE, generatedCharacterSchema } from "@/lib/schema";
import { getSettings } from "@/lib/settings";
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
  // Zusätzlicher freier Text, der im Bild-Prompt berücksichtigt wird
  extraPrompt: z.string().max(1000).optional(),
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

    const {
      character,
      imageStyle,
      includeTraits,
      includeTextDetails,
      extraPrompt,
    } = parsed.data;

    const visualDetails = includeTextDetails
      ? await extractVisualDetails(character.beschreibung)
      : undefined;

    const prompt = buildImagePrompt(character, imageStyle, {
      includeTraits,
      visualDetails,
      extraPrompt,
    });
    // Modell und Qualität kommen aus den Einstellungen
    // (Default: gpt-image-1 / medium).
    const { imageModel, imageQuality } = await getSettings();
    const imageData = await getImageProvider().generatePortrait(
      prompt,
      imageModel,
      imageQuality,
    );

    return NextResponse.json({ imageData, imageModel, imageQuality });
  } catch (err) {
    console.error("generate-image error:", err);
    const message =
      err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
