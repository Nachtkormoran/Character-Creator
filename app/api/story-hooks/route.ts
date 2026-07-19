import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI, TEXT_MODEL } from "@/lib/openai";
import { buildStoryHooksPrompt } from "@/lib/prompts";
import {
  DEFAULT_STORY_HOOK_ANCHOR,
  generatedCharacterSchema,
  storyHookAnchorSchema,
} from "@/lib/schema";

export const runtime = "nodejs";

/**
 * Drei Ansatzpunkte für eine Geschichte aus Beschreibung und Merkmalen.
 *
 * Wie die anderen Generierungs-Routen **persistiert diese nichts**: das
 * Ergebnis geht in das Textfeld der Galerie, wird dort gelesen, meist von Hand
 * nachgeschärft und erst mit „Änderungen speichern" abgelegt. Ein direktes
 * Schreiben in die Datenbank würde den vorherigen Stand überschreiben, bevor
 * jemand den neuen gesehen hat.
 *
 * Die Vorgaben aus dem Formular gehen bewusst **nicht** mit: was aus ihnen
 * geworden ist, steht längst im Text und in der Tabelle. Sie hier noch einmal
 * mitzuschicken hieße, den Wunsch neben das Ergebnis zu stellen.
 */
const bodySchema = z.object({
  character: generatedCharacterSchema,
  /** Wie fest die Ansatzpunkte am Charakter hängen sollen. */
  anchor: storyHookAnchorSchema.default(DEFAULT_STORY_HOOK_ANCHOR),
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

    const openai = getOpenAI();

    // Freitext statt Structured Outputs: das Ergebnis landet in einem
    // Textfeld und wird von Hand weitergeschrieben, nicht ausgewertet.
    const completion = await openai.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Du bist Dramaturg und Lektor. Du findest in Figuren die Stellen, an denen eine Geschichte ansetzen kann, und antwortest ausschließlich mit den Ansatzpunkten selbst.",
        },
        {
          role: "user",
          content: buildStoryHooksPrompt(
            parsed.data.character,
            parsed.data.anchor,
          ),
        },
      ],
      // Gefragt sind drei verschiedene Richtungen, und wiederholtes Klicken
      // soll etwas anderes bringen als beim ersten Mal. Bei „eng" aber
      // niedriger: dort ist der Vorrat an zulässigem Material klein (nur was
      // im Charakter steht), und hohe Temperatur wird dann zu genau dem
      // Ausweichen ins Erfundene, das die Stufe verhindern soll.
      temperature: parsed.data.anchor === "eng" ? 0.7 : 1.0,
      max_tokens: 900,
    });

    const ansatzpunkte = (completion.choices[0]?.message.content ?? "").trim();
    if (!ansatzpunkte) {
      return NextResponse.json(
        { error: "Das Modell lieferte keine Ansatzpunkte." },
        { status: 502 },
      );
    }

    return NextResponse.json({ ansatzpunkte });
  } catch (err) {
    console.error("story-hooks error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
