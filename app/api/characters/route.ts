import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loadCharacter, loadCharacters } from "@/lib/characterImages";
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
  scenarioId: z.string().nullable().optional(),
});

// Alle gespeicherten Charaktere (neueste zuerst).
//
// Die Bilder kommen **ohne** `imageData` mit: die Originale sind je ~2 MB und
// würden die Antwort auf zweistellige Megabyte treiben. Für die Anzeige genügt
// das Thumbnail des Primärbilds; ein Original holt die Oberfläche bei Bedarf
// einzeln über `GET /api/characters/[id]/images/[imageId]` nach.
export async function GET() {
  return NextResponse.json({ characters: await loadCharacters() });
}

// Neuen Charakter speichern. Ein mitgegebenes Bild wird sein erstes und
// zugleich primäres Bild.
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

    const { input, character, imageData, thumbnail, scenarioId } = parsed.data;
    const row = await prisma.character.create({
      data: {
        name: character.name,
        input: JSON.stringify(input),
        shortDescription: character.kurzbeschreibung,
        description: character.beschreibung,
        traits: JSON.stringify(character.merkmale),
        scenarioId: scenarioId ?? null,
        images: imageData
          ? {
              create: {
                imageData,
                thumbnail: thumbnail ?? null,
                isPrimary: true,
              },
            }
          : undefined,
      },
    });

    return NextResponse.json({ character: await loadCharacter(row.id) });
  } catch (err) {
    console.error("save character error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
