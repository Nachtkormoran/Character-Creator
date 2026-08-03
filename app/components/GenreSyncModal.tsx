"use client";

import { useEffect } from "react";
import { useBackdropClose } from "./useBackdropClose";

/**
 * **Rückfrage nach einer Genre-Änderung am Szenario:** Soll das neue Genre auch
 * auf die zugeordneten Figuren übertragen werden? Erscheint, sobald das
 * Genre-Feld der Festlegungen auf ein anderes (nicht-leeres) Genre gesetzt wird
 * **und** mindestens eine zugeordnete Figur ein abweichendes Genre trägt.
 *
 * Bewusst **präsentierend**: Der Aufrufer (die Szenario-Detailseite) hält die
 * betroffenen Figuren, führt den PATCH-Lauf und meldet Busy/Fehler zurück –
 * dieselbe Rollenteilung wie bei `ScenarioFields`/`StoryArcSection`.
 *
 * Die Szenario-Detailseite ist eine echte Seite ohne `backdrop-blur`-Vorfahren,
 * diese Rückfrage also die **erste** Overlay-Ebene: ein gewöhnlicher Esc-/
 * Backdrop-Handler wie bei `ScenarioImageModal` genügt (kein `useOpenAtTop`,
 * keine Capture-Phase-Verschachtelung).
 */
export function GenreSyncModal({
  genreLabel,
  anzahl,
  busy,
  fehler,
  onConfirm,
  onClose,
}: {
  /** Anzeigename des neuen Genres (z. B. „🐉 Fantasy"). */
  genreLabel: string;
  /** Wie viele zugeordnete Figuren ein abweichendes Genre tragen. */
  anzahl: number;
  busy: boolean;
  fehler: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const backdrop = useBackdropClose(onClose, { stopPropagation: true });

  const figurWort = anzahl === 1 ? "Figur" : "Figuren";

  return (
    <div
      className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      {...backdrop}
    >
      <div
        className="my-8 w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-semibold">Genre übertragen?</h2>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!busy) onClose();
            }}
            disabled={busy}
            className="shrink-0 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-muted disabled:opacity-50"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Das Genre des Szenarios wurde auf <strong>{genreLabel}</strong>{" "}
          geändert. Soll dieses Genre auch auf {anzahl} zugeordnete {figurWort}{" "}
          mit abweichendem Genre übertragen werden?
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Das Genre der Figuren wird sofort gespeichert. Ihr Beschreibungstext
          und ihre Merkmale bleiben unverändert.
        </p>

        {fehler && (
          <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {fehler}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy
              ? "Übertrage …"
              : `Ja, ${figurWort} auf ${genreLabel} setzen`}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            Nein, nur das Szenario
          </button>
        </div>
      </div>
    </div>
  );
}
