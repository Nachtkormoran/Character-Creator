"use client";

import { useState } from "react";
import { findFigurePersons, findPlotPersons } from "@/lib/client";
import { stashPlotPerson } from "@/lib/personHandoff";
import { joinFigurenDetail, splitFigurenDetail } from "@/lib/figuren";
import type { PlotPerson } from "@/lib/schema";
import type { ScenarioDocument } from "./useScenarioDocument";

/**
 * **Personen aus dem Handlungsentwurf** (und aus einzelnen Figuren-Notizen):
 * suchen, was der Entwurf an noch nicht zugeordneten Personen nennt, und daraus
 * per Formular-Übergabe (`sessionStorage`) einen Charakter anlegen. Enthält auch
 * die **Figur→Charakter**-Extraktion je Karte samt dem
 * `speichern(neueDetails)`-vor-Navigation-Trick (die Figur wird aus der Liste
 * genommen, und die Entfernung muss den Seitenwechsel ins Formular überleben).
 */
export function usePlotPersonen(
  doc: ScenarioDocument,
  id: string,
  router: { push: (href: string) => void },
) {
  const { details, setDetails, nameValid, speichern } = doc;

  // Suchergebnis **zusammen mit dem Text, zu dem es gehört** – ein Ergebnis zählt
  // nur, solange sein Text noch der aktuelle ist (Gültigkeit abgeleitet statt per
  // Effekt zurückgesetzt).
  const [ergebnis, setErgebnis] = useState<{
    handlung: string;
    personen: PlotPerson[] | null;
    fehler: string | null;
  } | null>(null);
  const [suchend, setSuchend] = useState(false);
  // Die Person, für die gerade die Rückfrage (Plot-Suche) offen ist.
  const [gewaehlt, setGewaehlt] = useState<PlotPerson | null>(null);
  // Figur→Charakter: gerade ausgelesene Figur (sperrt), Fehler, und der Kandidat.
  const [figurBusy, setFigurBusy] = useState<string | null>(null);
  const [figurFehler, setFigurFehler] = useState<{
    figur: string;
    text: string;
  } | null>(null);
  const [figurKandidat, setFigurKandidat] = useState<{
    person: PlotPerson;
    figur: string;
  } | null>(null);

  const aktuell =
    ergebnis && ergebnis.handlung === details.handlung ? ergebnis : null;
  /** `null` = „noch nicht gesucht", `[]` = „gesucht, nichts gefunden". */
  const personen = aktuell?.personen ?? null;
  const suchFehler = aktuell?.fehler ?? null;

  async function personenSuchen() {
    const handlung = details.handlung;
    if (suchend || !handlung.trim()) return;
    setSuchend(true);
    setErgebnis(null);
    try {
      const { personen } = await findPlotPersons(id, handlung);
      setErgebnis({ handlung, personen, fehler: null });
    } catch (e) {
      setErgebnis({
        handlung,
        personen: null,
        fehler: e instanceof Error ? e.message : "Fehler.",
      });
    } finally {
      setSuchend(false);
    }
  }

  /**
   * Die Person ans Erstellen-Formular übergeben (`sessionStorage`, s.
   * `personHandoff.ts`); `?scenario=` löst Zuordnung und Weltvorbelegung aus.
   */
  function personAnlegen(person: PlotPerson) {
    stashPlotPerson(person);
    router.push(`/?scenario=${id}`);
  }

  /**
   * Aus **einer** Figur einen Charakter ableiten (Knopf je Figur-Karte). Die
   * Route liest Name/Rolle und schlägt eine Person vor, die `PlotPersonModal`
   * bestätigt. Findet sie nichts Neues, erscheint ein Hinweis an der Karte.
   */
  async function figurCharakterExtrahieren(figur: string) {
    if (figurBusy) return;
    const text = figur.trim();
    if (!text) return;
    setFigurBusy(figur);
    setFigurFehler(null);
    try {
      const { personen } = await findFigurePersons(id, text);
      if (personen.length === 0) {
        setFigurFehler({
          figur,
          text: "Kein neuer Charakter ableitbar – vielleicht gibt es die Figur schon.",
        });
      } else {
        setFigurKandidat({ person: personen[0], figur });
      }
    } catch (e) {
      setFigurFehler({
        figur,
        text: e instanceof Error ? e.message : "Fehler.",
      });
    } finally {
      setFigurBusy(null);
    }
  }

  /**
   * Die abgeleitete Person ans Formular übergeben – und **die Figur aus der Liste
   * nehmen**. Damit die Entfernung den Seitenwechsel überlebt (die Navigation
   * verwirft ungespeicherte Änderungen), wird der bearbeitete Stand zuvor
   * **gespeichert**. Schlägt das fehl, bleibt man auf der Seite.
   */
  async function figurCharakterAnlegen() {
    if (!figurKandidat) return;
    const { person, figur } = figurKandidat;
    // Über die **normalisierte** Form vergleichen: Die Karte kann einen internen
    // Umbruch tragen, den `details.figuren` längst zu einem Leerzeichen eingeebnet
    // hat. Die Aktiv-Wahl der übrigen Figuren bleibt erhalten.
    const ziel = figur.replace(/\s*\n\s*/g, " ").trim();
    const rest = splitFigurenDetail(details.figuren).filter(
      (f) => f.text !== ziel,
    );
    const neueDetails = { ...details, figuren: joinFigurenDetail(rest) };
    setDetails(neueDetails);
    setFigurKandidat(null);
    if (nameValid) {
      const ok = await speichern(neueDetails);
      if (!ok) return;
    }
    stashPlotPerson(person);
    router.push(`/?scenario=${id}`);
  }

  return {
    suchend,
    personen,
    suchFehler,
    gewaehlt,
    setGewaehlt,
    figurBusy,
    figurFehler,
    figurKandidat,
    setFigurKandidat,
    personenSuchen,
    personAnlegen,
    figurCharakterExtrahieren,
    figurCharakterAnlegen,
  };
}
