import { prisma } from "./prisma";
import { serializeCharacter, type StoredCharacter } from "./serialize";

/**
 * Serverseitige Bild-Operationen eines Charakters.
 *
 * Alle Schreibvorgänge laufen hier zusammen, weil sie eine Regel einhalten
 * müssen, die die Datenbank nicht erzwingt: **genau ein Bild pro Charakter ist
 * `isPrimary`**. Jede Änderung daran passiert in einer Transaktion, die zuerst
 * alle anderen Markierungen entfernt.
 */

/**
 * Bilder immer ohne `imageData` mitladen. Die Originale sind je ~2 MB – ein
 * Charakter mit fünf Bildern ergäbe sonst eine 10-MB-Antwort, obwohl für die
 * Anzeige die Thumbnails genügen.
 */
const withImages = {
  images: {
    orderBy: { createdAt: "desc" },
    omit: { imageData: true },
  },
} as const;

/** Einen Charakter samt Bild-Metadaten laden. */
export async function loadCharacter(
  id: string,
): Promise<StoredCharacter | null> {
  const row = await prisma.character.findUnique({
    where: { id },
    include: withImages,
  });
  return row ? serializeCharacter(row) : null;
}

/** Alle Charaktere, neueste zuerst. */
export async function loadCharacters(): Promise<StoredCharacter[]> {
  const rows = await prisma.character.findMany({
    orderBy: { createdAt: "desc" },
    include: withImages,
  });
  return rows.map(serializeCharacter);
}

/**
 * Fügt ein Bild hinzu und macht es zum Primärbild.
 *
 * Neu erzeugte oder hochgeladene Bilder sollen sofort das große Bild sein –
 * das ist fast immer die Absicht und erspart einen zweiten Klick.
 */
export async function addImage(
  characterId: string,
  imageData: string,
  thumbnail: string | null,
  makePrimary = true,
): Promise<StoredCharacter | null> {
  const exists = await prisma.character.findUnique({
    where: { id: characterId },
    select: { id: true },
  });
  if (!exists) return null;

  await prisma.$transaction(async (tx) => {
    if (makePrimary) {
      await tx.characterImage.updateMany({
        where: { characterId },
        data: { isPrimary: false },
      });
    }
    await tx.characterImage.create({
      data: { characterId, imageData, thumbnail, isPrimary: makePrimary },
    });
  });

  return loadCharacter(characterId);
}

/** Markiert genau ein Bild als Primärbild. */
export async function setPrimaryImage(
  characterId: string,
  imageId: string,
): Promise<StoredCharacter | null> {
  const image = await prisma.characterImage.findFirst({
    where: { id: imageId, characterId },
    select: { id: true },
  });
  if (!image) return null;

  await prisma.$transaction([
    prisma.characterImage.updateMany({
      where: { characterId },
      data: { isPrimary: false },
    }),
    prisma.characterImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    }),
  ]);

  return loadCharacter(characterId);
}

/**
 * Löscht ein Bild. War es das Primärbild, rückt das neueste verbliebene nach –
 * sonst stünde der Charakter ohne großes Bild da, obwohl noch Bilder da sind.
 */
export async function deleteImage(
  characterId: string,
  imageId: string,
): Promise<StoredCharacter | null> {
  const image = await prisma.characterImage.findFirst({
    where: { id: imageId, characterId },
    select: { id: true, isPrimary: true },
  });
  if (!image) return null;

  await prisma.$transaction(async (tx) => {
    await tx.characterImage.delete({ where: { id: imageId } });
    if (!image.isPrimary) return;
    const next = await tx.characterImage.findFirst({
      where: { characterId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (next) {
      await tx.characterImage.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  });

  return loadCharacter(characterId);
}
