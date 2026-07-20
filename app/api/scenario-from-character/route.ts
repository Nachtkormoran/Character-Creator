import { NextResponse } from "next/server";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getOpenAI, hatKaputteZeichen, TEXT_MODEL } from "@/lib/openai";
import { buildScenarioFromCharacterPrompt } from "@/lib/prompts";
import { generatedCharacterSchema, scenarioDraftSchema } from "@/lib/schema";
import { DEFAULT_GENRE, GENRE_TEMPLATES } from "@/lib/templates";

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
 * statt Freitext: es entstehen fünf verschiedene Felder, die getrennt in die
 * Maske müssen. Das JSON-Schema ist hier also kein Aufschlag, sondern das
 * Mittel, das die Antwort auseinanderhält.
 *
 * Das **Genre erzeugt das Modell nicht** – es kommt aus den Vorgaben des
 * Charakters und wird der Antwort hier angehängt. Es geht trotzdem in den
 * Prompt: als Vorgabe für Ort, Zeit und Regeln.
 *
 * **Persistiert nichts.** Der Vorschlag geht in eine Maske, wird dort geprüft
 * und geändert und erst mit „Szenario anlegen" über `POST /api/scenarios`
 * gespeichert. Ein Modellvorschlag ist nicht zwangsläufig gut, und ein
 * Szenario, das ungefragt entsteht, müsste man wieder löschen.
 */
const bodySchema = z.object({
  character: generatedCharacterSchema,
  // Dasselbe Limit wie im PATCH: Die Ansatzpunkte sind eine Liste, die
  // beliebig wachsen darf, und was sich speichern lässt, muss sich auch
  // ableiten lassen.
  storyHooks: z.string().trim().max(20000).optional().default(""),
  /** Nur das Setting-Feld der ursprünglichen Vorgaben – s. Prompt-Kommentar. */
  setting: z.string().trim().max(300).optional().default(""),
  /**
   * Das Genre des Charakters. Es **wird übernommen**, nicht erzeugt: Die Figur
   * wurde in diesem Genre angelegt, und die Welt um sie herum kann keine
   * andere sein. Fehlt es (Altbestand), fällt es wie überall auf Gegenwart
   * zurück.
   */
  genre: z.string().trim().max(40).optional().default(DEFAULT_GENRE),
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
    // Eine Id, die es nicht gibt, wäre in der Maske eine leere Auswahl – und
    // ließe später Würfel und Namenslisten ins Leere laufen.
    const genre = GENRE_TEMPLATES.some((g) => g.id === parsed.data.genre)
      ? parsed.data.genre
      : DEFAULT_GENRE;

    const openai = getOpenAI();
    const prompt = buildScenarioFromCharacterPrompt(
      character,
      storyHooks,
      setting,
      genre,
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

    // Kaputte Umlaute erkennen – Begründung an `hatKaputteZeichen`.
    const kaputt = hatKaputteZeichen;

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

    // Das Genre kommt aus dem Charakter, nicht aus der Modellantwort.
    return NextResponse.json({ draft: { ...draft, genre } });
  } catch (err) {
    console.error("scenario-from-character error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
