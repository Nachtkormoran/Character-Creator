import { NextResponse } from "next/server";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getTextClient, hatKaputteZeichen } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { buildFigurePersonsPrompt } from "@/lib/prompts";
import { plotPersonsSchema } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * Die **Personen aus dem Figuren-Feld** eines Szenarios, die ihm noch nicht als
 * Charakter zugeordnet sind – das Gegenstück zu `scenario-plot-persons`, nur mit
 * den **Notizen zu wichtigen Figuren** als Quelle statt eines Handlungsentwurfs.
 *
 * Zuschnitt und Absicherungen sind identisch: **Structured Output**
 * (`plotPersonsSchema`), die zugeordneten Figuren lädt die Route selbst über die
 * `scenarioId` (Ausschlussliste), der zu durchsuchende Text kommt aus dem
 * Request (er kann ungespeichert bearbeitet sein), Umlaut-Wächter plus ein
 * Wiederholversuch, und eine grobe Nachprüfung über ganze Namensteile.
 * **Persistiert nichts** – angelegt werden die Charaktere später über das
 * Erstellen-Formular.
 *
 * Der einzige Unterschied zum Plot-Pendant ist der Prompt: Er nimmt bewusst
 * **auch Bezeichnungen** auf, die für eine Person stehen („die Hafenmeisterin"),
 * nicht nur Eigennamen – s. `buildFigurePersonsPrompt`.
 */
const bodySchema = z.object({
  scenarioId: z.string().min(1),
  figuren: z.string().trim().min(1).max(3000),
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

    const { scenarioId, figuren } = parsed.data;

    const zugeordnet = (
      await prisma.character.findMany({
        where: { scenarioId },
        select: { name: true },
        orderBy: { createdAt: "asc" },
      })
    )
      .map((c) => c.name?.trim() ?? "")
      .filter(Boolean);

    const { client: openai, model, extraParams } = await getTextClient();
    const prompt = buildFigurePersonsPrompt(figuren, zugeordnet);

    const versuch = () =>
      openai.chat.completions.parse({
        model,
        ...extraParams,
        messages: [
          {
            role: "system",
            content:
              "Du bist ein sorgfältiger Lektor. Du liest Texte und hältst genau fest, welche Personen darin vorkommen und was über sie dasteht – nicht mehr.",
          },
          { role: "user", content: prompt },
        ],
        response_format: zodResponseFormat(plotPersonsSchema, "personen"),
        // Niedrig: Hier wird ausgelesen, nicht erfunden.
        temperature: 0.2,
      });

    let ergebnis = (await versuch()).choices[0]?.message.parsed;
    if (ergebnis && hatKaputteZeichen(ergebnis)) {
      console.warn(
        "scenario-figure-persons: fehlerhafte Zeichenkodierung, zweiter Versuch.",
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

    // Fangnetz: namenlose Einträge raus, schon zugeordnete raus – Abgleich über
    // ganze Namensteile (wie in `scenario-plot-persons`).
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
    console.error("scenario-figure-persons error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
