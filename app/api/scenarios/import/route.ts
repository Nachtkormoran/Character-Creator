import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SCENARIO_FILE_VERSION, scenarioFileSchema } from "@/lib/scenarioFile";
import { normalizeTraits } from "@/lib/schema";
import { serializeScenario } from "@/lib/serialize";

export const runtime = "nodejs";

/**
 * Ein **Szenario** aus einer Exportdatei einspielen – additiv, wie der
 * Charakter-Import und aus denselben Gründen: Die Datei trägt keine Id, ein
 * zweiter Import derselben Datei ergibt bewusst ein zweites Szenario.
 *
 * **Alles in einer Transaktion.** Beim Charakter war das schon nötig (ein
 * Fehler im dritten Bild hätte einen halben Charakter hinterlassen), hier gilt
 * es doppelt: Ein Szenario ohne seine Figuren wäre nicht bloß unvollständig,
 * sondern falsch – der Nutzer hat eine Welt **mit** Besetzung eingespielt, und
 * ein Abbruch nach der dritten Figur ließe eine Welt zurück, deren
 * Zusammensetzung niemand so gewählt hat.
 *
 * Die mitgelieferten Charaktere werden dem **neuen** Szenario zugeordnet
 * (`scenarioId`), nicht einem gleichnamigen bestehenden. Ein Import legt an,
 * er verschmilzt nicht: Zwei Welten mit demselben Namen können verschiedene
 * Welten sein, und eine Zuordnung nach Namensgleichheit zöge Figuren in ein
 * Szenario, das niemand ausgewählt hat.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = scenarioFileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Die Datei ist keine gültige Szenario-Exportdatei dieser Anwendung.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const datei = parsed.data;
    if (datei.version > SCENARIO_FILE_VERSION) {
      return NextResponse.json(
        {
          error:
            `Die Datei hat Format-Version ${datei.version}, diese Anwendung ` +
            `kennt höchstens ${SCENARIO_FILE_VERSION}. Bitte aktualisieren.`,
        },
        { status: 400 },
      );
    }

    const { scenario, characters } = datei;
    const name = scenario.name.trim();
    if (!name) {
      return NextResponse.json(
        { error: "Die Datei enthält keinen Szenario-Namen." },
        { status: 400 },
      );
    }

    const row = await prisma.$transaction(async (tx) => {
      const angelegt = await tx.scenario.create({
        data: {
          name,
          details: JSON.stringify(scenario.details),
          // Die neuen Bestandteile, sofern die Datei sie trägt. Fehlen sie
          // (alte Datei), bleibt die Spalte null und `serializeScenario` füllt
          // beim Lesen auf (eine Variante aus `details.handlung`, leerer Arc).
          plotVariants: scenario.plotVariants
            ? JSON.stringify(scenario.plotVariants)
            : null,
          storyArc: scenario.storyArc
            ? JSON.stringify(scenario.storyArc)
            : null,
          // Das Weltbild direkt als Spalten (ein Bild je Szenario).
          imageData: scenario.imageData ?? null,
          thumbnail: scenario.thumbnail ?? null,
        },
      });

      // Nacheinander und nicht über `Promise.all`: Innerhalb einer Transaktion
      // müssen die Anweisungen ohnehin auf derselben Verbindung laufen, und
      // mehrere Figuren mit Bild-Originalen gleichzeitig zu schicken brächte
      // nichts als Spitzenlast (dieselbe Überlegung wie beim Mehrfach-Import
      // in der Galerie).
      for (const c of characters) {
        // Genau ein Primärbild – die Regel, die `characterImages.ts` hält und
        // die die Datenbank nicht erzwingt. Trägt die Datei keine Markierung
        // oder mehrere, gewinnt das erste Bild.
        const primaerIndex = Math.max(
          0,
          c.images.findIndex((b) => b.isPrimary),
        );

        await tx.character.create({
          data: {
            name: c.character.name,
            input: JSON.stringify(c.input),
            shortDescription: c.character.kurzbeschreibung,
            description: c.character.beschreibung,
            // Fehlende Merkmale auffüllen: Die Datei kann aus einem Stand
            // stammen, der ein später ergänztes Merkmal nicht kannte.
            traits: JSON.stringify(normalizeTraits(c.character.merkmale)),
            storyHooks: c.character.storyHooks || null,
            // Der eigentliche Punkt dieser Route: Die Figuren kommen nicht
            // lose an, sondern hängen am eingespielten Szenario.
            scenarioId: angelegt.id,
            images: {
              create: c.images.map((b, i) => ({
                imageData: b.imageData,
                thumbnail: b.thumbnail ?? null,
                isPrimary: i === primaerIndex,
              })),
            },
          },
        });
      }

      return tx.scenario.findUniqueOrThrow({
        where: { id: angelegt.id },
        include: { _count: { select: { characters: true } } },
      });
    });

    return NextResponse.json({
      scenario: serializeScenario(row),
      characters: characters.length,
      images: characters.reduce((n, c) => n + c.images.length, 0),
    });
  } catch (err) {
    console.error("import scenario error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
