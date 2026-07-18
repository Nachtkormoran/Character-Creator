import { NextResponse } from "next/server";
import { settingsPatchSchema } from "@/lib/schema";
import { getSettings, updateSettings } from "@/lib/settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ settings: await getSettings() });
  } catch (err) {
    console.error("settings GET error:", err);
    return NextResponse.json(
      { error: "Einstellungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    // .partial(): jede Einstellung kann einzeln geändert werden.
    const parsed = settingsPatchSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungültige Einstellung.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json({ settings: await updateSettings(parsed.data) });
  } catch (err) {
    console.error("settings PATCH error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
