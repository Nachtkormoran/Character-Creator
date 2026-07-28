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
  // Ton und Sprache – als String ohne Allowlist (unbekannt = kein Ton-Block).
  ton: z.string().trim().max(40).optional().default(""),
  // Erzählform (Krimi, Liebe, …) – als String ohne Allowlist (unbekannt =
  // kein Erzählform-Block).
  form: z.string().trim().max(40).optional().default(""),
  // Wichtige Figuren (Notizen, `details.figuren`) – noch keine Charaktere.
  // Gefüllt: sie treten als zusätzliche Besetzung hinzu und dürfen die
  // Stationen-Namen tragen. Leer = wie bisher. Gedeckelt wie das Feld selbst.
  figuren: z.string().trim().max(3000).optional().default(""),
  // Modell-Anbieter für **diesen** Aufruf (Selektor beim Story Arc – gilt für
  // Arc, Kapitel und Prosa). Leer/unbekannt → die Einstellung greift.
  textProvider: z.string().trim().max(40).optional().default(""),
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
      scenarioId,
      handlung,
      laenge,
      format,
      zusatz,
      kreativ,
      weiterspinnen,
      ton,
      form,
      figuren,
      textProvider,
    } = parsed.data;
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
        isProtagonist: true,
      },
    });

    // Ohne Besetzung kein Arc – die tragenden Figuren jeder Station kämen aus
    // dem Nichts. „Besetzung" ist ein zugeordneter Charakter **oder** eine Notiz
    // im Figuren-Feld (dann trägt sie die Stationen). Fehlt beides → 400.
    if (rows.length === 0 && !figuren.trim()) {
      return NextResponse.json(
        {
          error:
            "Diesem Szenario ist noch kein Charakter zugeordnet und das Figuren-Feld ist leer. Der Story Arc bindet seine Stationen an die Figuren – ordne welche zu oder trag wichtige Personen ins Figuren-Feld ein.",
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
      isProtagonist: r.isProtagonist,
    }));

    const { client: openai, model, extraParams } =
      await getTextClient(textProvider, "arc");
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
      ton,
      form,
      figuren,
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

    // Jede Station soll ausführlich sein – mindestens 700 Zeichen Beschreibung.
    // Der Prompt und das Feld-`describe()` fordern das bereits; hier ist die
    // Absicherung: Zählt, wie viele Stationen die Vorgabe reißen.
    const MIN_STUFE_LEN = 700;
    const zuKurz = (e: z.infer<typeof storyArcSchema>) =>
      e.stufen.filter((s) => s.beschreibung.trim().length < MIN_STUFE_LEN).length;

    let ergebnis = (await versuch()).choices[0]?.message.parsed;
    // Ein Wiederholversuch bei kaputten Umlauten **oder** wenn eine Station zu
    // kurz ist. Danach die bessere Antwort behalten: kaputte Zeichen sind
    // unbrauchbar und schlagen die Längenfrage, sonst gewinnt die mit weniger
    // zu kurzen Stationen (bei Gleichstand bleibt die erste).
    if (ergebnis && (hatKaputteZeichen(ergebnis) || zuKurz(ergebnis) > 0)) {
      console.warn(
        "scenario-arc: Nachbesserung nötig (kaputte Zeichen oder Station < 700 Zeichen), zweiter Versuch.",
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
        // Sind Figuren-Notizen im Spiel, tragen legitim auch Namen die Stationen,
        // die zu keinem angelegten Charakter gehören – dann nicht wegfiltern.
        // Ohne Notizen bleibt die strenge Bindung an die Besetzung wie bisher.
        if (figuren.trim()) return true;
        return bekannt.some((b) => [...eigene].some((w) => b.has(w)));
      }),
      // Kapitel entstehen getrennt, auf Knopfdruck je Stufe – hier leer.
      kapitel: [] as { titel: string; inhalt: string }[],
    }));

    return NextResponse.json({ storyArc: { stufen }, model });
  } catch (err) {
    console.error("scenario-arc error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
