import { NextResponse } from "next/server";
import { exportDatabase, importDatabase } from "@/lib/backup";

export const runtime = "nodejs";
// Datenbanken mit vielen Bildern sind groß – Import/Export darf dauern.
export const maxDuration = 120;

/** Vollständige Datenbank als Download. */
export async function GET() {
  try {
    const data = await exportDatabase();
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="charakter-creator-${stamp}.db"`,
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importDatabase(buffer);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("backup import error:", err);
    const message =
      err instanceof Error ? err.message : "Import fehlgeschlagen.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
