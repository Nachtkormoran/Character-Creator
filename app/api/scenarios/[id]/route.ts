import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { scenarioDetailsSchema } from "@/lib/schema";
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
    orderBy: { createdAt: "desc" },
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
    const data: { name?: string; details?: string } = {};
    if (p.name !== undefined) data.name = p.name;
    if (p.details !== undefined) data.details = JSON.stringify(p.details);

    const row = await prisma.scenario.update({
      where: { id },
      data,
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
