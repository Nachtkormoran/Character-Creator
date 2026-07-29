import { prisma } from "./prisma";
import { serializeScenario, type StoredScenario } from "./serialize";

/**
 * Serverseitige Bild-Operationen eines Szenarios – **wortgleich** zu
 * `characterImages.ts`, nur am Szenario statt am Charakter.
 *
 * Alle Schreibvorgänge laufen hier zusammen, weil sie eine Regel einhalten
 * müssen, die die Datenbank nicht erzwingt: **genau ein Bild pro Szenario ist
 * `isPrimary`**. Jede Änderung daran passiert in einer Transaktion, die zuerst
 * alle anderen Markierungen entfernt.
 */

/**
 * Bilder immer ohne `imageData` mitladen (~2 MB je Stück) und die
 * Charakter-Anzahl fürs `count` – so genügt eine Ladefunktion für alle
 * schreibenden Routen, die das aktualisierte Szenario zurückgeben.
 */
const withImages = {
  images: {
    orderBy: { createdAt: "desc" },
    omit: { imageData: true },
  },
  _count: { select: { characters: true } },
} as const;

/** Ein Szenario samt Bild-Metadaten laden (für die Rückgabe der Bild-Routen). */
export async function loadScenario(
  id: string,
): Promise<StoredScenario | null> {
  const row = await prisma.scenario.findUnique({
    where: { id },
    include: withImages,
  });
  return row ? serializeScenario(row) : null;
}

/**
 * Fügt ein Weltbild hinzu und macht es zum Primärbild – ein gerade erzeugtes
 * oder hochgeladenes Bild ist fast immer das gewünschte.
 */
export async function addScenarioImage(
  scenarioId: string,
  imageData: string,
  thumbnail: string | null,
  makePrimary = true,
): Promise<StoredScenario | null> {
  const exists = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    select: { id: true },
  });
  if (!exists) return null;

  await prisma.$transaction(async (tx) => {
    if (makePrimary) {
      await tx.scenarioImage.updateMany({
        where: { scenarioId },
        data: { isPrimary: false },
      });
    }
    await tx.scenarioImage.create({
      data: { scenarioId, imageData, thumbnail, isPrimary: makePrimary },
    });
  });

  return loadScenario(scenarioId);
}

/** Markiert genau ein Bild als Primärbild. */
export async function setPrimaryScenarioImage(
  scenarioId: string,
  imageId: string,
): Promise<StoredScenario | null> {
  const image = await prisma.scenarioImage.findFirst({
    where: { id: imageId, scenarioId },
    select: { id: true },
  });
  if (!image) return null;

  await prisma.$transaction([
    prisma.scenarioImage.updateMany({
      where: { scenarioId },
      data: { isPrimary: false },
    }),
    prisma.scenarioImage.update({
      where: { id: imageId },
      data: { isPrimary: true },
    }),
  ]);

  return loadScenario(scenarioId);
}

/**
 * Löscht ein Bild. War es das Primärbild, rückt das neueste verbliebene nach –
 * sonst stünde das Szenario ohne großes Bild da, obwohl noch Bilder da sind.
 */
export async function deleteScenarioImage(
  scenarioId: string,
  imageId: string,
): Promise<StoredScenario | null> {
  const image = await prisma.scenarioImage.findFirst({
    where: { id: imageId, scenarioId },
    select: { id: true, isPrimary: true },
  });
  if (!image) return null;

  await prisma.$transaction(async (tx) => {
    await tx.scenarioImage.delete({ where: { id: imageId } });
    if (!image.isPrimary) return;
    const next = await tx.scenarioImage.findFirst({
      where: { scenarioId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (next) {
      await tx.scenarioImage.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  });

  return loadScenario(scenarioId);
}
