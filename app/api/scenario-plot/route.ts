import { NextResponse } from "next/server";
import { z } from "zod";
import { getTextClient } from "@/lib/openai";
import { buildScenarioPlotPrompt, type PlotCharacter } from "@/lib/prompts";
import { normalizeTraits, scenarioDetailsSchema } from "@/lib/schema";
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

    const { scenarioId, name, details, zusatz } = parsed.data;

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
      },
    });

    // Ohne Besetzung kein Handlungsentwurf. Ein Text über niemanden wäre
    // teurer Unsinn – und die Meldung sagt, was zu tun ist.
    if (rows.length === 0) {
      return NextResponse.json(
        {
          error:
            "Diesem Szenario ist noch kein Charakter zugeordnet. Der Handlungsentwurf entsteht aus den Figuren – ordne in der Charakter-Übersicht welche zu.",
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
    }));

    const { client: openai, model, extraParams } = await getTextClient();
    const completion = await openai.chat.completions.create({
      model,
      ...extraParams,
      messages: [
        {
          role: "system",
          content:
            "Du bist Dramaturg. Du entwirfst Ausgangslagen, aus denen sich Geschichten entwickeln, und antwortest ausschließlich mit dem Entwurf selbst.",
        },
        {
          role: "user",
          content: buildScenarioPlotPrompt(name, details, characters, zusatz),
        },
      ],
      temperature: 0.9,
      // Verlangt sind ca. 900–1400 Zeichen; der Prompt ist mit sechs Figuren
      // und ihren Ansatzpunkten ohnehin lang, hier zählt der Ausgabe-Puffer.
      max_tokens: 1100,
    });

    const handlung = (completion.choices[0]?.message.content ?? "").trim();
    if (!handlung) {
      return NextResponse.json(
        { error: "Das Modell lieferte keinen Text." },
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
