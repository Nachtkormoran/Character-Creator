import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loadCharacter } from "@/lib/characterImages";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  /**
   * Das Szenario, dem die **Kopie** zugeordnet wird (oder `null` für keines).
   * Der Ausgangs-Charakter bleibt unangetastet – dies legt eine eigenständige
   * neue Figur an.
   */
  scenarioId: z.string().nullable().optional().default(null),
});

/**
 * Einen Charakter **klonen** – dieselbe Figur ein zweites Mal, als
 * eigenständiger Neuanlagesatz mit eigener Id und eigenen Bildern.
 *
 * Der Anlass ist die Zuordnung aus einem Szenario heraus: Gehört der gewählte
 * Charakter schon einem **anderen** Szenario, wäre ein bloßes Umhängen ein
 * Wegnehmen dort. Statt das Datenmodell auf n-zu-m umzustellen (mit allen
 * Folgen für Export/Import, s. CLAUDE.md), legt die App auf Wunsch eine Kopie
 * an – das Original bleibt in seiner Welt, die Kopie zieht in die neue.
 *
 * Klon und Bilder entstehen in **einer** Transaktion – dieselbe Überlegung wie
 * beim Import: der Weg über `POST /api/characters` plus je Bild `POST …/images`
 * ließe bei einem Fehler im dritten Bild einen halben Charakter stehen.
 *
 * **Nicht kopiert wird die Zuordnung** – die kommt aus dem Request (das Ziel
 * der Kopie ist ein anderes als das Original). Alles Übrige (Vorgaben inkl.
 * protokolliertem Modell, Texte, Merkmale, Ansatzpunkte, Bilder samt
 * Primärmarkierung) geht 1:1 mit.
 */
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungültige Daten.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { scenarioId } = parsed.data;

    const quelle = await prisma.character.findUnique({
      where: { id },
      include: { images: { orderBy: { createdAt: "asc" } } },
    });
    if (!quelle) {
      return NextResponse.json(
        { error: "Charakter nicht gefunden." },
        { status: 404 },
      );
    }

    const row = await prisma.$transaction(async (tx) =>
      tx.character.create({
        data: {
          name: quelle.name,
          input: quelle.input,
          shortDescription: quelle.shortDescription,
          description: quelle.description,
          traits: quelle.traits,
          storyHooks: quelle.storyHooks,
          scenarioId: scenarioId ?? null,
          images: {
            create: quelle.images.map((b) => ({
              imageData: b.imageData,
              thumbnail: b.thumbnail,
              isPrimary: b.isPrimary,
            })),
          },
        },
      }),
    );

    return NextResponse.json({ character: await loadCharacter(row.id) });
  } catch (err) {
    console.error("clone character error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
