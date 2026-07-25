import { NextResponse } from "next/server";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { getTextClient, hatKaputteZeichen } from "@/lib/openai";
import { buildRandomInputPrompt } from "@/lib/prompts";
import { characterInputSchema, randomInputSchema } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * **Zufällige Figur:** füllt das *ganze* Erstellen-Formular auf einmal per KI –
 * das Gegenstück zu den einzelnen Feld-Knöpfen (`generate-input-field`), nur für
 * alle Felder zusammen und aus einer freien Themen-Vorgabe.
 *
 * **Structured Output** (`randomInputSchema`), weil viele Felder zugleich
 * entstehen, die einzeln ins Formular müssen – dieselbe Begründung wie bei
 * `scenario-from-character`. Derselbe Umlaut-Wächter (`hatKaputteZeichen`,
 * rekursiv) plus **ein** Wiederholversuch. **Persistiert nichts** – das Ergebnis
 * belegt das Formular, gespeichert wird erst beim Erstellen.
 *
 * Die Regel „bereits Ausgefülltes bleibt" wird **serverseitig erzwungen**: Ein
 * im Request gesetztes Textfeld gewinnt gegen die Modellantwort, egal was das
 * Modell liefert. Genre und (bei „egal") Geschlecht kommen dagegen aus der
 * Antwort – s. Prompt.
 */
const bodySchema = z.object({
  input: characterInputSchema,
  // Freie Themen-Vorgabe aus dem Modal. Leer = völliger Zufall.
  prompt: z.string().trim().max(1000).optional().default(""),
  // Genre auch zufällig wählen (Checkbox). Standard **false**: das im Formular
  // gewählte Genre bleibt fest – das Genre ist nie „leer", eine bewusste Wahl
  // soll also nicht grundlos kippen.
  genreWuerfeln: z.boolean().optional().default(false),
});

/** Feldgrenzen aus `characterInputSchema` – die Antwort wird darauf gedeckelt. */
const MAX_LEN = {
  name: 120,
  age: 60,
  ethnicity: 120,
  appearance: 1500,
  setting: 200,
  occupation: 200,
  background: 2000,
  personality: 1000,
  notes: 2000,
} as const;

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

    const { input, prompt, genreWuerfeln } = parsed.data;
    const { client: openai, model, extraParams } = await getTextClient();

    const versuch = () =>
      openai.chat.completions.parse({
        model,
        ...extraParams,
        messages: [
          {
            role: "system",
            content:
              "Du bist ein erfahrener Charakter-Designer. Du erfindest vollständige, in sich stimmige Figuren und füllst damit ein Formular.",
          },
          {
            role: "user",
            content: buildRandomInputPrompt(input, prompt, genreWuerfeln),
          },
        ],
        response_format: zodResponseFormat(randomInputSchema, "figur"),
        // Hoch, damit wiederholtes Ausfüllen wirklich verschiedene Figuren
        // liefert – wie beim Würfel, dessen Ersatz das hier ist.
        temperature: 1.0,
      });

    let ergebnis = (await versuch()).choices[0]?.message.parsed;
    if (ergebnis && hatKaputteZeichen(ergebnis)) {
      console.warn("random-input: fehlerhafte Zeichenkodierung, zweiter Versuch.");
      ergebnis = (await versuch()).choices[0]?.message.parsed;
    }

    if (!ergebnis) {
      return NextResponse.json(
        { error: "Das Modell lieferte keine Antwort." },
        { status: 502 },
      );
    }
    if (hatKaputteZeichen(ergebnis)) {
      return NextResponse.json(
        {
          error:
            "Die Antwort kam zweimal mit fehlerhaften Umlauten zurück. Bitte noch einmal erzeugen.",
        },
        { status: 502 },
      );
    }

    // Ein gesetztes Textfeld gewinnt gegen die Modellantwort (bereits
    // Ausgefülltes bleibt); ein leeres wird gefüllt. Danach auf die Feldgrenze
    // gedeckelt, damit das Ergebnis in `characterInputSchema` passt.
    const nimm = (key: keyof typeof MAX_LEN) => {
      const orig = (input[key] as string).trim();
      const wert = orig || (ergebnis![key as keyof typeof ergebnis] as string).trim();
      return wert.slice(0, MAX_LEN[key]);
    };

    const gefuellt = {
      // Genre: nur bei gesetzter Checkbox aus der Antwort, sonst bleibt das im
      // Formular gewählte fest (der Prompt hat es dem Modell ebenfalls gesagt,
      // hier wird es erzwungen). Geschlecht nur, wenn im Request „egal" stand.
      genre: genreWuerfeln ? ergebnis.genre : input.genre,
      gender: input.gender !== "egal" ? input.gender : ergebnis.gender,
      name: nimm("name"),
      age: nimm("age"),
      ethnicity: nimm("ethnicity"),
      appearance: nimm("appearance"),
      setting: nimm("setting"),
      occupation: nimm("occupation"),
      background: nimm("background"),
      personality: nimm("personality"),
      notes: nimm("notes"),
    };

    return NextResponse.json({ input: gefuellt });
  } catch (err) {
    console.error("random-input error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
