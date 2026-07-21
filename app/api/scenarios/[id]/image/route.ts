import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeScenario } from "@/lib/serialize";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

// Ein Original ist als Base64-Data-URL ~2 MB groß; 12 MB lassen Luft für
// hochgeladene Bilder – dieselbe Grenze wie bei den Charakter-Bildern.
const MAX_IMAGE_CHARS = 12_000_000;

/**
 * Das **eine** Weltbild eines Szenarios – setzen, holen, löschen.
 *
 * Bewusst eine eigene Route und **nicht** Teil des `PATCH /api/scenarios/[id]`
 * (Name/Festlegungen): Ein Bild ist ~2 MB, und es bei jedem Speichern von Name
 * oder Regeln mitzuschreiben wäre Verschwendung. Dieselbe Trennung wie beim
 * Charakter, nur ohne dessen Mehrbild-Apparat – ein Szenario hat genau ein Bild.
 *
 * - `PUT` setzt/ersetzt das Bild und gibt das aktualisierte Szenario zurück
 *   (**ohne** `imageData`, nur Thumbnail – wie alle Szenario-Antworten).
 * - `GET` ist der einzige Weg an das Original (Vollbild, Export).
 * - `DELETE` entfernt das Bild.
 */
const putSchema = z.object({
  imageData: z
    .string()
    .min(1)
    .max(MAX_IMAGE_CHARS, "Das Bild ist zu groß.")
    .refine((v) => v.startsWith("data:image/"), "Kein gültiges Bild."),
  // Der Server kann kein Thumbnail erzeugen (Canvas gibt es nur im Browser),
  // deshalb kommt es fertig mit. Fehlt es, zeigt die Karte das Original –
  // größer, aber nicht falsch.
  thumbnail: z.string().max(MAX_IMAGE_CHARS).nullable().optional(),
});

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const row = await prisma.scenario.findUnique({
    where: { id },
    select: { imageData: true },
  });
  if (!row) {
    return NextResponse.json(
      { error: "Szenario nicht gefunden." },
      { status: 404 },
    );
  }
  if (!row.imageData) {
    return NextResponse.json(
      { error: "Dieses Szenario hat kein Bild." },
      { status: 404 },
    );
  }
  return NextResponse.json({ imageData: row.imageData });
}

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  try {
    const parsed = putSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 },
      );
    }
    const { imageData, thumbnail } = parsed.data;
    const row = await prisma.scenario.update({
      where: { id },
      data: { imageData, thumbnail: thumbnail ?? null },
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

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  try {
    const row = await prisma.scenario.update({
      where: { id },
      data: { imageData: null, thumbnail: null },
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
