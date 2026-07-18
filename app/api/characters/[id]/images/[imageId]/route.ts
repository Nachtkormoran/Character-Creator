import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deleteImage, setPrimaryImage } from "@/lib/characterImages";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; imageId: string }> };

const patchSchema = z.object({
  isPrimary: z.literal(true),
});

/**
 * Ein einzelnes Bild **mit** Original laden.
 *
 * Der einzige Weg an ein Original heranzukommen – alle anderen Routen lassen
 * `imageData` aus Größengründen weg (Vollbild, Bild-Export, PDF holen es hier).
 */
export async function GET(_request: Request, { params }: Context) {
  const { id, imageId } = await params;
  const image = await prisma.characterImage.findFirst({
    where: { id: imageId, characterId: id },
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
  const character = await setPrimaryImage(id, imageId);
  if (!character) {
    return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ character });
}

// Bild löschen.
export async function DELETE(_request: Request, { params }: Context) {
  const { id, imageId } = await params;
  const character = await deleteImage(id, imageId);
  if (!character) {
    return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
  }
  return NextResponse.json({ character });
}
