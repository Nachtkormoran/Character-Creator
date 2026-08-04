"use client";

import { useState } from "react";
import { generateChapterText, generateStoryArcChapters } from "@/lib/client";
import { aktiveFiguren } from "@/lib/figuren";
import type { TextProvider } from "@/lib/schema";
import type { ScenarioDocument } from "./useScenarioDocument";

/**
 * **Kapitel einer Station**: ableiten (Titel + Inhalt) und den **Prosatext**
 * eines Kapitels ausschreiben. Die Kapitel liegen **in** der Station des aktiven
 * Arcs (`doc.storyArc`), gehen also über denselben Arc-Speicher; hier nur die
 * Erzeugung + der transiente Busy-/Fehler-/Modell-Zustand (nach Reload weg). Ton/
 * Erzählform/Kapitellänge/„kreativ" kommen aus `doc.arcParams`, das Modell aus
 * dem Pro-Lauf-`provider`.
 */
export function useKapitel(
  doc: ScenarioDocument,
  id: string,
  provider: TextProvider | "",
) {
  const { storyArc, setStoryArc, details, arcParams } = doc;

  const [kapitelBusy, setKapitelBusy] = useState<number | null>(null);
  const [kapitelFehler, setKapitelFehler] = useState<{
    index: number;
    text: string;
  } | null>(null);
  const [kapitelTextBusy, setKapitelTextBusy] = useState<{
    stufe: number;
    kapitel: number;
  } | null>(null);
  const [kapitelTextFehler, setKapitelTextFehler] = useState<{
    stufe: number;
    kapitel: number;
    text: string;
  } | null>(null);
  // Transiente Modell-Anzeige (Station-Index → Modell bzw. „stufe-kapitel" → Modell).
  const [kapitelModell, setKapitelModell] = useState<Record<number, string>>({});
  const [storyTextModell, setStoryTextModell] = useState<Record<string, string>>(
    {},
  );

  /**
   * Kapitel für eine Station ableiten. Die Station geht im **aktuell
   * bearbeiteten** Stand mit; das Ergebnis ersetzt ihre Kapitel als
   * ungespeicherte Änderung – „Verwerfen" bringt die alten zurück.
   */
  async function kapitelAbleiten(stufeIndex: number) {
    if (kapitelBusy !== null) return;
    const stufe = storyArc.stufen[stufeIndex];
    if (!stufe || !stufe.beschreibung.trim()) return;
    setKapitelBusy(stufeIndex);
    setKapitelFehler(null);
    try {
      const { kapitel, model } = await generateStoryArcChapters(
        {
          titel: stufe.titel,
          beschreibung: stufe.beschreibung,
          figuren: stufe.figuren,
        },
        {
          kreativ: arcParams.kreativ,
          anzahl: arcParams.kapitelAnzahl,
          ton: arcParams.ton,
          form: arcParams.form,
          textProvider: provider,
          // Volle Besetzung (opt-in): Charaktere lädt die Route über die
          // scenarioId, die aktiven Figuren-Notizen gehen als Text mit.
          mitBesetzung: arcParams.kapitelMitBesetzung,
          scenarioId: id,
          figurenNotizen: aktiveFiguren(details.figuren),
        },
      );
      setKapitelModell((m) => ({ ...m, [stufeIndex]: model }));
      // Die Route liefert nur Titel und Inhalt; der Prosatext (`text`) entsteht
      // erst später – hier leer auffüllen, damit das Kapitel dem Typ genügt.
      setStoryArc((arc) => ({
        stufen: arc.stufen.map((s, k) =>
          k === stufeIndex
            ? { ...s, kapitel: kapitel.map((c) => ({ ...c, text: c.text ?? "" })) }
            : s,
        ),
      }));
    } catch (e) {
      setKapitelFehler({
        index: stufeIndex,
        text: e instanceof Error ? e.message : "Fehler.",
      });
    } finally {
      setKapitelBusy(null);
    }
  }

  /**
   * Den **Prosatext** eines Kapitels erzeugen. Station und Kapitel gehen im
   * aktuell bearbeiteten Stand mit; die Figuren lädt die Route selbst. Das
   * Ergebnis ersetzt `kapitel.text` als ungespeicherte Änderung.
   */
  async function kapitelTextGenerieren(
    stufeIndex: number,
    kapitelIndex: number,
  ) {
    if (kapitelTextBusy) return;
    const stufe = storyArc.stufen[stufeIndex];
    const kapitel = stufe?.kapitel[kapitelIndex];
    if (!kapitel || (!kapitel.inhalt.trim() && !kapitel.titel.trim())) return;
    setKapitelTextBusy({ stufe: stufeIndex, kapitel: kapitelIndex });
    setKapitelTextFehler(null);
    try {
      const { text, model } = await generateChapterText(
        id,
        details,
        {
          titel: stufe.titel,
          beschreibung: stufe.beschreibung,
          figuren: stufe.figuren,
        },
        // Die **ganze** Kapitelliste der Station plus der Index – so schreibt die
        // Route nur dieses eine Kapitel aus, nicht die ganze Station.
        stufe.kapitel.map((c) => ({ titel: c.titel, inhalt: c.inhalt })),
        kapitelIndex,
        {
          ton: arcParams.ton,
          kreativ: arcParams.kreativ,
          form: arcParams.form,
          kapitelLaenge: arcParams.kapitelLaenge,
          werkform: arcParams.werkform,
          textProvider: provider,
        },
      );
      setStoryTextModell((m) => ({
        ...m,
        [`${stufeIndex}-${kapitelIndex}`]: model,
      }));
      setStoryArc((arc) => ({
        stufen: arc.stufen.map((s, si) =>
          si === stufeIndex
            ? {
                ...s,
                kapitel: s.kapitel.map((c, ki) =>
                  ki === kapitelIndex ? { ...c, text } : c,
                ),
              }
            : s,
        ),
      }));
    } catch (e) {
      setKapitelTextFehler({
        stufe: stufeIndex,
        kapitel: kapitelIndex,
        text: e instanceof Error ? e.message : "Fehler.",
      });
    } finally {
      setKapitelTextBusy(null);
    }
  }

  return {
    kapitelBusy,
    kapitelFehler,
    kapitelTextBusy,
    kapitelTextFehler,
    kapitelModell,
    storyTextModell,
    kapitelAbleiten,
    kapitelTextGenerieren,
  };
}
