import { NextResponse } from "next/server";
import { z } from "zod";
import { getTextClient } from "@/lib/openai";
import { buildInputFieldPrompt, type InputField } from "@/lib/prompts";
import { characterInputSchema } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * Befüllt **ein** Formularfeld des Erstellen-Formulars per KI (Aussehen,
 * Persönlichkeit, Beruf, Hintergrund) – das schlaue Gegenstück zum Würfel. Wie
 * `generate-name` **Freitext** statt Structured Outputs: die Antwort ist ein
 * Feldinhalt, ein JSON-Schema drumherum wäre reiner Token-Aufschlag. Und wie
 * alle Erzeugen-Routen **persistiert sie nichts**.
 */
const bodySchema = z.object({
  feld: z.enum(["appearance", "personality", "occupation", "background"]),
  input: characterInputSchema,
});

/**
 * Zeichenbudget je Feld – am `max_tokens` bemessen und an den Schema-Grenzen
 * ausgerichtet (`characterInputSchema`: appearance 1500, personality 1000,
 * occupation 200, background 2000). Deutsch ~3 Zeichen/Token.
 */
const MAX_TOKENS: Record<InputField, number> = {
  appearance: 160,
  personality: 90,
  occupation: 24,
  background: 220,
};

const MAX_LEN: Record<InputField, number> = {
  appearance: 1500,
  personality: 1000,
  occupation: 200,
  background: 2000,
};

/**
 * Räumt die Antwort auf: umschließende Anführungszeichen und Aufzählungszeichen
 * weg, auf die Feldgrenze gedeckelt. Der Beruf ist einzeilig – nur die erste
 * Zeile und kein Schlusspunkt.
 */
function cleanValue(raw: string, feld: InputField): string {
  let v = raw.trim().replace(/^["'„»«]+|["'“”»«]+$/g, "").trim();
  if (feld === "occupation") {
    v = v.split("\n")[0].replace(/^[-*•\s]+/, "").replace(/[.\s]+$/, "").trim();
  }
  return v.slice(0, MAX_LEN[feld]);
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

    const { feld, input } = parsed.data;
    const { client: openai, model, extraParams } = await getTextClient();

    const completion = await openai.chat.completions.create({
      model,
      ...extraParams,
      messages: [
        {
          role: "system",
          content:
            "Du erfindest stimmige Details für Charaktere. Du antwortest ausschließlich mit dem verlangten Feldinhalt, ohne Vorrede.",
        },
        { role: "user", content: buildInputFieldPrompt(feld, input) },
      ],
      // Hoch, damit wiederholtes Klicken wirklich Varianten liefert – wie beim
      // Würfel, dessen Ersatz dieser Knopf ist.
      temperature: 1.0,
      max_tokens: MAX_TOKENS[feld],
    });

    const wert = cleanValue(completion.choices[0]?.message?.content ?? "", feld);
    if (!wert) {
      return NextResponse.json(
        { error: "Das Modell lieferte keinen Inhalt." },
        { status: 502 },
      );
    }

    return NextResponse.json({ wert });
  } catch (err) {
    console.error("generate-input-field error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
