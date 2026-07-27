import { NextResponse } from "next/server";
import { z } from "zod";
import { getTextClient } from "@/lib/openai";
import { buildStoryHooksPrompt } from "@/lib/prompts";
import {
  DEFAULT_STORY_HOOK_ANCHOR,
  generatedCharacterSchema,
  storyHookAnchorSchema,
} from "@/lib/schema";

export const runtime = "nodejs";

/**
 * **Ein** Ansatzpunkt für eine Geschichte aus Beschreibung und Merkmalen.
 *
 * Einer je Aufruf, nicht drei: In der Galerie sind die Ansatzpunkte eine
 * Liste, aus der sich einzeln löschen lässt, und jeder Klick auf „Ableiten"
 * hängt einen an. Wer drei will, klickt dreimal – und behält dabei die zwei,
 * die getaugt haben.
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
  /**
   * Stichworte zur Richtung, optional. Wie die Stufe **nicht gespeichert**:
   * Beides beschreibt nichts am Charakter, sondern wie man ihn gerade befragen
   * will. Die Ansatzpunkte selbst hängen am Charakter und werden abgelegt, der
   * Weg zu ihnen nicht.
   */
  richtung: z.string().trim().max(500).optional().default(""),
  /**
   * Die bereits vorhandenen Ansatzpunkte – als **Ausschlussliste**, damit der
   * neue nicht die vorige Idee in anderen Worten wiederholt. Sie kommen aus
   * dem Client und nicht aus der Datenbank, weil die Liste dort ungespeichert
   * bearbeitet sein kann (dieselbe Regel wie bei `regenerate-text`): Wer eben
   * einen Ansatzpunkt gelöscht hat, meint die verbliebenen.
   */
  vorhandene: z.array(z.string().trim().max(2000)).max(20).optional().default([]),
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

    const { client: openai, model, extraParams } = await getTextClient();

    // Freitext statt Structured Outputs: das Ergebnis landet in einem
    // Textfeld und wird von Hand weitergeschrieben, nicht ausgewertet.
    const completion = await openai.chat.completions.create({
      model,
      ...extraParams,
      messages: [
        {
          role: "system",
          content:
            "Du bist Dramaturg und Lektor. Du findest in Figuren die Stellen, an denen eine Geschichte ansetzen kann, und antwortest ausschließlich mit dem Ansatzpunkt selbst.",
        },
        {
          role: "user",
          content: buildStoryHooksPrompt(
            parsed.data.character,
            parsed.data.anchor,
            parsed.data.richtung,
            parsed.data.vorhandene,
          ),
        },
      ],
      // Wiederholtes Klicken soll etwas anderes bringen als beim ersten Mal;
      // die Ausschlussliste im Prompt allein reicht dafür nicht. Bei „eng" aber
      // niedriger: dort ist der Vorrat an zulässigem Material klein (nur was
      // im Charakter steht), und hohe Temperatur wird dann zu genau dem
      // Ausweichen ins Erfundene, das die Stufe verhindern soll.
      temperature: parsed.data.anchor === "eng" ? 0.7 : 1.0,
      // Ein Ansatzpunkt von zwei bis vier Sätzen; vorher standen hier 900 für
      // drei. Großzügig gerundet, damit ein langer nicht mitten im Satz endet.
      max_tokens: 350,
    });

    const ansatzpunkte = (completion.choices[0]?.message?.content ?? "").trim();
    if (!ansatzpunkte) {
      return NextResponse.json(
        { error: "Das Modell lieferte keinen Ansatzpunkt." },
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
