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
