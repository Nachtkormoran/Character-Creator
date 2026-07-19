import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadCharacter } from "@/lib/characterImages";
import {
  CHARACTER_FILE_VERSION,
  characterFileSchema,
} from "@/lib/characterFile";
import { normalizeTraits } from "@/lib/schema";

export const runtime = "nodejs";

/**
 * Einen einzelnen Charakter aus einer Exportdatei einspielen – **additiv**.
 *
 * Immer ein Neuanlegen, nie ein Überschreiben: die Datei trägt keine Id, und
 * ein zweiter Import derselben Datei ergibt bewusst einen zweiten Charakter.
 * Wer duplizieren will, soll das können; wer nicht, löscht den zweiten.
 *
 * Charakter und Bilder entstehen in **einer** Transaktion. Der naheliegende Weg
 * – `POST /api/characters` und danach je Bild `POST …/images` – wäre einfacher,
 * ließe bei einem Fehler im dritten Bild aber einen halb importierten Charakter
 * stehen. Deshalb eine eigene Route.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = characterFileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            "Die Datei ist keine gültige Charakter-Exportdatei dieser Anwendung.",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }

    const datei = parsed.data;
    if (datei.version > CHARACTER_FILE_VERSION) {
      return NextResponse.json(
        {
          error:
            `Die Datei hat Format-Version ${datei.version}, diese Anwendung ` +
            `kennt höchstens ${CHARACTER_FILE_VERSION}. Bitte aktualisieren.`,
        },
        { status: 400 },
      );
    }

    const { character, input, images } = datei;

    // Genau ein Primärbild – dieselbe Regel, die `characterImages.ts` hält.
    // Trägt die Datei keine Markierung (oder mehrere), gewinnt das erste Bild.
    const primaerIndex = Math.max(
      0,
      images.findIndex((b) => b.isPrimary),
    );

    const row = await prisma.$transaction(async (tx) => {
      return tx.character.create({
        data: {
          name: character.name,
          input: JSON.stringify(input),
          shortDescription: character.kurzbeschreibung,
          description: character.beschreibung,
          // Fehlende Merkmale auffüllen: die Datei kann aus einem Stand
          // stammen, der ein später ergänztes Merkmal noch nicht kannte.
          traits: JSON.stringify(normalizeTraits(character.merkmale)),
          storyHooks: character.storyHooks || null,
          groupId: null,
          images: {
            create: images.map((b, i) => ({
              imageData: b.imageData,
              thumbnail: b.thumbnail ?? null,
              isPrimary: i === primaerIndex,
            })),
          },
        },
      });
    });

    return NextResponse.json({
      character: await loadCharacter(row.id),
      images: images.length,
    });
  } catch (err) {
    console.error("import character error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
