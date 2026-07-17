import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeGroup } from "@/lib/serialize";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1, "Der Name darf nicht leer sein.").max(80),
});

// Alle Gruppen (alphabetisch, inkl. Anzahl zugeordneter Charaktere).
export async function GET() {
  const rows = await prisma.group.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { characters: true } } },
  });
  return NextResponse.json({ groups: rows.map(serializeGroup) });
}

// Neue Gruppe anlegen.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 },
      );
    }
    const row = await prisma.group.create({
      data: { name: parsed.data.name },
      include: { _count: { select: { characters: true } } },
    });
    return NextResponse.json({ group: serializeGroup(row) });
  } catch (err) {
    console.error("create group error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
