"use client";

import { ausgerichtet, LEER_META } from "@/lib/scenarioDocument";
import { MAX_PLOT_VARIANTS, type ScenarioDetails, type VariantMeta } from "@/lib/schema";
import type { ScenarioDocument } from "./useScenarioDocument";

/**
 * **Verwaltung der Handlungsentwurf-Varianten** (Reiter-Leiste): umschalten,
 * Titel/Favorit, kopieren, löschen, leeren Entwurf anhängen. Baut auf dem
 * Dokument-Kern auf (die Varianten sind Teil seiner Speicher-Einheit); `doc`
 * liefert `aktuelleVarianten`/`aktiv`/`variantenMeta` und die Setter, `saving`
 * und `generatingField` sperren, solange gespeichert/erzeugt wird. Alle
 * Änderungen gehen über „Änderungen speichern" (dirty) – wie zuvor in der Seite.
 */
export function usePlotVarianten(
  doc: ScenarioDocument,
  generatingField: keyof ScenarioDetails | null,
) {
  const {
    saving,
    aktiv,
    variantenMeta,
    aktuelleVarianten,
    setVarianten,
    setAktiv,
    setDetails,
    setVariantenMeta,
    setSaveError,
  } = doc;

  /** Auf einen anderen Entwurf umschalten – der bisherige wird zuvor gesichert. */
  function varianteWaehlen(i: number) {
    if (generatingField || saving) return;
    const items = aktuelleVarianten();
    if (i < 0 || i >= items.length || i === aktiv) return;
    setVarianten(items);
    setAktiv(i);
    setDetails((d) => ({ ...d, handlung: items[i] }));
  }

  /**
   * Den Titel eines Entwurfs ändern (✎ am Reiter). Der Titel gehört zu den
   * Metadaten und wird wie alles über „Änderungen speichern" abgelegt; leer
   * lassen holt den Rückfall „Entwurf N" zurück.
   */
  function titelAendern(i: number) {
    if (generatingField || saving) return;
    const items = aktuelleVarianten();
    if (i < 0 || i >= items.length) return;
    const meta = ausgerichtet(variantenMeta, items.length);
    const neu = window.prompt(`Titel für Entwurf ${i + 1}:`, meta[i].titel);
    if (neu === null) return;
    setVariantenMeta(
      meta.map((m, k) =>
        k === i ? { ...m, titel: neu.trim().slice(0, 120) } : m,
      ),
    );
  }

  /** Einen Entwurf als **Favorit** markieren/entmarken (Stern am Reiter). */
  function favoritUmschalten(i: number) {
    if (generatingField || saving) return;
    const items = aktuelleVarianten();
    if (i < 0 || i >= items.length) return;
    const meta = ausgerichtet(variantenMeta, items.length);
    setVariantenMeta(
      meta.map((m, k) => (k === i ? { ...m, favorit: !m.favorit } : m)),
    );
  }

  /**
   * Einen bestehenden Handlungsentwurf **kopieren** – eigenständige Kopie,
   * angehängt und aktiv. Titel + „(Kopie)", Form/Ton/Modell reisen mit, die
   * Favorit-Markierung nicht. Kein KI-Aufruf; gegen `MAX_PLOT_VARIANTS` geprüft.
   */
  function varianteKopieren(i: number) {
    if (generatingField || saving) return;
    const items = aktuelleVarianten();
    if (i < 0 || i >= items.length) return;
    if (items.length >= MAX_PLOT_VARIANTS) {
      setSaveError(
        `Mehr als ${MAX_PLOT_VARIANTS} Entwürfe werden nicht gespeichert. Lösche einen, um Platz zu schaffen.`,
      );
      return;
    }
    const meta = ausgerichtet(variantenMeta, items.length);
    const q = meta[i];
    const kopieMeta: VariantMeta = {
      ...q,
      titel: q.titel.trim() ? `${q.titel.trim()} (Kopie)` : "",
      favorit: false,
    };
    setVarianten([...items, items[i]]);
    setAktiv(items.length);
    setDetails((d) => ({ ...d, handlung: items[i] }));
    setVariantenMeta([...meta, kopieMeta]);
  }

  /**
   * Einen Entwurf löschen (mit Rückfrage – ein Entwurf ist ein großer, teuer
   * erzeugter Text). Der letzte verbliebene lässt sich nicht über die Leiste
   * löschen.
   */
  function varianteLoeschen(i: number) {
    if (generatingField || saving) return;
    const items = aktuelleVarianten();
    if (items.length <= 1) return;
    if (!confirm(`Entwurf ${i + 1} löschen?`)) return;
    const rest = items.filter((_, k) => k !== i);
    const na =
      i === aktiv ? Math.min(i, rest.length - 1) : i < aktiv ? aktiv - 1 : aktiv;
    setVarianten(rest);
    setAktiv(na);
    setDetails((d) => ({ ...d, handlung: rest[na] }));
    setVariantenMeta(
      ausgerichtet(variantenMeta, items.length).filter((_, k) => k !== i),
    );
  }

  /** Alle Entwürfe auf einmal löschen – keiner bleibt stehen (Rückfrage). */
  function alleVariantenLoeschen() {
    if (generatingField || saving) return;
    const anzahl = aktuelleVarianten().length;
    if (anzahl === 0) return;
    if (!confirm(`Alle ${anzahl} Entwürfe löschen?`)) return;
    setVarianten([]);
    setAktiv(0);
    setDetails((d) => ({ ...d, handlung: "" }));
    setVariantenMeta([]);
  }

  /**
   * Einen **leeren** Entwurf anhängen und auf ihn umschalten – der Gegenpol zu
   * „✨ Neu erzeugen": kein KI-Aufruf, ein leeres Feld zum Selbstschreiben.
   */
  function leerenEntwurfHinzufuegen() {
    if (generatingField || saving) return;
    const items = aktuelleVarianten();
    if (items.length >= MAX_PLOT_VARIANTS) {
      setSaveError(
        `Mehr als ${MAX_PLOT_VARIANTS} Entwürfe werden nicht gespeichert. Lösche einen, um Platz zu schaffen.`,
      );
      return;
    }
    const neu = [...items, ""];
    setVarianten(neu);
    setAktiv(neu.length - 1);
    setDetails((d) => ({ ...d, handlung: "" }));
    setVariantenMeta([...ausgerichtet(variantenMeta, items.length), LEER_META]);
  }

  return {
    varianteWaehlen,
    titelAendern,
    favoritUmschalten,
    varianteKopieren,
    varianteLoeschen,
    alleVariantenLoeschen,
    leerenEntwurfHinzufuegen,
  };
}
