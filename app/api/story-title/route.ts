import { NextResponse } from "next/server";
import { getTextClient } from "@/lib/openai";
import { buildStoryTitlePrompt } from "@/lib/prompts";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * **Kurzer Titel** für einen Handlungsentwurf oder Story Arc – damit die
 * Reiter-Leiste einen wiedererkennbaren Namen trägt statt „Entwurf 1/2/3".
 *
 * Zuschnitt wie `generate-name`: **Freitext** (`chat.completions.create` mit
 * kleinem `max_tokens`), kein Structured Output – ein Titel ist ein String, ein
 * JSON-Schema wäre reiner Aufschlag. Läuft über `getTextClient()` (OpenAI oder
 * Gemini). **Persistiert nichts**; der Client hängt den Titel an die Variante.
 */
const bodySchema = z.object({
  // Der zu betitelnde Text: der Handlungsentwurf selbst bzw. eine Zusammenfassung
  // der Arc-Stationen. Großzügig gedeckelt (ein weitergesponnener Entwurf ist lang).
  text: z.string().trim().min(1).max(8000),
  art: z.enum(["entwurf", "arc"]).optional().default("entwurf"),
});

/** Räumt die Antwort auf – umschließende Anführungszeichen und Schlusspunkt weg. */
function cleanTitel(raw: string): string {
  return raw
    .split("\n")[0]
    .replace(/^["'„»«]+|["'“”»«.]+$/g, "")
    .trim()
    .slice(0, 120);
}

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

    const { text, art } = parsed.data;
    const { client: openai, model, extraParams } = await getTextClient();

    const completion = await openai.chat.completions.create({
      model,
      ...extraParams,
      messages: [
        {
          role: "system",
          content:
            "Du benennst Geschichten prägnant. Du antwortest ausschließlich mit dem Titel selbst.",
        },
        { role: "user", content: buildStoryTitlePrompt(text, art) },
      ],
      temperature: 0.7,
      // Ein Titel sind wenige Wörter; etwas Puffer für Umlaut-Tokens.
      max_tokens: 24,
    });

    const titel = cleanTitel(completion.choices[0]?.message.content ?? "");
    if (!titel) {
      return NextResponse.json(
        { error: "Das Modell lieferte keinen Titel." },
        { status: 502 },
      );
    }

    return NextResponse.json({ titel });
  } catch (err) {
    console.error("story-title error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
