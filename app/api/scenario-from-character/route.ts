import { NextResponse } from "next/server";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getOpenAI, TEXT_MODEL } from "@/lib/openai";
import { buildScenarioFromCharacterPrompt } from "@/lib/prompts";
import { generatedCharacterSchema, scenarioDraftSchema } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * Ein **Szenario aus einem Charakter** ableiten – die Gegenrichtung zu
 * „Charakter für dieses Szenario anlegen".
 *
 * Der Charakter kommt **aus dem Request**, nicht über eine Id aus der
 * Datenbank. Das ist der Unterschied zu `scenario-plot`, und beide Male aus
 * demselben Grund entschieden: Dort geht es um die **Zuordnung** von Figuren
 * zu einem Szenario, und die gibt es nur gespeichert. Hier geht es um den
 * **Inhalt** eines Charakters, und der ist in der Detailansicht womöglich
 * gerade bearbeitet – wer eben den Beruf geändert hat und dann ableiten
 * lässt, meint den neuen. Dieselbe Überlegung wie bei `regenerate-text`.
 *
 * Anders als die übrigen Erzeugen-Routen liefert diese **Structured Output**
 * statt Freitext: es entstehen sechs verschiedene Felder, und das Genre muss
 * eine Id aus `GENRE_TEMPLATES` treffen. Das JSON-Schema ist hier also kein
 * Aufschlag, sondern das Mittel, das die Antwort ins vorhandene Vokabular
 * zwingt.
 *
 * **Persistiert nichts.** Der Vorschlag geht in eine Maske, wird dort geprüft
 * und geändert und erst mit „Szenario anlegen" über `POST /api/scenarios`
 * gespeichert. Ein Modellvorschlag ist nicht zwangsläufig gut, und ein
 * Szenario, das ungefragt entsteht, müsste man wieder löschen.
 */
const bodySchema = z.object({
  character: generatedCharacterSchema,
  storyHooks: z.string().trim().max(4000).optional().default(""),
  /** Nur das Setting-Feld der ursprünglichen Vorgaben – s. Prompt-Kommentar. */
  setting: z.string().trim().max(300).optional().default(""),
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

    const { character, storyHooks, setting } = parsed.data;
    const openai = getOpenAI();
    const prompt = buildScenarioFromCharacterPrompt(
      character,
      storyHooks,
      setting,
    );

    const versuch = () =>
      openai.chat.completions.parse({
        model: TEXT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Du bist ein erfahrener Autor und Weltenbauer. Du entwirfst Welten, die erklären, warum es die Menschen in ihnen gibt, und hältst dich streng an das, was über sie schon feststeht.",
          },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(scenarioDraftSchema, "szenario"),
        temperature: 0.8,
      });

    /**
     * **Kaputte Umlaute erkennen.** Beobachtet: Das Modell kodiert Umlaute
     * unter Structured Outputs gelegentlich als `\u`-Escape und verzählt
     * sich dabei bei den Hexziffern. Statt eines `ü` steht dann ein
     * NUL-Zeichen gefolgt von den Resten „fc" da – und es gehen zusätzlich
     * Buchstaben verloren („Nordküste" wird zu „Nordkfce"). Genau deshalb
     * lässt sich das **nicht reparieren**: die Zeichen sind weg, ein
     * Herausfiltern der NULs ergäbe nur lautlosen Kauderwelsch in der
     * Datenbank.
     *
     * Der Test lautet deshalb nicht „enthält NUL", sondern „enthält
     * irgendein Steuerzeichen": es ist dieselbe Ursache, und in einem
     * Szenariotext hat keines davon je etwas zu suchen. Zeilenumbruch und
     * Tabulator bleiben ausgenommen – die sind in den mehrzeiligen Feldern
     * legitim.
     */
    const kaputt = (d: object) =>
      Object.values(d).some(
        (v) => typeof v === "string" && /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(v),
      );

    let draft = (await versuch()).choices[0]?.message.parsed;
    // Ein zweiter Anlauf genügt: der Fehler ist sprunghaft, nicht systematisch.
    // Lieber ein weiterer Aufruf für Bruchteile eines Cents als ein Szenario
    // mit zerschossenen Umlauten, das man von Hand nachtippen müsste.
    if (draft && kaputt(draft)) {
      console.warn(
        "scenario-from-character: fehlerhafte Zeichenkodierung, zweiter Versuch.",
      );
      draft = (await versuch()).choices[0]?.message.parsed;
    }

    if (!draft) {
      return NextResponse.json(
        { error: "Das Modell lieferte keinen Vorschlag." },
        { status: 502 },
      );
    }
    if (kaputt(draft)) {
      return NextResponse.json(
        {
          error:
            "Der Vorschlag kam zweimal mit fehlerhaften Umlauten zurück. Bitte noch einmal ableiten.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ draft });
  } catch (err) {
    console.error("scenario-from-character error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
