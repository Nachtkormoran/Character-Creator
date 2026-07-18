/**
 * Liest eine vom Nutzer ausgewählte Bilddatei ein und gibt sie als Data-URL
 * (base64) zurück – im selben Format, wie es auch die generierten Bilder haben.
 *
 * Große Bilder werden auf `maxSize` (längste Kante) herunterskaliert und als
 * JPEG re-kodiert, damit die in der DB gespeicherten Daten nicht unnötig groß
 * werden. Läuft nur im Browser (nutzt FileReader/Canvas).
 */
export async function fileToDataUrl(
  file: File,
  maxSize = 1024,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Bitte eine Bilddatei auswählen.");
  }

  const originalDataUrl = await readAsDataUrl(file);
  const img = await loadImage(originalDataUrl);

  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  // Klein genug und ohnehin schon komprimiert → unverändert übernehmen.
  if (scale === 1 && file.size <= 1_500_000) {
    return originalDataUrl;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return originalDataUrl;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

/** Längste Kante des Vorschaubilds. Deckt die größte Anzeigestelle
 *  (278 CSS-px in der Ergebnisansicht) auch bei doppelter Pixeldichte ab. */
export const THUMBNAIL_SIZE = 640;

/**
 * Erzeugt aus einer Bild-Data-URL eine verkleinerte Fassung für die Anzeige in
 * Galerie und Detailansicht. Das Original bleibt unangetastet und wird für die
 * Vollbild-Ansicht und den PDF-Export weiterverwendet.
 *
 * Läuft nur im Browser (Canvas). WebP mit Qualität 0,85; fällt auf JPEG
 * zurück, falls WebP nicht unterstützt wird.
 */
export async function makeThumbnail(
  dataUrl: string,
  maxSize = THUMBNAIL_SIZE,
): Promise<string> {
  const img = await loadImage(dataUrl);

  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const webp = canvas.toDataURL("image/webp", 0.85);
  // Browser ohne WebP-Unterstützung liefern stillschweigend ein PNG zurück.
  return webp.startsWith("data:image/webp")
    ? webp
    : canvas.toDataURL("image/jpeg", 0.85);
}

/** Obergrenze für Referenzbilder. Darüber skaliert die API ohnehin herunter. */
export const REFERENCE_MAX_SIZE = 1536;

/**
 * Liest ein Referenzbild für die Bildgenerierung ein.
 *
 * Anders als `fileToDataUrl` wird **nicht** verlustbehaftet re-kodiert: das
 * Modell liest die Vorlage aus, und JPEG-Artefakte kann es als gewollte
 * Bildmerkmale missdeuten (Kompressionsraster als Hauttextur o. Ä.). Kleine
 * Bilder werden unverändert durchgereicht, große verlustfrei als PNG
 * verkleinert.
 */
export async function fileToReferenceDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Bitte eine Bilddatei auswählen.");
  }

  const originalDataUrl = await readAsDataUrl(file);
  const img = await loadImage(originalDataUrl);

  if (Math.max(img.width, img.height) <= REFERENCE_MAX_SIZE) {
    return originalDataUrl; // unverändert – keine zusätzlichen Artefakte
  }

  const scale = REFERENCE_MAX_SIZE / Math.max(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return originalDataUrl;

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png"); // verlustfrei
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () =>
      reject(new Error("Die Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error("Das Bild konnte nicht geladen werden."));
    img.src = src;
  });
}
