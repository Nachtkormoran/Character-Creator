import { NextResponse } from "next/server";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getTextClient, hatKaputteZeichen } from "@/lib/openai";
import { buildStoryArcChaptersPrompt, type PlotCharacter } from "@/lib/prompts";
import {
  DEFAULT_KAPITEL_COUNT,
  KAPITEL_COUNTS,
  kapitelListeSchema,
  kapitelSpanne,
  MAX_KAPITEL_PRO_STUFE,
  normalizeTraits,
  splitKapitelSegmente,
} from "@/lib/schema";
import { prisma } from "@/lib/prisma";
import { randomSparks } from "@/lib/storyArcSparks";

export const runtime = "nodejs";

/**
 * Die **Kapitel einer Story-Arc-Station** – zwei bis drei, jedes mit
 * Überschrift und zwei bis drei Sätzen.
 *
 * Bewusst **eigenständig und ohne DB-Zugriff**: Kapitel sind die Zerlegung des
 * Stationstexts, eine Ebene unter dem Akt – nicht der Besetzung. Die Station
 * trägt Beschreibung und beteiligte Figuren schon in sich, also kommt sie
 * **aus dem Request** (sie kann in der Detailansicht ungespeichert bearbeitet
 * sein). Anders als `scenario-arc` braucht diese Route weder `scenarioId` noch
 * die Charaktere.
 *
 * **Structured Output** (eine Liste von Objekten mit je zwei Feldern) mit
 * demselben Umlaut-Wächter (`hatKaputteZeichen`, rekursiv) plus **einem**
 * Wiederholversuch wie die anderen Structured-Routen. **Persistiert nichts** –
 * die Kapitel gehen in den Bearbeitungs-Zustand und werden über „Änderungen
 * speichern" mit dem Arc abgelegt.
 */
const bodySchema = z.object({
  stufe: z.object({
    titel: z.string().trim().max(200).optional().default(""),
    beschreibung: z.string().trim().min(1).max(5000),
    figuren: z.array(z.string().trim().max(120)).max(30).optional().default([]),
  }),
  // „kreativ": längere, ausgemalte Kapitel mit erlaubter Detailerfindung plus
  // zufällige Impulse; die Temperatur steigt.
  kreativ: z.boolean().optional().default(false),
  // Wie viele Kapitel erzeugt werden (Spanne) – wie die Arc-Länge nicht
  // gespeichert.
  anzahl: z
    .enum(KAPITEL_COUNTS.map((k) => k.value) as [string, ...string[]])
    .optional()
    .default(DEFAULT_KAPITEL_COUNT),
  // Ton und Sprache – als String ohne Allowlist (unbekannt = kein Ton-Block).
  ton: z.string().trim().max(40).optional().default(""),
  // Erzählform (Krimi, Liebe, …) – als String ohne Allowlist.
  form: z.string().trim().max(40).optional().default(""),
  // Modell-Anbieter für **diesen** Aufruf (Selektor beim Story Arc – gilt auch
  // für die Kapitelableitung). Leer/unbekannt → die Einstellung greift.
  textProvider: z.string().trim().max(40).optional().default(""),
  // **Volle Besetzung heranziehen** (Checkbox): dann lädt die Route die
  // Charaktere des Szenarios (wie `scenario-arc`) und gibt sie samt Figuren-
  // Notizen in den Prompt. Ohne das arbeitet die Ableitung wie bisher allein aus
  // der Station. Braucht dann die `scenarioId`; `figurenNotizen` = `details.figuren`.
  mitBesetzung: z.boolean().optional().default(false),
  scenarioId: z.string().min(1).optional(),
  figurenNotizen: z.string().trim().max(3000).optional().default(""),
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

    const {
      stufe,
      kreativ,
      anzahl,
      ton,
      form,
      textProvider,
      mitBesetzung,
      scenarioId,
      figurenNotizen,
    } = parsed.data;
    const { min, max } = kapitelSpanne(anzahl);

    // Volle Besetzung (opt-in): die Charaktere des Szenarios laden – wie
    // `scenario-arc` – und samt Figuren-Notizen in den Prompt geben. Ohne die
    // Checkbox bleibt `besetzung` undefined und die Ableitung arbeitet wie bisher
    // allein aus der Station.
    let besetzung: { characters: PlotCharacter[]; figuren: string } | undefined;
    if (mitBesetzung && scenarioId) {
      const rows = await prisma.character.findMany({
        where: { scenarioId },
        orderBy: { createdAt: "asc" },
        select: {
          name: true,
          shortDescription: true,
          description: true,
          traits: true,
          storyHooks: true,
          isProtagonist: true,
        },
      });
      const characters: PlotCharacter[] = rows.map((r) => ({
        name: r.name ?? "",
        kurzbeschreibung: r.shortDescription ?? "",
        beschreibung: r.description,
        merkmale: normalizeTraits(JSON.parse(r.traits)),
        storyHooks: r.storyHooks ?? "",
        isProtagonist: r.isProtagonist,
      }));
      besetzung = { characters, figuren: figurenNotizen };
    }

    // Kapitelgrenzen (`---`) in der Beschreibung → feste Abschnitte. Ab zwei
    // Abschnitten gilt der Segment-Modus: genau ein Kapitel je Abschnitt, die
    // gewählte Kapitelzahl wird ignoriert. Auf die Speichergrenze gedeckelt.
    const segmente = splitKapitelSegmente(stufe.beschreibung).slice(
      0,
      MAX_KAPITEL_PRO_STUFE,
    );
    const segmentModus = segmente.length >= 2;
    // Wie viele Kapitel am Ende höchstens durchgelassen werden: im Segment-Modus
    // genau die Abschnittszahl, sonst die Obergrenze der gewählten Spanne.
    const effektivMax = segmentModus ? segmente.length : max;

    // Jede Kapitel-Zusammenfassung soll ausführlich sein – mindestens 450
    // Zeichen. Wie die Stationen-Mindestlänge (`MIN_STUFE_LEN`) dreifach
    // abgesichert: Prompt als prüfbarer Endzustand, Feld-`describe()` und – hier
    // – ein Wiederholversuch, der zu kurze Kapitel zählt.
    const MIN_KAPITEL_LEN = 450;

    const { client: openai, model, extraParams } =
      await getTextClient(textProvider, "chapters");
    const prompt = buildStoryArcChaptersPrompt(stufe, {
      kreativ,
      sparks: kreativ ? randomSparks(1, 2) : undefined,
      min,
      max,
      ton,
      form,
      minZeichen: MIN_KAPITEL_LEN,
      segmente,
      besetzung,
    });

    const versuch = () =>
      openai.chat.completions.parse({
        model,
        ...extraParams,
        messages: [
          {
            role: "system",
            content:
              "Du bist Dramaturg. Du gliederst eine gegebene Station in ihre Kapitel – du erfindest nichts Neues, sondern teilst das Vorhandene feiner auf.",
          },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(kapitelListeSchema, "kapitel"),
        // Bei „kreativ" höher, damit die Ausarbeitung auch Farbe bekommt.
        temperature: kreativ ? 0.9 : 0.5,
      });

    // Zählt Kapitel mit zu kurzer Zusammenfassung (< MIN_KAPITEL_LEN Zeichen).
    const zuKurz = (e: z.infer<typeof kapitelListeSchema>) =>
      e.kapitel.filter((k) => k.inhalt.trim().length < MIN_KAPITEL_LEN).length;

    let ergebnis = (await versuch()).choices[0]?.message.parsed;
    // Ein Wiederholversuch bei kaputten Umlauten **oder** wenn ein Kapitel zu
    // kurz ist. Danach die bessere Antwort behalten: kaputte Zeichen sind
    // unbrauchbar und schlagen die Längenfrage, sonst gewinnt die mit weniger
    // zu kurzen Kapiteln (bei Gleichstand bleibt die erste).
    if (ergebnis && (hatKaputteZeichen(ergebnis) || zuKurz(ergebnis) > 0)) {
      console.warn(
        "story-arc-chapters: Nachbesserung nötig (kaputte Zeichen oder Kapitel < 450 Zeichen), zweiter Versuch.",
      );
      const zweit = (await versuch()).choices[0]?.message.parsed;
      if (zweit) {
        const erstKaputt = hatKaputteZeichen(ergebnis);
        const zweitKaputt = hatKaputteZeichen(zweit);
        if (erstKaputt && !zweitKaputt) ergebnis = zweit;
        else if (!erstKaputt && !zweitKaputt && zuKurz(zweit) < zuKurz(ergebnis))
          ergebnis = zweit;
        else if (erstKaputt && zweitKaputt) ergebnis = zweit;
      }
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
            "Die Antwort kam zweimal mit fehlerhaften Umlauten zurück. Bitte noch einmal ableiten.",
        },
        { status: 502 },
      );
    }

    // Nur Kapitel mit Inhalt, und höchstens so viele wie zulässig: im
    // Segment-Modus genau die Abschnittszahl, sonst die gewählte Obergrenze
    // (≤ MAX_KAPITEL_PRO_STUFE, hält also auch die Speichergrenze).
    const kapitel = ergebnis.kapitel
      .filter((k) => k.titel.trim() || k.inhalt.trim())
      .slice(0, effektivMax);

    return NextResponse.json({ kapitel, model });
  } catch (err) {
    console.error("story-arc-chapters error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
