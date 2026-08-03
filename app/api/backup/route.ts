import { NextResponse } from "next/server";
import { exportDatabase, importDatabase, type ImportMode } from "@/lib/backup";

export const runtime = "nodejs";
// Datenbanken mit vielen Bildern sind groß – Import/Export darf dauern.
export const maxDuration = 120;

/**
 * Vollständige Datenbank als Download. Mit `?originals=false` bleiben die großen
 * Bild-Originale draußen (die Thumbnails sind immer dabei) – eine schlanke
 * Sicherung.
 */
export async function GET(request: Request) {
  try {
    const includeOriginals =
      new URL(request.url).searchParams.get("originals") !== "false";
    const data = await exportDatabase({ includeOriginals });
    const stamp = new Date().toISOString().slice(0, 10);
    const suffix = includeOriginals ? "" : "-ohne-originale";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="charakter-creator-${stamp}${suffix}.db"`,
        "Content-Length": String(data.length),
      },
    });
  } catch (err) {
    console.error("backup export error:", err);
    return NextResponse.json(
      { error: "Export fehlgeschlagen." },
      { status: 500 },
    );
  }
}

/**
 * Datenbank aus einer hochgeladenen Datei wiederherstellen.
 * **Ersetzt den gesamten Bestand** – die Bestätigung passiert in der UI.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Keine Datei übermittelt." },
        { status: 400 },
      );
    }
    // Import-Modus aus dem Formular; alles außer „additive" bleibt beim
    // sicheren Standard „replace".
    const mode: ImportMode =
      form.get("mode") === "additive" ? "additive" : "replace";

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importDatabase(buffer, mode);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("backup import error:", err);
    const message =
      err instanceof Error ? err.message : "Import fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
