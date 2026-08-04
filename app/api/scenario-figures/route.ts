import { NextResponse } from "next/server";
import { z } from "zod";
import { getTextClient } from "@/lib/openai";
import { figurenText } from "@/lib/figuren";
import { buildScenarioFiguresPrompt } from "@/lib/prompts";
import {
  SCENARIO_MAXLENGTHS,
  SCENARIO_READS,
  scenarioDetailsSchema,
  type ScenarioDetails,
} from "@/lib/schema";

export const runtime = "nodejs";

/**
 * Das Figuren-Feld eines Szenarios per KI **ergänzen** – ein Set von etwa drei
 * Figuren, passend zur ganzen Welt.
 *
 * Der Zuschnitt ist der von `scenario-field` (Ort/Zeit/Regeln), nur für die
 * Besetzung: Die **Lese-Karte** (`SCENARIO_READS.figuren`) entscheidet
 * serverseitig, welche Festlegungen in den Prompt dürfen – hier Genre, Ort,
 * Zeit, Regeln **und** Beschreibung. Das schon Vorhandene geht als **Vorgabe**
 * mit und bleibt erhalten; die neuen Figuren werden dazu passend erfunden.
 *
 * Freitext statt Structured Output (ein Feldinhalt fürs Textfeld), und wie alle
 * Erzeugen-Routen **persistiert sie nichts**.
 */
const bodySchema = z.object({
  name: z.string().trim().max(80).optional().default(""),
  details: scenarioDetailsSchema,
  zusatz: z.string().trim().max(1000).optional().default(""),
  // Wie viele Figuren erzeugt/ergänzt werden (Selektor am Feld). Gedeckelt,
  // damit ein zu großer Wunsch nicht das Feld-Limit sprengt.
  anzahl: z.number().int().min(1).max(8).optional().default(3),
  // Die schon angelegten Charaktere des Szenarios (Protagonisten markiert) –
  // gehen als Kontext mit, damit neue Figuren sich auf sie beziehen und sie
  // nicht doppeln. Aus dem Client (die Detailansicht kennt sie; im Anlege-
  // Formular ist die Liste leer). Gedeckelt gegen zu große Bodies.
  charaktere: z
    .array(
      z.object({
        name: z.string().trim().max(200),
        kurzbeschreibung: z.string().trim().max(500).optional().default(""),
        isProtagonist: z.boolean().optional().default(false),
      }),
    )
    .max(50)
    .optional()
    .default([]),
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

    const { name, details, zusatz, anzahl, charaktere } = parsed.data;

    // Nur die erlaubten Nachbarfelder – alles andere sieht das Modell nicht.
    const umfeld: Partial<Record<string, string>> = {};
    for (const key of SCENARIO_READS.figuren ?? []) {
      const wert = details[key as keyof ScenarioDetails]?.trim();
      if (wert) umfeld[key] = wert;
    }

    const maxLen = SCENARIO_MAXLENGTHS.figuren;
    // Die ganze Antwort (Vorhandenes + Neues) muss ins Feld passen. Deutsch
    // ~3 Zeichen/Token; damit auch ein fast volles Feld echobar bleibt, großzügig
    // bemessen, aber gedeckelt.
    const maxTokens = Math.min(1100, Math.ceil(maxLen / 3) + 120);

    const { client: openai, model, extraParams } = await getTextClient();
    const completion = await openai.chat.completions.create({
      model,
      ...extraParams,
      messages: [
        {
          role: "system",
          content:
            "Du bist ein erfahrener Autor und Weltenbauer. Du erfindest Figuren, die zu einer feststehenden Welt und zueinander passen und Reibung bergen. Du antwortest ausschließlich mit den Figuren-Zeilen selbst.",
        },
        {
          role: "user",
          content: buildScenarioFiguresPrompt(
            name,
            umfeld,
            // Ohne Aktiv-Markup: Das Modell soll die Figuren als reinen Text
            // sehen und fortschreiben, nicht das `⊘ `-Präfix mitschleppen.
            figurenText(details.figuren),
            zusatz,
            maxLen,
            anzahl,
            charaktere,
          ),
        },
      ],
      // Etwas wärmer als beim strengen Feld-Ergänzen (0.8): Figuren dürfen
      // überraschen, bleiben aber an die Welt gebunden.
      temperature: 0.9,
      max_tokens: maxTokens,
    });

    let wert = (completion.choices[0]?.message?.content ?? "").trim();

    // Letzte Absicherung wie bei `scenario-field`: an einer Zeilen-/Wortgrenze
    // kürzen, falls die Antwort das Limit doch reißt – besser knapp als beim
    // Speichern abgewiesen.
    if (wert.length > maxLen) {
      const abschnitt = wert.slice(0, maxLen);
      const grenze = Math.max(
        abschnitt.lastIndexOf("\n"),
        abschnitt.lastIndexOf(". "),
        abschnitt.lastIndexOf(" "),
      );
      wert = (grenze > maxLen * 0.6 ? abschnitt.slice(0, grenze) : abschnitt).trim();
    }
    if (!wert) {
      return NextResponse.json(
        { error: "Das Modell lieferte keine Figuren." },
        { status: 502 },
      );
    }

    return NextResponse.json({ wert });
  } catch (err) {
    console.error("scenario-figures error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
