import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeScenario } from "@/lib/serialize";
import { scenarioDetailsSchema } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * `details` ist optional: das Schnellanlegen in der Galerie schickt nur einen
 * Namen, das Formular unter `/scenarios` alles. Beides muss gehen – ein
 * Szenario entsteht oft, bevor feststeht, wo es spielt.
 */
const createSchema = z.object({
  name: z.string().trim().min(1, "Der Name darf nicht leer sein.").max(80),
  details: scenarioDetailsSchema.optional(),
});

/**
 * Sammelt die Charakter-Ids, die in einem Szenario als **Buch-Cover** dienen
 * (`meta.cover = "char:<id>"` in `storyArcVariants`). Defensiv geparst – eine
 * kaputte JSON-Spalte darf die Liste nicht kippen.
 */
function coverCharacterIds(storyArcVariantsJson: string | null): string[] {
  if (!storyArcVariantsJson) return [];
  try {
    const parsed = JSON.parse(storyArcVariantsJson) as { meta?: unknown };
    const meta = Array.isArray(parsed?.meta) ? parsed.meta : [];
    const ids: string[] = [];
    for (const m of meta) {
      const cover = (m as { cover?: unknown })?.cover;
      if (typeof cover === "string" && cover.startsWith("char:")) {
        ids.push(cover.slice(5));
      }
    }
    return ids;
  } catch {
    return [];
  }
}

// Alle Szenarien (alphabetisch, inkl. Anzahl zugeordneter Charaktere).
// `imageData` bleibt draußen (nur Thumbnail) – dieselbe Regel wie in der
// Charakter-Liste: die Originale sind je ~2 MB.
export async function GET() {
  const rows = await prisma.scenario.findMany({
    orderBy: { name: "asc" },
    include: {
      images: { orderBy: { createdAt: "desc" }, omit: { imageData: true } },
      _count: { select: { characters: true } },
    },
  });

  // Nur die tatsächlich als Buch-Cover referenzierten Charaktere nachladen –
  // nicht alle. In der Regel keiner bis wenige; ist keiner gesetzt, geht kein
  // einziges Charakter-Thumbnail über die Leitung.
  const coverIds = new Set<string>();
  for (const row of rows) {
    for (const id of coverCharacterIds(row.storyArcVariants)) coverIds.add(id);
  }

  const coverChars = coverIds.size
    ? await prisma.character.findMany({
        where: { id: { in: [...coverIds] } },
        select: {
          id: true,
          scenarioId: true,
          name: true,
          isProtagonist: true,
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { thumbnail: true },
          },
        },
      })
    : [];

  // Je Szenario die zugehörigen Cover-Charaktere zuordnen (Charakter → Szenario
  // ist 1-zu-n, also landet jeder bei genau seinem Szenario).
  const proSzenario = new Map<string, typeof coverChars>();
  for (const c of coverChars) {
    if (!c.scenarioId) continue;
    const liste = proSzenario.get(c.scenarioId) ?? [];
    liste.push(c);
    proSzenario.set(c.scenarioId, liste);
  }

  return NextResponse.json({
    scenarios: rows.map((row) =>
      serializeScenario({ ...row, characters: proSzenario.get(row.id) }),
    ),
  });
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
      data: {
        name: parsed.data.name,
        details: parsed.data.details
          ? JSON.stringify(parsed.data.details)
          : null,
      },
      include: {
        images: { orderBy: { createdAt: "desc" }, omit: { imageData: true } },
        _count: { select: { characters: true } },
      },
    });
    return NextResponse.json({ scenario: serializeScenario(row) });
  } catch (err) {
    console.error("create scenario error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
