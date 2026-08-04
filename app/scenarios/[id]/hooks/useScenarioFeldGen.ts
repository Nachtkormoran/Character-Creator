"use client";

import { useState } from "react";
import {
  generateScenarioDescription,
  generateScenarioField,
  generateScenarioFigures,
  generateScenarioName,
  generateScenarioPlot,
  generateStoryTitle,
} from "@/lib/client";
import { aktiveEintraege, aktiveFiguren } from "@/lib/figuren";
import { ausgerichtet } from "@/lib/scenarioDocument";
import {
  MAX_PLOT_VARIANTS,
  SCENARIO_LABELS,
  type ScenarioDetails,
  type TextProvider,
} from "@/lib/schema";
import type { ScenarioDocument } from "./useScenarioDocument";

/**
 * **KI-Erzeugung der Felder** eines Szenarios: die ✨-Knöpfe (Ort/Zeit/Regeln/
 * Figuren/Beschreibung/Handlungsentwurf), „Entwurf fortsetzen" und der
 * KI-Name. Hält die **Lauf-Parameter** des Handlungsentwurfs (Zusatzwunsch je
 * Feld, „als Basis", „weiterspinnen", neue Personen) – alle **nicht
 * gespeichert**. `handlungForm`/`handlungTon` kommen aus dem Dokument-Kern
 * (localStorage-gemerkt), das Pro-Lauf-Modell als `handlungProvider`.
 */
export function useScenarioFeldGen(
  doc: ScenarioDocument,
  id: string,
  handlungProvider: TextProvider | "",
) {
  const {
    name,
    setName,
    details,
    setDetails,
    saving,
    setSaveError,
    characters,
    variantenMeta,
    handlungForm,
    handlungTon,
    aktuelleVarianten,
    setVarianten,
    setAktiv,
    setVariantenMeta,
  } = doc;

  const [generatingField, setGeneratingField] = useState<
    keyof ScenarioDetails | null
  >(null);
  // Zusätzliche Wünsche je Feld – nicht gespeichert (beschreibt einen Lauf).
  const [zusatz, setZusatz] = useState<
    Partial<Record<keyof ScenarioDetails, string>>
  >({});
  // Lauf-Parameter des Handlungsentwurfs (nicht gespeichert).
  const [handlungAlsBasis, setHandlungAlsBasis] = useState(false);
  const [handlungWeiterspinnen, setHandlungWeiterspinnen] = useState(false);
  const [handlungNeuePersonen, setHandlungNeuePersonen] = useState(0);
  const [handlungNeuePersonenWunsch, setHandlungNeuePersonenWunsch] =
    useState("");
  // KI-Name (Busy/Fehler).
  const [nameBusy, setNameBusy] = useState(false);
  const [nameFehler, setNameFehler] = useState<string | null>(null);

  /**
   * Ein Textfeld per KI erzeugen. Ort/Zeit/Regeln/Figuren werden **ergänzt**, der
   * Handlungsentwurf als **neue Variante angehängt**, nur die Beschreibung
   * **ersetzt** (mit Rückfrage). Das Ergebnis landet als ungespeicherte Änderung.
   */
  async function handleGenerate(key: keyof ScenarioDetails, anzahl?: number) {
    if (generatingField) return;
    const ersetzt = key === "beschreibung";
    if (
      ersetzt &&
      details[key].trim() &&
      !confirm(`${SCENARIO_LABELS[key]} wird ersetzt. Fortfahren?`)
    )
      return;
    setGeneratingField(key);
    setSaveError(null);
    try {
      if (key === "ort" || key === "zeit" || key === "regeln") {
        const { wert } = await generateScenarioField(
          key,
          name.trim(),
          details,
          zusatz[key] ?? "",
        );
        setDetails((d) => ({ ...d, [key]: wert }));
      } else if (key === "figuren") {
        const { wert } = await generateScenarioFigures(
          name.trim(),
          details,
          zusatz.figuren ?? "",
          anzahl,
          // Die angelegten Charaktere (Protagonisten markiert) als Kontext –
          // damit neue Figuren sich auf sie beziehen und sie nicht doppeln.
          characters.map((c) => ({
            name: c.character.name,
            kurzbeschreibung: c.character.kurzbeschreibung,
            isProtagonist: c.isProtagonist,
          })),
        );
        setDetails((d) => ({ ...d, figuren: wert }));
      } else if (key === "handlung") {
        // Jeder Lauf hängt einen **neuen** Entwurf an und schaltet auf ihn um.
        if (aktuelleVarianten().length >= MAX_PLOT_VARIANTS) {
          setSaveError(
            `Mehr als ${MAX_PLOT_VARIANTS} Entwürfe werden nicht gespeichert. Lösche einen, um Platz zu schaffen.`,
          );
          return;
        }
        const basis =
          handlungAlsBasis && details.handlung.trim() ? details.handlung : "";
        const { handlung, model } = await generateScenarioPlot(
          id,
          name.trim(),
          // Nur **aktive** Figuren und **aktive** Handlungselemente (reiner Text).
          {
            ...details,
            figuren: aktiveFiguren(details.figuren),
            handlungselemente: aktiveEintraege(details.handlungselemente),
          },
          zusatz.handlung ?? "",
          basis,
          handlungWeiterspinnen,
          handlungTon,
          handlungNeuePersonen,
          handlungNeuePersonenWunsch,
          handlungForm,
          handlungProvider,
        );
        let titel = "";
        try {
          titel = await generateStoryTitle(handlung, "entwurf");
        } catch {
          // Titel ist Beiwerk.
        }
        const alt = aktuelleVarianten();
        setVarianten([...alt, handlung]);
        setAktiv(alt.length);
        setDetails((d) => ({ ...d, handlung }));
        setVariantenMeta([
          ...ausgerichtet(variantenMeta, alt.length),
          {
            titel,
            form: handlungForm,
            ton: handlungTon,
            favorit: false,
            quelle: "",
            modell: model,
            werkform: "",
            cover: "",
            alsBuch: false,
          },
        ]);
      } else {
        const { beschreibung } = await generateScenarioDescription(
          name.trim(),
          details,
          zusatz.beschreibung ?? "",
        );
        setDetails((d) => ({ ...d, beschreibung }));
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setGeneratingField(null);
    }
  }

  /**
   * **Den aktiven Handlungsentwurf fortsetzen** – kein neuer Reiter, sondern der
   * vorhandene Text im Feld wächst weiter (die Route liefert nur die Fortsetzung,
   * die an `details.handlung` angehängt wird). Nutzt dieselben Lauf-Parameter.
   */
  async function handlungFortsetzen() {
    if (generatingField || saving) return;
    if (!details.handlung.trim()) return;
    setGeneratingField("handlung");
    setSaveError(null);
    try {
      const { handlung: fortsetzung } = await generateScenarioPlot(
        id,
        name.trim(),
        {
          ...details,
          figuren: aktiveFiguren(details.figuren),
          handlungselemente: aktiveEintraege(details.handlungselemente),
        },
        zusatz.handlung ?? "",
        details.handlung, // basis = der fortzusetzende Text
        handlungWeiterspinnen,
        handlungTon,
        handlungNeuePersonen,
        handlungNeuePersonenWunsch,
        handlungForm,
        handlungProvider,
        true, // fortsetzen
      );
      const neu = fortsetzung.trim();
      if (neu) {
        setDetails((d) => ({
          ...d,
          handlung: `${d.handlung.trimEnd()}\n\n${neu}`,
        }));
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setGeneratingField(null);
    }
  }

  /**
   * Namen aus den Welt-Feldern (Beschreibung/Ort/Zeit/Regeln) per KI erzeugen.
   * Der Vorschlag geht ins Namensfeld (Bearbeitungs-Zustand → `dirty`).
   */
  async function nameErzeugen() {
    if (nameBusy) return;
    setNameBusy(true);
    setNameFehler(null);
    try {
      const vorschlag = await generateScenarioName(details);
      if (vorschlag) setName(vorschlag);
    } catch (e) {
      setNameFehler(e instanceof Error ? e.message : "Name fehlgeschlagen.");
    } finally {
      setNameBusy(false);
    }
  }

  return {
    generatingField,
    zusatz,
    setZusatz,
    handlungAlsBasis,
    setHandlungAlsBasis,
    handlungWeiterspinnen,
    setHandlungWeiterspinnen,
    handlungNeuePersonen,
    setHandlungNeuePersonen,
    handlungNeuePersonenWunsch,
    setHandlungNeuePersonenWunsch,
    nameBusy,
    nameFehler,
    handleGenerate,
    handlungFortsetzen,
    nameErzeugen,
  };
}
