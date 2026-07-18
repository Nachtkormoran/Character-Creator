import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { serializeCharacter } from "@/lib/serialize";
import {
  characterInputSchema,
  generatedCharacterSchema,
} from "@/lib/schema";

export const runtime = "nodejs";

const saveSchema = z.object({
  input: characterInputSchema,
  character: generatedCharacterSchema,
  imageData: z.string().nullable().optional(),
  thumbnail: z.string().nullable().optional(),
  groupId: z.string().nullable().optional(),
});

// Alle gespeicherten Charaktere (neueste zuerst).
//
// **Ohne** `imageData`: die Originale sind je ~2 MB und würden die Antwort auf
// zweistellige Megabyte treiben. Für die Anzeige genügt `thumbnail`; das
// Original holt die Detailansicht bei Bedarf über
// `GET /api/characters/[id]` nach (Vollbild, PDF-Export).
export async function GET() {
  const rows = await prisma.character.findMany({
    orderBy: { createdAt: "desc" },
    omit: { imageData: true },
  });
  return NextResponse.json({ characters: rows.map(serializeCharacter) });
}

// Neuen Charakter speichern.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungültige Daten.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { input, character, imageData, thumbnail, groupId } = parsed.data;
    const row = await prisma.character.create({
      data: {
        name: character.name,
        input: JSON.stringify(input),
        shortDescription: character.kurzbeschreibung,
        description: character.beschreibung,
        traits: JSON.stringify(character.merkmale),
        imageData: imageData ?? null,
        thumbnail: thumbnail ?? null,
        groupId: groupId ?? null,
      },
    });

    return NextResponse.json({ character: serializeCharacter(row) });
  } catch (err) {
    console.error("save character error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
