import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  plotVariantsSchema,
  scenarioDetailsSchema,
  storyArcStoredSchema,
  storyArcVariantsSchema,
} from "@/lib/schema";
import { serializeCharacter, serializeScenario } from "@/lib/serialize";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

/**
 * Teil-Update wie bei `/api/characters/[id]`: Name und Festlegungen lassen sich
 * einzeln ändern. `details` kommt dabei **als Ganzes** – die Felder liegen als
 * ein JSON-String in der Spalte, ein Teil-Update einzelner Felder müsste ihn
 * erst lesen und zusammenführen. Die Detailansicht schickt ohnehin immer alle.
 */
const patchSchema = z
  .object({
    name: z.string().trim().min(1, "Der Name darf nicht leer sein.").max(80),
    details: scenarioDetailsSchema,
    // Die Handlungsentwürfe kommen als eigenes Feld mit (eigene Spalte). Die
    // aktive Variante steht zusätzlich in `details.handlung`; der Client hält
    // beide gleich, `serializeScenario` zieht sie beim Lesen wieder zusammen.
    plotVariants: plotVariantsSchema,
    // Der (aktive) Story Arc – eigene Spalte. Wird die Struktur leer
    // (`stufen: []`) geschickt, ist das ein bewusstes „Arc verworfen".
    // Normalerweise schickt der Client stattdessen `storyArcVariants` (unten),
    // aus dem der aktive Arc abgeleitet und in dieselbe Spalte gespiegelt wird.
    storyArc: storyArcStoredSchema,
    // Alle Story Arcs samt aktivem Index (eigene Spalte, wie `plotVariants`).
    // Ist es gesetzt, gewinnt es: die Spalte `storyArc` wird auf die aktive
    // Variante gespiegelt, damit Export und Consumer unverändert bleiben.
    storyArcVariants: storyArcVariantsSchema,
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "Keine Änderung angegeben.",
  });

/**
 * Einzelnes Szenario samt seiner Charaktere.
 *
 * Die Charaktere kommen **ohne** `imageData` mit (nur Thumbnail), aus demselben
 * Grund wie in der Charakter-Liste: die Originale sind je ~2 MB, und die
 * Detailansicht zeigt sie nur als Kacheln.
 */
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const row = await prisma.scenario.findUnique({
    where: { id },
    omit: { imageData: true },
    include: { _count: { select: { characters: true } } },
  });
  if (!row) {
    return NextResponse.json(
      { error: "Szenario nicht gefunden." },
      { status: 404 },
    );
  }

  const characters = await prisma.character.findMany({
    where: { scenarioId: id },
    // Aufsteigend: In der Szenario-Ansicht steht der **zuerst** angehängte
    // Charakter links, der neueste rechts (anders als die Galerie, die absteigend
    // sortiert). Neu hinzugefügte Charaktere hängt die Seite hinten an – so
    // bleibt die Reihenfolge konsistent.
    orderBy: { createdAt: "asc" },
    include: {
      images: {
        orderBy: { createdAt: "desc" },
        omit: { imageData: true },
      },
    },
  });

  return NextResponse.json({
    scenario: serializeScenario(row),
    characters: characters.map(serializeCharacter),
  });
}

export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params;
  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 },
      );
    }
    const p = parsed.data;
    const data: {
      name?: string;
      details?: string;
      plotVariants?: string;
      storyArc?: string;
      storyArcVariants?: string;
    } = {};
    if (p.name !== undefined) data.name = p.name;
    if (p.details !== undefined) data.details = JSON.stringify(p.details);
    if (p.plotVariants !== undefined)
      data.plotVariants = JSON.stringify(p.plotVariants);
    // `storyArcVariants` hat Vorrang und spiegelt zugleich den aktiven Arc in
    // die Spalte `storyArc` – so bleiben beide konsistent, ohne dass der Client
    // zwei Felder gleichhalten muss.
    if (p.storyArcVariants !== undefined) {
      data.storyArcVariants = JSON.stringify(p.storyArcVariants);
      const aktiv = p.storyArcVariants.items[p.storyArcVariants.aktiv] ?? {
        stufen: [],
      };
      data.storyArc = JSON.stringify(aktiv);
    } else if (p.storyArc !== undefined) {
      data.storyArc = JSON.stringify(p.storyArc);
    }

    const row = await prisma.scenario.update({
      where: { id },
      data,
      omit: { imageData: true },
      include: { _count: { select: { characters: true } } },
    });
    return NextResponse.json({ scenario: serializeScenario(row) });
  } catch {
    return NextResponse.json(
      { error: "Szenario nicht gefunden." },
      { status: 404 },
    );
  }
}

// Szenario löschen. Zugeordnete Charaktere bleiben erhalten (scenarioId -> null,
// via onDelete: SetNull im Schema).
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  try {
    await prisma.scenario.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Szenario nicht gefunden." },
      { status: 404 },
    );
  }
}
