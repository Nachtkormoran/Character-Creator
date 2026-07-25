"use client";

import { useEffect, useRef, useState } from "react";
import { generateRandomInput } from "@/lib/client";
import type { CharacterInput } from "@/lib/schema";
import { genreLabel } from "@/lib/templates";
import { useBackdropClose } from "./useBackdropClose";
import { useOpenAtTop } from "./useOpenAtTop";

/**
 * „Zufällige Figur erzeugen": füllt das ganze Erstellen-Formular auf einmal.
 *
 * Ein Textfeld für eine freie Themen-Vorgabe (optional), darunter der Knopf, der
 * die KI ausfüllen lässt. **Bereits ausgefüllte Felder bleiben** (das erzwingt
 * die Route serverseitig), leere werden erfunden, das Genre passend gewählt –
 * genau das sagt der Hinweis unter dem Feld.
 *
 * Es entsteht **noch kein** Charakter: Das Ergebnis belegt nur das Formular, wo
 * es sich vor dem Erstellen noch ändern lässt. Erste Overlay-Ebene über der
 * Erstellen-Seite (kein `backdrop-blur`-Vorfahr), daher ein gewöhnlicher
 * Esc-Handler wie bei `PlotPersonModal`.
 */
export function RandomCharacterModal({
  current,
  onFilled,
  onClose,
}: {
  /** Der aktuelle Formularzustand – gesetzte Felder bleiben erhalten. */
  current: CharacterInput;
  /** Die gefüllten Felder ins Formular übernehmen. */
  onFilled: (fields: Partial<CharacterInput>) => void;
  onClose: () => void;
}) {
  const backdrop = useBackdropClose(onClose, { stopPropagation: true });
  const dialog = useRef<HTMLDivElement>(null);
  useOpenAtTop(dialog);

  const [text, setText] = useState("");
  /**
   * Genre auch würfeln? Standard **aus**: Das Formular hat immer ein Genre
   * gewählt, und eine bewusste Wahl soll nicht grundlos kippen. Angehakt wählt
   * die KI das Genre passend zur Vorgabe.
   */
  const [genreWuerfeln, setGenreWuerfeln] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Nicht schließen, während erzeugt wird – der Lauf soll nicht ins Leere
      // laufen und das Ergebnis verpuffen.
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  async function erzeugen() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { input } = await generateRandomInput(current, text, genreWuerfeln);
      onFilled(input);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      {...backdrop}
      className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialog}
        className="my-8 w-full max-w-lg rounded-xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/10"
      >
        <h2 className="text-lg font-semibold">Zufällige Figur erzeugen</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Ein Stichwort, ein Satz – oder nichts. Die KI füllt daraus das ganze
          Formular.
        </p>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-sm font-medium">Vorgabe (optional)</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
            autoFocus
            maxLength={1000}
            placeholder="z. B. „eine desillusionierte Kopfgeldjägerin am Rand einer Raumstation“ – oder leer lassen für völligen Zufall"
            className="min-h-24 w-full resize-y rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
          />
          <span className="text-xs text-foreground/50">
            Bereits ausgefüllte Felder bleiben erhalten; alle leeren Felder
            werden passend ausgefüllt.
          </span>
        </label>

        {/*
          Genre-Sonderfall: Das Formular hat immer ein Genre gewählt, ein leeres
          gibt es nicht. Standard ist deshalb, das aktuelle beizubehalten; das
          Häkchen lässt es passend zur Vorgabe würfeln.
        */}
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-foreground/70">
          <input
            type="checkbox"
            checked={genreWuerfeln}
            onChange={(e) => setGenreWuerfeln(e.target.checked)}
            disabled={busy}
            className="mt-0.5 size-4 accent-foreground"
          />
          <span>
            Genre auch zufällig wählen
            <span className="text-foreground/50">
              {" "}
              – sonst bleibt es bei „{genreLabel(current.genre)}“
            </span>
          </span>
        </label>

        {error && (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-sm text-foreground/60 transition hover:text-foreground disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={erzeugen}
            disabled={busy}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Erzeuge …" : "🎲 Formular ausfüllen"}
          </button>
        </div>
      </div>
    </div>
  );
}
