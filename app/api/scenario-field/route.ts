import { NextResponse } from "next/server";
import { z } from "zod";
import { getOpenAI, TEXT_MODEL } from "@/lib/openai";
import { buildScenarioFieldPrompt } from "@/lib/prompts";
import {
  SCENARIO_MAXLENGTHS,
  SCENARIO_READS,
  scenarioDetailsSchema,
  type ScenarioDetails,
} from "@/lib/schema";

export const runtime = "nodejs";

/**
 * Eine einzelne Festlegung eines Szenarios **ergänzen** – Ort, Zeit oder
 * Regeln.
 *
 * Die Gegenstück-Route zum Würfel: Der zieht aus festen Listen und weiß nicht,
 * was im Feld steht – „Berlin" und ein Dorfgasthof können nebeneinander landen.
 * Diese Route bekommt beides, den Feldinhalt und die Nachbarfelder, und kann
 * deshalb genau das, was eine Liste prinzipiell nicht kann.
 *
 * **Die Lese-Karte wird hier durchgesetzt, nicht im Client** (`SCENARIO_READS`,
 * Begründung dort): Der Client schickt die kompletten Festlegungen, und die
 * Route lässt nur die Felder in den Prompt, die oberhalb des erzeugten stehen.
 * So kann eine neue Aufrufstelle die Regel nicht versehentlich umgehen – und es
 * gibt genau einen Ort, an dem sie steht.
 *
 * Freitext statt Structured Output: Es entsteht ein einzelner Feldinhalt, der
 * in ein frei bearbeitbares Textfeld geht (dieselbe Überlegung wie bei
 * `scenario-description` und `story-hooks`). **Persistiert nichts** – das
 * Ergebnis landet im Formular und wird erst mit dem Szenario gespeichert.
 *
 * `beschreibung` und `handlung` gehören bewusst **nicht** hierher: Für die gibt
 * es eigene Routen mit eigenem Zuschnitt (die eine schreibt Fließtext, die
 * andere lädt die Charaktere des Szenarios).
 */
const bodySchema = z.object({
  feld: z.enum(["ort", "zeit", "regeln"]),
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

    const { feld, name, details, zusatz } = parsed.data;

    // Nur die erlaubten Nachbarfelder – alles andere sieht das Modell nicht.
    const umfeld: Partial<Record<string, string>> = {};
    for (const key of SCENARIO_READS[feld] ?? []) {
      const wert = details[key as keyof ScenarioDetails]?.trim();
      if (wert) umfeld[key] = wert;
    }

    const maxLen = SCENARIO_MAXLENGTHS[feld];

    // `max_tokens` als **harter Deckel** unter dem Zeichenlimit des Feldes: Der
    // Prompt bittet das Modell, unter `maxLen` zu bleiben (es zählt Zeichen aber
    // schlecht), dies stellt sicher, dass es die Grenze auch bei Ungehorsam
    // nicht weit reißen kann. Deutsch braucht grob 3 Zeichen je Token; damit ein
    // ganzes volles Feld noch hineinpasst, `maxLen / 3` plus etwas Luft, aber
    // gedeckelt (ein 4000-Zeichen-Regelfeld ist bereits gefüllt, wenn ergänzt
    // wird – dann bleibt für Neues ohnehin wenig).
    const maxTokens = Math.min(700, Math.ceil(maxLen / 3) + 80);

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Du bist ein erfahrener Autor und Weltenbauer. Du entwirfst Welten, die für viele Figuren zugleich Platz haben, und hältst dich streng an das, was über sie schon feststeht. Du antwortest ausschließlich mit dem Feldinhalt selbst.",
        },
        {
          role: "user",
          content: buildScenarioFieldPrompt(
            feld,
            name,
            umfeld,
            details[feld],
            zusatz,
            maxLen,
          ),
        },
      ],
      // Etwas kühler als bei der freien Beschreibung (0.9): Hier gibt es
      // Vorgaben, an die sich das Ergebnis halten muss – im Feld selbst und in
      // den Nachbarfeldern. Dieselbe Überlegung wie bei der Bindungsstufe
      // `eng` der Ansatzpunkte.
      temperature: 0.8,
      max_tokens: maxTokens,
    });

    let wert = (completion.choices[0]?.message.content ?? "").trim();

    // Letzte Absicherung: Trotz Prompt-Budget und `max_tokens` kann die Antwort
    // das Limit überschreiten (das Modell zählt Zeichen nicht zuverlässig). Statt
    // den Fehler bis zum Speichern durchzureichen, hier an einer Wortgrenze
    // beschneiden – das Formular zeigt die Länge ohnehin an, und ein knapp
    // gekürzter Text ist besser als eine abgewiesene Ergänzung.
    if (wert.length > maxLen) {
      const abschnitt = wert.slice(0, maxLen);
      const letzterUmbruch = Math.max(
        abschnitt.lastIndexOf("\n"),
        abschnitt.lastIndexOf(". "),
        abschnitt.lastIndexOf(" "),
      );
      wert = (
        letzterUmbruch > maxLen * 0.6
          ? abschnitt.slice(0, letzterUmbruch)
          : abschnitt
      ).trim();
    }
    if (!wert) {
      return NextResponse.json(
        { error: "Das Modell lieferte keinen Text." },
        { status: 502 },
      );
    }

    return NextResponse.json({ wert });
  } catch (err) {
    console.error("scenario-field error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
