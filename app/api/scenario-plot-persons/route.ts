import { NextResponse } from "next/server";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getOpenAI, hatKaputteZeichen, TEXT_MODEL } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { buildPlotPersonsPrompt } from "@/lib/prompts";
import { plotPersonsSchema } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * Die **Personen aus einem Handlungsentwurf**, die dem Szenario noch nicht
 * zugeordnet sind.
 *
 * Der Handlungsentwurf entsteht aus den Figuren eines Szenarios und erfindet
 * dabei regelmäßig weitere – den Vorgesetzten, die Schwester, den Mann am
 * Hafen. Bis hierher war das eine Sackgasse: Die Person stand im Text, und wer
 * sie anlegen wollte, tippte alles von Hand ins Formular. Diese Route liefert
 * die Vorlage dafür.
 *
 * **Structured Output**, und damit erst die dritte Route im Projekt: Es
 * entsteht eine Liste von Objekten mit je sieben Feldern, die einzeln in die
 * Formularfelder müssen. Genau dafür ist das JSON-Schema da – anders als bei
 * `story-hooks`, wo ein Absatz Freitext in ein Textfeld geht.
 *
 * **Die zugeordneten Figuren lädt die Route selbst** über die `scenarioId` –
 * dieselbe Entscheidung wie bei `scenario-plot`, aus demselben Grund: Es geht
 * um die **Zuordnung**, und die gibt es nur gespeichert. Der Client müsste
 * sonst alle Namen mitschicken und hätte eine zweite Wahrheit darüber, wer
 * schon dabei ist.
 *
 * **Der Handlungsentwurf kommt dagegen aus dem Request.** Er kann in der
 * Detailansicht ungespeichert bearbeitet sein, und wer eben eine Person
 * hineingeschrieben hat, meint genau die – dieselbe Regel wie bei
 * `regenerate-text` und `scenario-plot`.
 *
 * **Persistiert nichts.** Das Ergebnis sind Vorschläge, aus denen der Nutzer
 * einen auswählt; angelegt wird der Charakter später über das Erstellen-
 * Formular, wo er die Vorgaben noch sieht und ändern kann.
 */
const bodySchema = z.object({
  scenarioId: z.string().min(1),
  // Großzügig bemessen: Der Handlungsentwurf ist das längste Feld eines
  // Szenarios und wächst mit der Zahl der Figuren.
  handlung: z.string().trim().min(1).max(20000),
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

    const { scenarioId, handlung } = parsed.data;

    // `name` ist in der Datenbank optional; ein namenloser Charakter taugt
    // weder als Ausschluss noch als Vergleich und fällt deshalb heraus.
    const zugeordnet = (
      await prisma.character.findMany({
        where: { scenarioId },
        select: { name: true },
        orderBy: { createdAt: "asc" },
      })
    )
      .map((c) => c.name?.trim() ?? "")
      .filter(Boolean);

    const openai = getOpenAI();
    const prompt = buildPlotPersonsPrompt(handlung, zugeordnet);

    const versuch = () =>
      openai.chat.completions.parse({
        model: TEXT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Du bist ein sorgfältiger Lektor. Du liest Texte und hältst genau fest, welche Personen darin vorkommen und was über sie dasteht – nicht mehr.",
          },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(plotPersonsSchema, "personen"),
        // Niedrig: Hier wird nichts erfunden, sondern ausgelesen. Was im
        // Entwurf steht, steht dort auch beim zweiten Aufruf.
        temperature: 0.2,
      });

    let ergebnis = (await versuch()).choices[0]?.message.parsed;
    // Ein zweiter Anlauf genügt – Begründung an `hatKaputteZeichen`.
    if (ergebnis && hatKaputteZeichen(ergebnis)) {
      console.warn(
        "scenario-plot-persons: fehlerhafte Zeichenkodierung, zweiter Versuch.",
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
            "Die Antwort kam zweimal mit fehlerhaften Umlauten zurück. Bitte noch einmal suchen.",
        },
        { status: 502 },
      );
    }

    /**
     * Letzte Sicherung gegen zwei Fehlleistungen des Modells, die beide
     * beobachtbar sind: eine Person ohne Namen (ohne den ließe sie sich im
     * Text nicht wiederfinden) und eine bereits zugeordnete Figur, die es
     * trotz Ausschlussliste in die Antwort schafft.
     *
     * Der Abgleich läuft über **ganze Namensteile**, nicht über
     * Teilzeichenketten: „Mira" und „Mira Lindqvist" teilen sich das Wort
     * „mira" und gelten als dieselbe Person, „Alva" und „Alvarez" dagegen
     * nicht – obwohl das eine im anderen steckt. Ein Vergleich auf
     * `includes` schlösse hier die falsche Figur aus, und zwar lautlos.
     *
     * Ein einzelnes gemeinsames Wort genügt, und das ist bewusst großzügig:
     * Zwei verschiedene Figuren namens „Anna" fielen darunter. Die feine
     * Zuordnung macht das Modell, das den Satzzusammenhang sieht; das hier ist
     * nur der Fangnetz-Fall, wenn es die Ausschlussliste übergeht.
     */
    const teile = (name: string) =>
      new Set(
        name
          .toLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .filter(Boolean),
      );
    const bekannt = zugeordnet.map(teile);
    const personen = ergebnis.personen.filter((p) => {
      const eigene = teile(p.name.trim());
      if (eigene.size === 0) return false;
      return !bekannt.some((b) => [...eigene].some((w) => b.has(w)));
    });

    return NextResponse.json({ personen });
  } catch (err) {
    console.error("scenario-plot-persons error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
