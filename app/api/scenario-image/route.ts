import { NextResponse } from "next/server";
import { z } from "zod";
import { getImageProvider } from "@/lib/imageProvider";
import { buildScenarioImagePrompt } from "@/lib/prompts";
import { DEFAULT_IMAGE_STYLE, scenarioDetailsSchema } from "@/lib/schema";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";
// Bildgenerierung kann etwas dauern.
export const maxDuration = 120;

/**
 * Erzeugt das **Weltbild eines Szenarios** – einen Establishing-Shot des Ortes,
 * ohne Figuren. Das Gegenstück zu `generate-image`, nur für eine Welt statt
 * einen Menschen; entsprechend baut es den Prompt aus `ScenarioDetails` und
 * nicht aus Merkmalen.
 *
 * **Persistiert nichts** – wie alle Erzeugen-Routen. Das Ergebnis geht als
 * Data-URL zurück; gespeichert wird es erst über
 * `PUT /api/scenarios/[id]/image`. So kann man ein Bild ansehen und verwerfen,
 * ohne dass es am Szenario hängt.
 *
 * Die Festlegungen kommen **aus dem Request**, nicht über die Szenario-Id: in
 * der Detailansicht können sie ungespeichert bearbeitet sein, und wer gerade
 * den Ort umgeschrieben hat, meint den neuen (dieselbe Regel wie bei
 * `scenario-field` und `regenerate-text`).
 */
const bodySchema = z.object({
  details: scenarioDetailsSchema,
  imageStyle: z.string().default(DEFAULT_IMAGE_STYLE),
  extraPrompt: z.string().max(1000).optional(),
  // Stil-/Motivvorlagen als Data-URLs – wie bei `generate-image`.
  referenceImages: z
    .array(z.string().max(12_000_000))
    .max(4)
    .optional()
    .default([]),
});

export async function POST(request: Request) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungültige Eingaben.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { details, imageStyle, extraPrompt, referenceImages } = parsed.data;

    const prompt = buildScenarioImagePrompt(details, imageStyle, {
      extraPrompt,
    });

    const { imageModel, imageQuality } = await getSettings();
    const imageData = await getImageProvider().generatePortrait(prompt, {
      model: imageModel,
      quality: imageQuality,
      referenceImages,
    });

    return NextResponse.json({ imageData, imageModel, imageQuality });
  } catch (err) {
    console.error("scenario-image error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
