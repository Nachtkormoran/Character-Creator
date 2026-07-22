import { NextResponse } from "next/server";
import { z } from "zod";
import { getTextClient } from "@/lib/openai";
import { buildChapterTextPrompt, type ChapterCharacter } from "@/lib/prompts";
import {
  MAX_KAPITEL_PRO_STUFE,
  normalizeTraits,
  scenarioDetailsSchema,
} from "@/lib/schema";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Der **ausformulierte Prosatext eines Kapitels** – eine Ebene unter der
 * Kapitel-Ableitung (`story-arc-chapters`, die nur Überschrift + zwei bis drei
 * Sätze liefert). Hier entsteht die ausgeschriebene Szene: genaue Personen und
 * ihre Tätigkeiten, Atmosphäre des Ortes, Dialog in wörtlicher Rede.
 *
 * Wie `scenario-plot` lädt die Route die **Figuren selbst** über die
 * `scenarioId` und reicht die zur Station gehörenden mit ihren Merkmalen in den
 * Prompt, damit der Text sie stimmig schildert. Die **Festlegungen und das
 * Kapitel** kommen dagegen aus dem Request – beide können in der Detailansicht
 * ungespeichert bearbeitet sein.
 *
 * **Freitext, kein Structured Output** (eine Szene ist ein Fließtext), und wie
 * alle Erzeugen-Routen **persistiert sie nichts** – der Text geht in den
 * Bearbeitungs-Zustand und wird über „Änderungen speichern" mit dem Arc
 * abgelegt.
 */
const bodySchema = z.object({
  scenarioId: z.string().min(1),
  details: scenarioDetailsSchema,
  stufe: z.object({
    titel: z.string().trim().max(200).optional().default(""),
    beschreibung: z.string().trim().max(5000).optional().default(""),
    figuren: z.array(z.string().trim().max(120)).max(30).optional().default([]),
  }),
  // **Alle** Kapitel der Station plus der Index des auszuschreibenden. Die
  // ganze Liste geht mit, damit der Prompt die Grenzen kennt und nur das eine
  // Kapitel ausschreibt statt der ganzen Station.
  kapitelListe: z
    .array(
      z.object({
        titel: z.string().trim().max(200).optional().default(""),
        inhalt: z.string().trim().max(2000).optional().default(""),
      }),
    )
    .min(1)
    .max(MAX_KAPITEL_PRO_STUFE),
  kapitelIndex: z.number().int().min(0),
  // Ton und Sprache – ohne Allowlist als String (unbekannt = kein Ton-Block).
  ton: z.string().trim().max(40).optional().default(""),
  // Kreativ: längerer, stärker ausgemalter Text; höhere Temperatur.
  kreativ: z.boolean().optional().default(false),
});

/** Zerlegt einen Namen in kleingeschriebene Wortteile (für den Abgleich). */
const teile = (name: string) =>
  new Set(
    name
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungültige Eingaben.", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { scenarioId, details, stufe, kapitelListe, kapitelIndex, ton, kreativ } =
      parsed.data;

    // Der Index muss in die Liste zeigen.
    if (kapitelIndex >= kapitelListe.length) {
      return NextResponse.json(
        { error: "Das gewählte Kapitel liegt außerhalb der Liste." },
        { status: 400 },
      );
    }

    // Ein Kapitel ohne jeden Inhalt gäbe dem Modell kein Gerüst.
    const ziel = kapitelListe[kapitelIndex];
    if (!ziel.inhalt.trim() && !ziel.titel.trim()) {
      return NextResponse.json(
        {
          error:
            "Das Kapitel hat weder Titel noch Inhalt – erst ableiten oder ausfüllen, dann den Text erzeugen.",
        },
        { status: 400 },
      );
    }

    // Die zur Station gehörenden Figuren laden (wie `scenario-plot`), damit der
    // Text sie stimmig schildert. Über ganze Namensteile abgeglichen: „Mira"
    // trifft „Mira Lindqvist", „Alva" nicht „Alvarez".
    const rows = await prisma.character.findMany({
      where: { scenarioId },
      orderBy: { createdAt: "asc" },
      select: { name: true, shortDescription: true, traits: true },
    });

    const gesucht = stufe.figuren.map(teile);
    const figuren: ChapterCharacter[] = rows
      .filter((r) => {
        // Ohne Figuren-Angabe in der Station: alle mitgeben (der Text soll die
        // Besetzung kennen); sonst nur die genannten.
        if (gesucht.length === 0) return true;
        const eigene = teile(r.name ?? "");
        if (eigene.size === 0) return false;
        return gesucht.some((g) => [...eigene].some((w) => g.has(w)));
      })
      .map((r) => ({
        name: r.name ?? "",
        kurzbeschreibung: r.shortDescription ?? "",
        merkmale: normalizeTraits(JSON.parse(r.traits)),
      }));

    const { client: openai, model, extraParams } = await getTextClient();
    const completion = await openai.chat.completions.create({
      model,
      ...extraParams,
      messages: [
        {
          role: "system",
          content:
            "Du bist Erzähler. Du schreibst ausgeschriebene Szenen mit sinnlichen Details und lebendigem Dialog – und antwortest ausschließlich mit dem Szenentext selbst.",
        },
        {
          role: "user",
          content: buildChapterTextPrompt(
            details,
            stufe,
            kapitelListe,
            kapitelIndex,
            figuren,
            { ton, kreativ },
          ),
        },
      ],
      temperature: kreativ ? 0.95 : 0.85,
      // Eine Szene mit Beschreibung und Dialog wird lang; kreativ noch länger.
      max_tokens: kreativ ? 2600 : 1800,
    });

    const text = (completion.choices[0]?.message.content ?? "").trim();
    if (!text) {
      return NextResponse.json(
        { error: "Das Modell lieferte keinen Text." },
        { status: 502 },
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("story-chapter-text error:", err);
    const message = err instanceof Error ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
