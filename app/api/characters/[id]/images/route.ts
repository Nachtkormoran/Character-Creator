import { NextResponse } from "next/server";
import { z } from "zod";
import { addImage } from "@/lib/characterImages";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

// Ein Original ist als Base64-Data-URL ~2 MB groß; 12 MB lassen Luft für
// hochgeladene Bilder, ohne die Route zum Datei-Ablageplatz zu machen.
const MAX_IMAGE_CHARS = 12_000_000;

const addSchema = z.object({
  imageData: z
    .string()
    .min(1)
    .max(MAX_IMAGE_CHARS, "Das Bild ist zu groß.")
    .refine((v) => v.startsWith("data:image/"), "Kein gültiges Bild."),
  thumbnail: z.string().max(MAX_IMAGE_CHARS).nullable().optional(),
  makePrimary: z.boolean().optional(),
});

// Bild hinzufügen. Standardmäßig wird es zum Primärbild.
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  try {
    const parsed = addSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Ungültige Daten." },
        { status: 400 },
      );
    }
    const { imageData, thumbnail, makePrimary = true } = parsed.data;
    const character = await addImage(
      id,
      imageData,
      thumbnail ?? null,
      makePrimary,
    );
    if (!character) {
      return NextResponse.json(
        { error: "Charakter nicht gefunden." },
        { status: 404 },
      );
    }
    return NextResponse.json({ character });
  } catch (err) {
    console.error("add image error:", err);
    return NextResponse.json(
      { error: "Bild speichern fehlgeschlagen." },
      { status: 500 },
    );
  }
}
