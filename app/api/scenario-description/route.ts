import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI, TEXT_MODEL } from "@/lib/openai";
import { buildScenarioDescriptionPrompt } from "@/lib/prompts";
import { scenarioDetailsSchema } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * Beschreibung eines Szenarios erzeugen – aus seinen übrigen Festlegungen.
 *
 * Wie die anderen Generierungs-Routen **persistiert diese nichts**: der Text
 * geht in das Formularfeld und wird erst mit dem Szenario gespeichert. Ein
 * direktes Schreiben würde eine von Hand geschriebene Beschreibung ersetzen,
 * bevor jemand die neue gesehen hat.
 *
 * Der Name kommt getrennt mit, weil er keine Festlegung ist, sondern die
 * Identität des Szenarios – und im Prompt trotzdem hilft („Die Bucht von Vigo"
 * sagt etwas über den Ort, das im Ort-Feld vielleicht fehlt).
 */
const bodySchema = z.object({
  name: z.string().trim().max(80).optional().default(""),
  details: scenarioDetailsSchema,
  zusatz: z.string().trim().max(1000).optional().default(""),
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

    const { name, details, zusatz } = parsed.data;
    const openai = getOpenAI();

    // Freitext statt Structured Outputs: das Ergebnis ist ein einzelner Text
    // in einem frei bearbeitbaren Feld – dieselbe Überlegung wie bei
    // `regenerate-text` und `story-hooks`.
    const completion = await openai.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Du bist ein erfahrener Autor und Weltenbauer. Du beschreibst Schauplätze glaubwürdig und konkret und antwortest ausschließlich mit dem Text selbst.",
        },
        {
          role: "user",
          content: buildScenarioDescriptionPrompt(name, details, zusatz),
        },
      ],
      temperature: 0.9,
      // Verlangt sind ca. 600–900 Zeichen; Puffer für einen Zusatzwunsch,
      // der nach mehr verlangt.
      max_tokens: 800,
    });

    const beschreibung = (completion.choices[0]?.message.content ?? "").trim();
    if (!beschreibung) {
      return NextResponse.json(
        { error: "Das Modell lieferte keinen Text." },
        { status: 502 },
      );
    }

    return NextResponse.json({ beschreibung });
  } catch (err) {
    console.error("scenario-description error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
