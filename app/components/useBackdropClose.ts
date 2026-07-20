"use client";

import { useRef } from "react";

/**
 * Handler für einen Modal-Backdrop, der bei einem Klick schließt – **aber
 * nicht**, wenn der Klick nur das Ende einer Textmarkierung im Dialog ist.
 *
 * Der Fehler dahinter ist keine Kleinigkeit gewesen: Wer die Beschreibung in
 * der Charakter-Detailansicht markieren wollte und die Maustaste dabei über
 * dem Rand losließ, verlor die Ansicht **samt aller ungespeicherten
 * Änderungen**. Denn `click` feuert nicht dort, wo die Taste losgelassen wird,
 * sondern auf dem **gemeinsamen Vorfahren** von Druck- und Loslass-Punkt – bei
 * einer Markierung, die im Dialog beginnt und über dem Backdrop endet, ist das
 * der Backdrop selbst. Ein `stopPropagation` am Dialog hilft dagegen nichts:
 * Das Ereignis entsteht bereits am Backdrop und steigt gar nicht erst durch
 * ihn hindurch auf.
 *
 * Deshalb wird zusätzlich der **Beginn** der Geste geprüft. Geschlossen wird
 * nur, wenn `mousedown` *und* `click` auf dem Backdrop selbst gelandet sind –
 * also bei einem echten Klick daneben.
 *
 * @param onClose      Was beim Klick daneben passieren soll.
 * @param stopPropagation Für **innere** Ebenen (Bilder-, Vorgaben-Ansicht,
 *   Lightbox): Sie werden im DOM der Detailansicht gerendert, deren Backdrop
 *   ebenfalls bei jedem Klick schließt. Ohne das Stoppen risse ein Klick alles
 *   mit. Es geschieht **unabhängig** davon, ob geschlossen wird – sonst käme
 *   ausgerechnet die abgefangene Markierungs-Geste bei der Ebene darunter an
 *   und schlösse dort, was sie hier gerade nicht durfte.
 */
export function useBackdropClose(
  onClose: () => void,
  { stopPropagation = false }: { stopPropagation?: boolean } = {},
) {
  const startedOnBackdrop = useRef(false);

  return {
    onMouseDown: (e: React.MouseEvent) => {
      startedOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e: React.MouseEvent) => {
      if (stopPropagation) e.stopPropagation();
      if (startedOnBackdrop.current && e.target === e.currentTarget) onClose();
    },
  };
}
