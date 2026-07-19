import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI, TEXT_MODEL } from "@/lib/openai";
import { buildRegenerateTextPrompt } from "@/lib/prompts";
import { characterInputSchema, generatedCharacterSchema } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * Den Beschreibungstext eines bestehenden Charakters neu erzeugen.
 *
 * Abgrenzung zu `/api/generate-text`: die Route dort erschafft einen ganzen
 * Charakter samt Name und Merkmalen. Hier ist der Charakter bereits vorhanden –
 * geliefert wird **nur** der Fließtext, und Name wie Merkmalstabelle bleiben,
 * wie sie sind. Deshalb auch kein Structured Output: die Antwort ist ein
 * einzelner Text, ein JSON-Schema drumherum wäre nur Aufschlag.
 *
 * Die Route **persistiert nichts**. Der neue Text landet im Bearbeitungs-Zustand
 * der Galerie und wird erst über „Änderungen speichern" übernommen – wer ihn
 * schlechter findet als den alten, verwirft ihn.
 */
const bodySchema = z.object({
  input: characterInputSchema,
  character: generatedCharacterSchema,
  /** Freier Zusatzwunsch aus der Oberfläche (Stil, Perspektive, Schwerpunkt). */
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

    const { input, character, zusatz } = parsed.data;
    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Du bist ein erfahrener Autor. Du schreibst Charakterbeschreibungen und antwortest ausschließlich mit dem Text selbst.",
        },
        {
          role: "user",
          content: buildRegenerateTextPrompt(input, character, zusatz),
        },
      ],
      // Wie bei der Erstgenerierung: der Text soll sich vom alten unterscheiden.
      temperature: 0.9,
      // Verlangt sind ca. 700–1000 Zeichen; der Puffer fängt ab, dass ein
      // Zusatzwunsch ("ausführlicher") das Modell länger schreiben lässt.
      max_tokens: 900,
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
    console.error("regenerate-text error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
