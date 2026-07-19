import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeScenario } from "@/lib/serialize";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1, "Der Name darf nicht leer sein.").max(80),
});

// Alle Szenarien (alphabetisch, inkl. Anzahl zugeordneter Charaktere).
export async function GET() {
  const rows = await prisma.scenario.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { characters: true } } },
  });
  return NextResponse.json({ scenarios: rows.map(serializeScenario) });
}

// Neues Szenario anlegen.
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
    const row = await prisma.scenario.create({
      data: { name: parsed.data.name },
      include: { _count: { select: { characters: true } } },
    });
    return NextResponse.json({ scenario: serializeScenario(row) });
  } catch (err) {
    console.error("create scenario error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
