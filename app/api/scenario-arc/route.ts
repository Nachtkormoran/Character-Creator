import { NextResponse } from "next/server";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getTextClient, hatKaputteZeichen } from "@/lib/openai";
import { buildStoryArcPrompt, type PlotCharacter } from "@/lib/prompts";
import { randomSparks } from "@/lib/storyArcSparks";
import {
  ARC_FORMATS,
  ARC_LENGTHS,
  DEFAULT_ARC_FORMAT,
  DEFAULT_ARC_LENGTH,
  arcStationen,
  normalizeTraits,
  storyArcSchema,
} from "@/lib/schema";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Der **Story Arc** eines Szenarios – die dramaturgische Zerlegung seines
 * aktiven Handlungsentwurfs in eine geordnete Folge von Stationen (Fünfakter).
 *
 * Der Zuschnitt ist exakt der von `scenario-plot`:
 *
 * - **Die Figuren lädt die Route selbst** über die `scenarioId` (Namen für die
 *   `figuren`-Rückbindung, Kurzbeschreibung + Beschreibung + Merkmale +
 *   Ansatzpunkte als Material). Der Client hätte sonst eine zweite Wahrheit
 *   über den Bestand.
 * - **Der Handlungsentwurf kommt aus dem Request** – er kann in der
 *   Detailansicht ungespeichert bearbeitet sein.
 * - **Ohne Handlungsentwurf → 400.** Ein Arc über nichts wäre teurer Unsinn,
 *   genau wie ein Handlungsentwurf ohne Figuren.
 * - **Persistiert nichts** – das Ergebnis geht in den Bearbeitungs-Zustand der
 *   Detailansicht, gespeichert wird über „Änderungen speichern".
 *
 * **Structured Output**, weil mehrere Stufen mit je vier Feldern entstehen, die
 * einzeln in die Oberfläche müssen – dieselbe Begründung wie bei
 * `scenario-plot-persons`. Und derselbe Umlaut-Wächter (`hatKaputteZeichen`,
 * rekursiv – greift also auch tief in den Stufen) plus **ein** Wiederholversuch.
 */
const bodySchema = z.object({
  scenarioId: z.string().min(1),
  // Großzügig wie bei `scenario-plot-persons`: der Handlungsentwurf ist das
  // längste Feld eines Szenarios.
  handlung: z.string().trim().min(1).max(20000),
  // Länge (Stationenzahl) und Format – nicht gespeichert, beschreiben den Lauf.
  laenge: z
    .enum(ARC_LENGTHS.map((l) => l.value) as [string, ...string[]])
    .optional()
    .default(DEFAULT_ARC_LENGTH),
  format: z
    .enum(ARC_FORMATS.map((f) => f.value) as [string, ...string[]])
    .optional()
    .default(DEFAULT_ARC_FORMAT),
  zusatz: z.string().trim().max(1000).optional().default(""),
  // „kreativ": zufällige erzählerische Impulse fließen ein und die Temperatur
  // steigt – der Arc darf freier ausfallen, bleibt aber am Entwurf.
  kreativ: z.boolean().optional().default(false),
  // „weiterspinnen": aus der offenen Ausgangslage eine vollständige Geschichte
  // entwickeln (Zuspitzung, Wendepunkt, Ende) statt sie nur zu gliedern.
  weiterspinnen: z.boolean().optional().default(false),
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

    const { scenarioId, handlung, laenge, format, zusatz, kreativ, weiterspinnen } =
      parsed.data;
    const anzahl = arcStationen(laenge);

    const rows = await prisma.character.findMany({
      where: { scenarioId },
      orderBy: { createdAt: "asc" },
      select: {
        name: true,
        shortDescription: true,
        description: true,
        traits: true,
        storyHooks: true,
      },
    });

    // Ohne Besetzung kein Arc – die tragenden Figuren jeder Station kämen aus
    // dem Nichts. (Der Entwurf selbst entsteht schon nicht ohne Figuren.)
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Diesem Szenario ist noch kein Charakter zugeordnet. Der Story Arc bindet seine Stationen an die Figuren – ordne in der Charakter-Übersicht welche zu.",
        },
        { status: 400 },
      );
    }

    const characters: PlotCharacter[] = rows.map((r) => ({
      name: r.name ?? "",
      kurzbeschreibung: r.shortDescription ?? "",
      beschreibung: r.description,
      merkmale: normalizeTraits(JSON.parse(r.traits)),
      storyHooks: r.storyHooks ?? "",
    }));

    const { client: openai, model, extraParams } = await getTextClient();
    // Bei „kreativ" ein paar zufällige Impulse ziehen – jeder Lauf andere.
    const sparks = kreativ ? randomSparks() : undefined;
    const prompt = buildStoryArcPrompt(
      handlung,
      characters,
      anzahl,
      format as "buch" | "spiel",
      zusatz,
      sparks,
      weiterspinnen,
    );

    // Die System-Rolle folgt dem Auftrag: gliedern oder weiterentwickeln.
    const systemRolle = weiterspinnen
      ? "Du bist Dramaturg. Aus einer gegebenen Ausgangslage entwickelst du eine vollständige Geschichte und bringst sie in dramaturgische Stationen – du bleibst Figuren und Welt treu, führst die Handlung aber bis zu einem Ende."
      : "Du bist Dramaturg. Du zerlegst eine gegebene Handlung in ihre dramaturgischen Stationen – du erfindest keine neue Geschichte, sondern gliederst die vorhandene.";

    const versuch = () =>
      openai.chat.completions.parse({
        model,
        ...extraParams,
        messages: [
          { role: "system", content: systemRolle },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(storyArcSchema, "story_arc"),
        // Niedrig-mittig beim Gliedern; höher, wenn erfunden wird – „kreativ"
        // (Impulse) am höchsten, „weiterspinnen" (Ende erfinden) dazwischen.
        temperature: kreativ ? 0.9 : weiterspinnen ? 0.75 : 0.5,
      });

    let ergebnis = (await versuch()).choices[0]?.message.parsed;
    if (ergebnis && hatKaputteZeichen(ergebnis)) {
      console.warn("scenario-arc: fehlerhafte Zeichenkodierung, zweiter Versuch.");
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
            "Die Antwort kam zweimal mit fehlerhaften Umlauten zurück. Bitte noch einmal ableiten.",
        },
        { status: 502 },
      );
    }

    /**
     * Grobe Nachprüfung der `figuren`-Rückbindung – wie in
     * `scenario-plot-persons`: Namensteile abgleichen, nicht Teilzeichenketten.
     * Ein Name, der zu keiner Figur der Besetzung passt, fällt aus der Station
     * heraus (das Modell erfindet gelegentlich Neben- statt der genannten
     * Figuren). Die Station selbst bleibt erhalten – nur der falsche Name geht.
     */
    const teile = (name: string) =>
      new Set(
        name
          .toLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .filter(Boolean),
      );
    const bekannt = characters
      .map((c) => teile(c.name))
      .filter((s) => s.size > 0);
    const stufen = ergebnis.stufen.map((s) => ({
      ...s,
      figuren: s.figuren.filter((f) => {
        const eigene = teile(f);
        if (eigene.size === 0) return false;
        return bekannt.some((b) => [...eigene].some((w) => b.has(w)));
      }),
      // Kapitel entstehen getrennt, auf Knopfdruck je Stufe – hier leer.
      kapitel: [] as { titel: string; inhalt: string }[],
    }));

    return NextResponse.json({ storyArc: { stufen } });
  } catch (err) {
    console.error("scenario-arc error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
