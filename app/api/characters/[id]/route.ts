import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loadCharacter } from "@/lib/characterImages";
import { characterTraitsSchema, normalizeInputGenre } from "@/lib/schema";
import { GENRE_TEMPLATES } from "@/lib/templates";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

// Bilder laufen nicht mehr hierüber, sondern über /api/characters/[id]/images.
const patchSchema = z
  .object({
    name: z.string().trim().min(1, "Der Name darf nicht leer sein.").max(120),
    scenarioId: z.string().nullable(),
    shortDescription: z.string().max(500),
    description: z.string().max(10000),
    traits: characterTraitsSchema,
    /**
     * Die Ansatzpunkte, Einträge durch eine Leerzeile getrennt (s.
     * `lib/storyHooks.ts`). Das Limit lag bei 4000 und war für **drei**
     * bemessen; seit sie eine Liste sind, hängt jeder Klick einen an, und
     * zehn gemessene Ansatzpunkte liegen bereits bei ~4700 Zeichen. Ein zu
     * enges Limit schlägt hier nicht früh, sondern spät zu: Es scheitert erst
     * beim Speichern, wenn die Arbeit schon getan ist.
     */
    storyHooks: z.string().max(20000),
    /**
     * Das **einzige** Feld der Vorgaben, das sich nachträglich ändern lässt –
     * und bewusst als eigener Schlüssel statt als ganzes `input`-Objekt.
     *
     * Die übrigen Vorgaben sind ein Protokoll des Erstellungszeitpunkts: Wären
     * sie änderbar, stünde in der Datenbank eine Vorgabe, aus der der
     * gespeicherte Text nie entstanden ist. Beim Genre trägt dieses Argument
     * nicht, denn die Genre-Id geht gar nicht in den Text-Prompt ein – dorthin
     * gehen `setting` und `notes`. Das Genre steuert die Würfel und die
     * Szenario-Ableitung, ist also eher eine Einstellung der Figur als ein
     * Protokoll. Und ohne diesen Weg blieben alle vor der Genre-Spalte
     * angelegten Charaktere dauerhaft „Gegenwart".
     */
    genre: z.enum(GENRE_TEMPLATES.map((g) => g.id) as [string, ...string[]]),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, {
    message: "Keine Änderung angegeben.",
  });

// Einzelnen Charakter laden.
export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const character = await loadCharacter(id);
  if (!character) {
    return NextResponse.json(
      { error: "Charakter nicht gefunden." },
      { status: 404 },
    );
  }
  return NextResponse.json({ character });
}

// Charakter aktualisieren (Teil-Update).
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
      scenarioId?: string | null;
      shortDescription?: string;
      description?: string;
      traits?: string;
      storyHooks?: string;
      input?: string;
    } = {};
    if (p.name !== undefined) data.name = p.name;
    if (p.scenarioId !== undefined) data.scenarioId = p.scenarioId;
    if (p.shortDescription !== undefined)
      data.shortDescription = p.shortDescription;
    if (p.description !== undefined) data.description = p.description;
    if (p.traits !== undefined) data.traits = JSON.stringify(p.traits);
    if (p.storyHooks !== undefined) data.storyHooks = p.storyHooks;

    /**
     * Das Genre wird in die **gespeicherten** Vorgaben hineingeschrieben, statt
     * ein vom Client geschicktes `input` zu übernehmen: So kann ein Patch die
     * übrigen Vorgaben nicht anrühren, auch nicht versehentlich. Gelesen wird
     * dafür der aktuelle Stand – ein zweiter Rundgang zur DB, aber nur, wenn
     * das Genre wirklich geändert wird.
     */
    if (p.genre !== undefined) {
      const row = await prisma.character.findUnique({
        where: { id },
        select: { input: true },
      });
      if (!row) {
        return NextResponse.json(
          { error: "Charakter nicht gefunden." },
          { status: 404 },
        );
      }
      const input = normalizeInputGenre(JSON.parse(row.input));
      data.input = JSON.stringify({ ...input, genre: p.genre });
    }

    await prisma.character.update({ where: { id }, data });
    return NextResponse.json({ character: await loadCharacter(id) });
  } catch {
    return NextResponse.json(
      { error: "Charakter nicht gefunden." },
      { status: 404 },
    );
  }
}

// Charakter löschen. Die Bilder gehen per onDelete: Cascade mit.
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
