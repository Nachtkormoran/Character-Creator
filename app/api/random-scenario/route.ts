import { NextResponse } from "next/server";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { getTextClient, hatKaputteZeichen } from "@/lib/openai";
import { buildRandomScenarioPrompt } from "@/lib/prompts";
import {
  SCENARIO_MAXLENGTHS,
  scenarioDetailsSchema,
  randomScenarioSchema,
} from "@/lib/schema";

export const runtime = "nodejs";

/**
 * **Zufälliges Szenario:** füllt das Anlege-Formular auf einmal per KI – das
 * Gegenstück zu `random-input` beim Charakter.
 *
 * **Structured Output** (`randomScenarioSchema`), Umlaut-Wächter
 * (`hatKaputteZeichen`, rekursiv) plus **ein** Wiederholversuch, **persistiert
 * nichts**. Die Regel „bereits Ausgefülltes bleibt" wird **serverseitig
 * erzwungen**; Genre nur bei gesetzter Checkbox aus der Antwort. Der
 * **Handlungsentwurf** wird nicht erzeugt (er braucht Figuren) – ein im Request
 * vorhandener bleibt unverändert erhalten.
 */
const bodySchema = z.object({
  name: z.string().trim().max(80).optional().default(""),
  details: scenarioDetailsSchema,
  prompt: z.string().trim().max(1000).optional().default(""),
  // Genre auch zufällig wählen (Checkbox). Standard **false**: das gewählte
  // Genre bleibt fest, damit eine bewusste Wahl nicht grundlos kippt.
  genreWuerfeln: z.boolean().optional().default(false),
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

    const { name, details, prompt, genreWuerfeln } = parsed.data;
    const { client: openai, model, extraParams } = await getTextClient();

    const versuch = () =>
      openai.chat.completions.parse({
        model,
        ...extraParams,
        messages: [
          {
            role: "system",
            content:
              "Du bist Weltenbauer. Du erfindest vollständige, in sich stimmige Szenarien – Welten, in denen Geschichten spielen – und füllst damit ein Formular.",
          },
          {
            role: "user",
            content: buildRandomScenarioPrompt(
              name,
              details,
              prompt,
              genreWuerfeln,
            ),
          },
        ],
        response_format: zodResponseFormat(randomScenarioSchema, "szenario"),
        temperature: 1.0,
      });

    let ergebnis = (await versuch()).choices[0]?.message.parsed;
    if (ergebnis && hatKaputteZeichen(ergebnis)) {
      console.warn(
        "random-scenario: fehlerhafte Zeichenkodierung, zweiter Versuch.",
      );
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

    // Ein gesetztes Feld gewinnt gegen die Modellantwort; ein leeres wird
    // gefüllt. Danach auf die Feldgrenze gedeckelt (`SCENARIO_MAXLENGTHS`).
    const nimmDetail = (key: "ort" | "zeit" | "regeln" | "beschreibung") => {
      const orig = details[key].trim();
      const wert = orig || ergebnis![key].trim();
      return wert.slice(0, SCENARIO_MAXLENGTHS[key]);
    };

    const nameFinal = (name.trim() || ergebnis.name.trim()).slice(0, 80);

    return NextResponse.json({
      name: nameFinal,
      details: {
        // Genre nur bei Checkbox aus der Antwort, sonst bleibt das gewählte.
        genre: genreWuerfeln ? ergebnis.genre : details.genre,
        ort: nimmDetail("ort"),
        zeit: nimmDetail("zeit"),
        regeln: nimmDetail("regeln"),
        beschreibung: nimmDetail("beschreibung"),
        // Nicht erzeugt – ein vorhandener bleibt, sonst leer.
        handlung: details.handlung,
      },
    });
  } catch (err) {
    console.error("random-scenario error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
