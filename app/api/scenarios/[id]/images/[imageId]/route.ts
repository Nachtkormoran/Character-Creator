import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  deleteScenarioImage,
  setPrimaryScenarioImage,
} from "@/lib/scenarioImages";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; imageId: string }> };

const patchSchema = z.object({
  isPrimary: z.literal(true),
});

/**
 * Ein einzelnes Weltbild **mit** Original laden.
 *
 * Der einzige Weg an ein Original heranzukommen – alle anderen Routen lassen
 * `imageData` aus Größengründen weg (Vollbild, Bild-Export holen es hier).
 */
export async function GET(_request: Request, { params }: Context) {
  const { id, imageId } = await params;
  const image = await prisma.scenarioImage.findFirst({
    where: { id: imageId, scenarioId: id },
    select: { id: true, imageData: true },
  });
  if (!image) {
    return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ imageData: image.imageData });
}

// Bild zum Primärbild machen.
export async function PATCH(request: Request, { params }: Context) {
  const { id, imageId } = await params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten." }, { status: 400 });
  }
  const scenario = await setPrimaryScenarioImage(id, imageId);
  if (!scenario) {
    return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ scenario });
}

// Bild löschen.
export async function DELETE(_request: Request, { params }: Context) {
  const { id, imageId } = await params;
  const scenario = await deleteScenarioImage(id, imageId);
  if (!scenario) {
    return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ scenario });
}
