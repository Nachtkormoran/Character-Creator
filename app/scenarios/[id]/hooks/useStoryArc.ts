"use client";

import { useState } from "react";
import { generateStoryArc, generateStoryTitle } from "@/lib/client";
import { aktiveFiguren } from "@/lib/figuren";
import { ausgerichtet } from "@/lib/scenarioDocument";
import {
  MAX_STORY_ARCS,
  type StoryArc,
  type TextProvider,
  type VariantMeta,
} from "@/lib/schema";
import type { ScenarioDocument } from "./useScenarioDocument";

/**
 * **Verwaltung der Story Arcs** (Reiter-Leiste) und das **Ableiten** eines
 * neuen Arcs aus dem aktiven Handlungsentwurf. Zwilling von `usePlotVarianten`
 * für die Arc-Seite, plus die KI-Erzeugung. Baut auf dem Dokument-Kern auf; die
 * Arcs sind Teil seiner Speicher-Einheit. Der `provider` (Pro-Lauf-Modell) und
 * die Arc-Parameter (`doc.arcParams`) steuern die Erzeugung; alle Struktur-
 * Änderungen gehen über „Änderungen speichern" (dirty).
 */
export function useStoryArc(
  doc: ScenarioDocument,
  id: string,
  provider: TextProvider | "",
) {
  const {
    saving,
    aktiv,
    variantenMeta,
    details,
    arcAktiv,
    arcMeta,
    arcParams,
    aktuelleArcs,
    setArcVarianten,
    setArcAktiv,
    setStoryArc,
    setArcMeta,
  } = doc;

  const [arcBusy, setArcBusy] = useState(false);
  const [arcFehler, setArcFehler] = useState<string | null>(null);
  // Welcher Arc gerade einen neuen Titel per KI erzeugt (Index).
  const [arcTitelBusy, setArcTitelBusy] = useState<number | null>(null);

  /** Auf einen anderen Arc umschalten – der bisherige wird zuvor gesichert. */
  function arcWaehlen(i: number) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length || i === arcAktiv) return;
    setArcVarianten(items);
    setArcAktiv(i);
    setStoryArc(items[i]);
  }

  /** Den Titel eines Story Arcs ändern (✎ am Reiter). */
  function arcTitelAendern(i: number) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length) return;
    const meta = ausgerichtet(arcMeta, items.length);
    const neu = window.prompt(`Titel für Story Arc ${i + 1}:`, meta[i].titel);
    if (neu === null) return;
    setArcMeta(
      meta.map((m, k) =>
        k === i ? { ...m, titel: neu.trim().slice(0, 120) } : m,
      ),
    );
  }

  /**
   * Einen **neuen Titel per KI** für einen Story Arc erzeugen (✨ am Reiter) –
   * aus einer Zusammenfassung der Stationen (`generateStoryTitle`, `art: "arc"`).
   */
  async function arcTitelNeu(i: number) {
    if (arcBusy || saving || arcTitelBusy !== null) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length) return;
    const arcText = items[i].stufen
      .map((s) => [s.titel, s.beschreibung].filter(Boolean).join(": "))
      .join("\n")
      // Die Route deckelt bei 8000 Zeichen; für einen Titel genügt eine
      // Zusammenfassung, also vorsorglich kappen.
      .slice(0, 8000);
    if (!arcText.trim()) return;
    setArcTitelBusy(i);
    setArcFehler(null);
    try {
      const titel = await generateStoryTitle(arcText, "arc");
      const neu = titel.trim().slice(0, 120);
      if (neu) {
        const meta = ausgerichtet(arcMeta, items.length);
        setArcMeta(meta.map((m, k) => (k === i ? { ...m, titel: neu } : m)));
      }
    } catch (e) {
      setArcFehler(e instanceof Error ? e.message : "Titel fehlgeschlagen.");
    } finally {
      setArcTitelBusy(null);
    }
  }

  /** Einen Story Arc als **Favorit** markieren/entmarken. */
  function arcFavoritUmschalten(i: number) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length) return;
    const meta = ausgerichtet(arcMeta, items.length);
    setArcMeta(meta.map((m, k) => (k === i ? { ...m, favorit: !m.favorit } : m)));
  }

  /**
   * Das **Cover** eines Story Arcs setzen (`""` = Weltbild, `"char:<id>"` =
   * Charakterporträt). Steuert das Titelbild in der Bibliothek.
   */
  function arcCoverSetzen(i: number, cover: string) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length) return;
    const meta = ausgerichtet(arcMeta, items.length);
    setArcMeta(meta.map((m, k) => (k === i ? { ...m, cover } : m)));
  }

  /** Den Story Arc `i` als **Buch in der Bibliothek** an-/abwählen. */
  function arcAlsBuchSetzen(i: number, alsBuch: boolean) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length) return;
    const meta = ausgerichtet(arcMeta, items.length);
    setArcMeta(meta.map((m, k) => (k === i ? { ...m, alsBuch } : m)));
  }

  /**
   * Einen bestehenden Story Arc **kopieren** – tiefe Kopie samt Stationen und
   * Kapiteln, angehängt und aktiv. Titel + „(Kopie)", Form/Ton/Quelle reisen mit,
   * die Favorit-Markierung nicht. Kein KI-Aufruf.
   */
  function arcKopieren(i: number) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length) return;
    if (items.length >= MAX_STORY_ARCS) {
      setArcFehler(
        `Mehr als ${MAX_STORY_ARCS} Story Arcs werden nicht gespeichert. Lösche einen, um Platz zu schaffen.`,
      );
      return;
    }
    // Tiefe Kopie, damit das Bearbeiten der Kopie das Original nicht anrührt.
    const kopie = JSON.parse(JSON.stringify(items[i])) as StoryArc;
    const meta = ausgerichtet(arcMeta, items.length);
    const q = meta[i];
    const kopieMeta: VariantMeta = {
      ...q,
      titel: q.titel.trim() ? `${q.titel.trim()} (Kopie)` : "",
      favorit: false,
      alsBuch: false,
    };
    setArcVarianten([...items, kopie]);
    setArcAktiv(items.length);
    setStoryArc(kopie);
    setArcMeta([...meta, kopieMeta]);
  }

  /** Einen Arc löschen (mit Rückfrage). Der letzte verbliebene bleibt. */
  function arcLoeschen(i: number) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (items.length <= 1) return;
    if (!confirm(`Story Arc ${i + 1} löschen?`)) return;
    const rest = items.filter((_, k) => k !== i);
    const na =
      i === arcAktiv
        ? Math.min(i, rest.length - 1)
        : i < arcAktiv
          ? arcAktiv - 1
          : arcAktiv;
    setArcVarianten(rest);
    setArcAktiv(na);
    setStoryArc(rest[na]);
    setArcMeta(ausgerichtet(arcMeta, items.length).filter((_, k) => k !== i));
  }

  /** Alle Arcs auf einmal löschen – zurück zum ruhenden Zustand (Rückfrage). */
  function alleArcsLoeschen() {
    if (arcBusy || saving) return;
    const anzahl = aktuelleArcs().length;
    if (anzahl === 0) return;
    if (!confirm(`Alle ${anzahl} Story Arcs löschen?`)) return;
    setArcVarianten([]);
    setArcAktiv(0);
    setStoryArc({ stufen: [] });
    setArcMeta([]);
  }

  /**
   * Einen **neuen Story Arc ableiten** – hängt ihn an (ersetzt nicht). Der aktive
   * Handlungsentwurf geht im aktuellen, womöglich ungespeicherten Stand mit
   * (`details.handlung`); die Figuren lädt die Route selbst. Der Reiter-Titel
   * entsteht per KI (Beiwerk – scheitert er, bleibt „Arc N"), die Quelle wird als
   * Schnappschuss festgehalten.
   */
  async function storyArcAbleiten() {
    if (arcBusy || !details.handlung.trim()) return;
    if (aktuelleArcs().length >= MAX_STORY_ARCS) {
      setArcFehler(
        `Mehr als ${MAX_STORY_ARCS} Story Arcs werden nicht gespeichert. Lösche einen, um Platz zu schaffen.`,
      );
      return;
    }
    setArcBusy(true);
    setArcFehler(null);
    try {
      const { storyArc: neu, model } = await generateStoryArc(
        id,
        details.handlung,
        {
          laenge: arcParams.laenge,
          format: arcParams.format,
          zusatz: arcParams.zusatz,
          kreativ: arcParams.kreativ,
          weiterspinnen: arcParams.weiterspinnen,
          ton: arcParams.ton,
          form: arcParams.form,
          // Nur die **aktiven** Figuren (reiner Text); sind keine aktiv, leer.
          figuren: aktiveFiguren(details.figuren),
          textProvider: provider,
        },
      );
      const arcText = neu.stufen
        .map((s) => [s.titel, s.beschreibung].filter(Boolean).join(": "))
        .join("\n");
      let titel = "";
      try {
        titel = await generateStoryTitle(arcText, "arc");
      } catch {
        // Titel ist Beiwerk.
      }
      const quelle =
        variantenMeta[aktiv]?.titel?.trim() || `Entwurf ${aktiv + 1}`;
      const alt = aktuelleArcs();
      setArcVarianten([...alt, neu]);
      setArcAktiv(alt.length);
      setStoryArc(neu);
      setArcMeta([
        ...ausgerichtet(arcMeta, alt.length),
        {
          titel,
          form: arcParams.form,
          ton: arcParams.ton,
          favorit: false,
          quelle,
          modell: model,
          werkform: arcParams.werkform,
          cover: "",
          alsBuch: false,
        },
      ]);
    } catch (e) {
      setArcFehler(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setArcBusy(false);
    }
  }

  return {
    arcBusy,
    arcFehler,
    arcTitelBusy,
    arcWaehlen,
    arcTitelAendern,
    arcTitelNeu,
    arcFavoritUmschalten,
    arcCoverSetzen,
    arcAlsBuchSetzen,
    arcKopieren,
    arcLoeschen,
    alleArcsLoeschen,
    storyArcAbleiten,
  };
}
