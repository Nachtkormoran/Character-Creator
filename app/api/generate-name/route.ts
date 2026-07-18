import { NextResponse } from "next/server";
import { getOpenAI, TEXT_MODEL } from "@/lib/openai";
import { buildNamePrompt } from "@/lib/prompts";
import { characterInputSchema, characterTraitsSchema } from "@/lib/schema";
import { z } from "zod";

/**
 * Die Merkmale sind optional: das Erstellen-Formular kennt nur seine
 * Vorgaben, die Galerie zusätzlich die fertige Merkmalstabelle.
 */
const bodySchema = z.object({
  input: characterInputSchema,
  traits: characterTraitsSchema.optional(),
});

export const runtime = "nodejs";

/**
 * Räumt die Antwort des Modells auf. Trotz klarer Anweisung kommt gelegentlich
 * ein Satzzeichen, ein Anführungszeichen oder eine zweite Zeile mit – das Feld
 * im Formular soll aber nur den Namen enthalten.
 */
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

    const openai = getOpenAI();

    // Bewusst `create` statt `parse` mit Structured Outputs: ein Name ist ein
    // einzelner String, das JSON-Schema drumherum wäre reiner Token-Aufschlag.
    // `max_tokens` deckelt zusätzlich den Fall, dass das Modell doch schwatzt.
    const completion = await openai.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Du erfindest Namen für Charaktere. Du antwortest ausschließlich mit dem Namen selbst.",
        },
        {
          role: "user",
          content: buildNamePrompt(parsed.data.input, parsed.data.traits),
        },
      ],
      // Hoch, damit wiederholtes Klicken auch wirklich verschiedene Namen
      // liefert – bei einer so kurzen Antwort ist das ungefährlich.
      temperature: 1.1,
      max_tokens: 24,
    });

    const name = cleanName(completion.choices[0]?.message.content ?? "");
    if (!name) {
      return NextResponse.json(
        { error: "Das Modell lieferte keinen Namen." },
        { status: 502 },
      );
    }

    return NextResponse.json({ name });
  } catch (err) {
    console.error("generate-name error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
