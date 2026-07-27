import { NextResponse } from "next/server";
import { z } from "zod";
import { getTextClient } from "@/lib/openai";
import { buildScenarioPlotPrompt, type PlotCharacter } from "@/lib/prompts";
import {
  MAX_NEUE_PLOT_PERSONEN,
  normalizeTraits,
  scenarioDetailsSchema,
} from "@/lib/schema";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Handlungsentwurf für ein Szenario – aus seinen Festlegungen **und** seinen
 * Charakteren.
 *
 * Die Figuren kommen **nicht** aus dem Request, sondern werden hier über die
 * `scenarioId` geladen. Zwei Gründe: Der Client müsste sonst alle Charaktere
 * mitschicken (die Galerie hält sie ohne Bild-Originale, aber es bliebe
 * unnötiger Umfang), und die Route bekäme eine zweite Wahrheit über den
 * Bestand. Die Festlegungen kommen dagegen **doch** aus dem Request: in der
 * Detailansicht können sie ungespeichert geändert sein, und wer gerade die
 * Regeln umgeschrieben hat, meint die neuen.
 *
 * Wie die übrigen Generierungs-Routen persistiert diese **nichts**.
 */
const bodySchema = z.object({
  scenarioId: z.string().min(1),
  name: z.string().trim().max(80).optional().default(""),
  details: scenarioDetailsSchema,
  zusatz: z.string().trim().max(1000).optional().default(""),
  // Ein bestehender Handlungsentwurf als Grundlage einer Neuerzeugung (die
  // Checkbox „aktuellen Handlungsentwurf verwenden"). Großzügig bemessen wie
  // die anderen Handlungsfelder – der Entwurf ist das längste Feld eines
  // Szenarios. Leer = wie bisher aus Welt und Figuren.
  basis: z.string().trim().max(20000).optional().default(""),
  // „weiterspinnen": eine vollständige Geschichte (bis zum Ende) statt einer
  // offenen Ausgangslage. Unabhängig von `basis`.
  weiterspinnen: z.boolean().optional().default(false),
  // Ton und Sprache – nicht gespeichert. Ohne Allowlist als String: ein
  // unbekannter Wert liefert bloß keinen Ton-Block (`toneHint` gibt "").
  ton: z.string().trim().max(40).optional().default(""),
  // Wie viele **neue benannte Personen** der Entwurf zusätzlich einführen soll
  // (0 = keine, harte Regel bleibt). Auf MAX_NEUE_PLOT_PERSONEN gedeckelt.
  neuePersonen: z
    .number()
    .int()
    .min(0)
    .max(MAX_NEUE_PLOT_PERSONEN)
    .optional()
    .default(0),
  // Optionale Namens-/Rollen-Vorgaben zu den neuen Personen (Freitext).
  neuePersonenWunsch: z.string().trim().max(500).optional().default(""),
  // Erzählform (Krimi, Liebe, …) – als String ohne Allowlist (unbekannt =
  // kein Erzählform-Block, `formHint` gibt "").
  form: z.string().trim().max(40).optional().default(""),
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
      name,
      details,
      zusatz,
      basis,
      weiterspinnen,
      ton,
      neuePersonen,
      neuePersonenWunsch,
      form,
    } = parsed.data;

    const rows = await prisma.character.findMany({
      where: { scenarioId },
      orderBy: { createdAt: "asc" },
      // `description` ist der lange Text mit der Vorgeschichte – bei sechs
      // Figuren rund 2000 zusätzliche Token. Bewusst in Kauf genommen: ohne
      // ihn kennt der Entwurf die Welt im Detail und die Menschen darin nur
      // als Stichworte. Bilder werden hier nicht geladen (die Größe wäre ein
      // Vielfaches und für einen Text ohne Nutzen).
      select: {
        name: true,
        shortDescription: true,
        description: true,
        traits: true,
        storyHooks: true,
        isProtagonist: true,
      },
    });

    // Ohne Besetzung kein Handlungsentwurf. „Besetzung" ist entweder ein
    // zugeordneter Charakter **oder** eine Notiz im Figuren-Feld – letzteres
    // erlaubt einen Entwurf direkt aus einem (zufällig erzeugten) Szenario,
    // bevor Charaktere angelegt sind. Fehlt beides, wäre der Text über niemanden.
    if (rows.length === 0 && !details.figuren?.trim()) {
      return NextResponse.json(
        {
          error:
            "Diesem Szenario ist noch kein Charakter zugeordnet und das Figuren-Feld ist leer. Der Handlungsentwurf entsteht aus den Figuren – ordne welche zu oder trag wichtige Personen ins Figuren-Feld ein.",
        },
        { status: 400 },
      );
    }

    const characters: PlotCharacter[] = rows.map((r) => ({
      name: r.name ?? "",
      kurzbeschreibung: r.shortDescription ?? "",
      beschreibung: r.description,
      // Auffüllen wie überall: Altbestände kennen später ergänzte Merkmale
      // nicht, und der Prompt läuft über die vollständige Tabelle.
      merkmale: normalizeTraits(JSON.parse(r.traits)),
      storyHooks: r.storyHooks ?? "",
      isProtagonist: r.isProtagonist,
    }));

    const { client: openai, model, extraParams } = await getTextClient();
    const completion = await openai.chat.completions.create({
      model,
      ...extraParams,
      messages: [
        {
          role: "system",
          content: weiterspinnen
            ? "Du bist Dramaturg. Du entwirfst vollständige Geschichten – von der Ausgangslage bis zu einem Ende – und antwortest ausschließlich mit dem Entwurf selbst."
            : "Du bist Dramaturg. Du entwirfst Ausgangslagen, aus denen sich Geschichten entwickeln, und antwortest ausschließlich mit dem Entwurf selbst.",
        },
        {
          role: "user",
          content: buildScenarioPlotPrompt(
            name,
            details,
            characters,
            zusatz,
            basis,
            ton,
            weiterspinnen,
            neuePersonen,
            neuePersonenWunsch,
            form,
          ),
        },
      ],
      temperature: 0.9,
      // Verlangt sind ca. 900–1400 Zeichen; der Prompt ist mit sechs Figuren
      // und ihren Ansatzpunkten ohnehin lang, hier zählt der Ausgabe-Puffer.
      // Neue Personen brauchen etwas mehr Platz (Einführung + Rolle je Figur).
      max_tokens: 1100 + neuePersonen * 120,
    });

    const choice = completion.choices?.[0];
    const handlung = (choice?.message?.content ?? "").trim();
    if (!handlung) {
      const blockiert = choice?.finish_reason === "content_filter";
      return NextResponse.json(
        {
          error: blockiert
            ? "Der Sicherheitsfilter des Modells hat den Text blockiert. Das kommt bei explizitem Ton vor – versuch einen weicheren Ton oder ein anderes Modell."
            : "Das Modell lieferte keinen Text – möglicherweise vom Sicherheitsfilter blockiert (kann bei explizitem Ton passieren). Bitte erneut versuchen.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({ handlung, characters: characters.length });
  } catch (err) {
    console.error("scenario-plot error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
