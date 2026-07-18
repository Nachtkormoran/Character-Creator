/**
 * Clientseitige Download-Helfer. Liegen hier, weil sowohl die Galerie
 * (PDF-Export) als auch die Bilder-Ansicht (Bild-Export je Bild) sie brauchen.
 * Alle setzen `document` voraus, laufen also nur im Browser.
 */

/** Löst den Download eines Blobs als Datei aus. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Dateiendung aus dem MIME-Typ einer Data-URL. Generierte Bilder sind PNG,
 * Uploads können JPEG sein – die Endung muss zum Inhalt passen.
 */
export function imageExtension(dataUrl: string): string {
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  if (mime === "image/jpeg") return "jpg";
  const subtype = mime.split("/")[1];
  return subtype && /^[a-z0-9]+$/.test(subtype) ? subtype : "png";
}

/** Erzeugt aus einem Charakternamen einen dateisystem-tauglichen Namen. */
export function safeFileName(name: string): string {
  const clean = name
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return clean || "charakter";
}

/** Lädt eine Data-URL als Bilddatei herunter (Endung passend zum MIME-Typ). */
export async function downloadImage(dataUrl: string, baseName: string) {
  // fetch() kann Data-URLs direkt in einen Blob wandeln.
  const blob = await (await fetch(dataUrl)).blob();
  downloadBlob(blob, `${baseName}.${imageExtension(dataUrl)}`);
}
