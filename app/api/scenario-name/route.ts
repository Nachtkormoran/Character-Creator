import { NextResponse } from "next/server";
import { z } from "zod";
import { getTextClient } from "@/lib/openai";
import { buildScenarioNamePrompt } from "@/lib/prompts";
import { scenarioDetailsSchema } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * **Name für ein Szenario** – aus seinen Welt-Feldern (Beschreibung, Ort, Zeit,
 * Regeln) einen kurzen, treffenden Namen ableiten, damit ein Szenario nicht
 * „Neues Szenario" heißen muss.
 *
 * Zuschnitt wie `story-title`/`generate-name`: **Freitext**
 * (`chat.completions.create` mit kleinem `max_tokens`), kein Structured Output –
 * ein Name ist ein String, ein JSON-Schema wäre reiner Aufschlag. Läuft über
 * `getTextClient()` (OpenAI, Gemini oder Mistral). **Persistiert nichts**; der
 * Client setzt den Namen ins Feld, gespeichert wird über „Änderungen speichern".
 *
 * Die Festlegungen kommen **aus dem Request** – in der Detailansicht können sie
 * ungespeichert bearbeitet sein (dieselbe Regel wie bei `scenario-image` und
 * `scenario-field`).
 */
const bodySchema = z.object({
  details: scenarioDetailsSchema,
});

/** Räumt die Antwort auf – umschließende Anführungszeichen und Schlusspunkt weg. */
function cleanName(raw: string): string {
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

    const { details } = parsed.data;
    const { client: openai, model, extraParams } = await getTextClient();

    const completion = await openai.chat.completions.create({
      model,
      ...extraParams,
      messages: [
        {
          role: "system",
          content:
            "Du benennst erdachte Welten prägnant. Du antwortest ausschließlich mit dem Namen selbst.",
        },
        { role: "user", content: buildScenarioNamePrompt(details) },
      ],
      temperature: 0.7,
      // Ein Name sind wenige Wörter; etwas Puffer für Umlaut-Tokens.
      max_tokens: 24,
    });

    const name = cleanName(completion.choices[0]?.message?.content ?? "");
    if (!name) {
      return NextResponse.json(
        { error: "Das Modell lieferte keinen Namen." },
        { status: 502 },
      );
    }

    return NextResponse.json({ name });
  } catch (err) {
    console.error("scenario-name error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
