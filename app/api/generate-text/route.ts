import { NextResponse } from "next/server";
import { zodResponseFormat } from "openai/helpers/zod";
import { getTextClient } from "@/lib/openai";
import { buildTextPrompt } from "@/lib/prompts";
import { characterInputSchema, generatedCharacterSchema } from "@/lib/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = characterInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungültige Eingaben.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { client: openai, model, extraParams } = await getTextClient();
    const prompt = buildTextPrompt(parsed.data);

    const completion = await openai.chat.completions.parse({
      model,
      ...extraParams,
      messages: [
        {
          role: "system",
          content:
            "Du bist ein erfahrener Autor und Charakter-Designer. Du erschaffst glaubwürdige, in sich konsistente menschliche Charaktere.",
        },
        { role: "user", content: prompt },
      ],
      response_format: zodResponseFormat(
        generatedCharacterSchema,
        "character",
      ),
      temperature: 0.9,
    });

    const character = completion.choices[0]?.message.parsed;
    if (!character) {
      return NextResponse.json(
        { error: "Das Modell lieferte kein verwertbares Ergebnis." },
        { status: 502 },
      );
    }

    // `model` mitgeben, damit der Client beim Speichern protokollieren kann,
    // womit die Figur erzeugt wurde (landet in `input.model`, s. `schema.ts`).
    return NextResponse.json({ character, model });
  } catch (err) {
    console.error("generate-text error:", err);
    const message =
      err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
