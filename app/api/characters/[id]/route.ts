import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeCharacter } from "@/lib/serialize";
import { characterTraitsSchema } from "@/lib/schema";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    name: z.string().trim().min(1, "Der Name darf nicht leer sein.").max(120),
    imageData: z.string().nullable(),
    groupId: z.string().nullable(),
    shortDescription: z.string().max(500),
    description: z.string().max(10000),
    traits: characterTraitsSchema,
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "Keine Änderung angegeben.",
  });

// Einzelnen Charakter laden.
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const row = await prisma.character.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json(
      { error: "Charakter nicht gefunden." },
      { status: 404 },
    );
  }
  return NextResponse.json({ character: serializeCharacter(row) });
}

// Charakter aktualisieren (aktuell: Name umbenennen).
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
      imageData?: string | null;
      groupId?: string | null;
      shortDescription?: string;
      description?: string;
      traits?: string;
    } = {};
    if (p.name !== undefined) data.name = p.name;
    if (p.imageData !== undefined) data.imageData = p.imageData;
    if (p.groupId !== undefined) data.groupId = p.groupId;
    if (p.shortDescription !== undefined)
      data.shortDescription = p.shortDescription;
    if (p.description !== undefined) data.description = p.description;
    if (p.traits !== undefined) data.traits = JSON.stringify(p.traits);

    const row = await prisma.character.update({ where: { id }, data });
    return NextResponse.json({ character: serializeCharacter(row) });
  } catch {
    return NextResponse.json(
      { error: "Charakter nicht gefunden." },
      { status: 404 },
    );
  }
}

// Charakter löschen.
export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  try {
    await prisma.character.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Charakter nicht gefunden." },
      { status: 404 },
    );
  }
}
