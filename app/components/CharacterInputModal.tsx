"use client";

import { useEffect } from "react";
import {
  INPUT_LABELS,
  inputDisplayValue,
  type CharacterInput,
} from "@/lib/schema";

/**
 * Zeigt die Vorgaben, mit denen ein Charakter ursprünglich erzeugt wurde.
 *
 * Reine Anzeige: die Werte sind ein Protokoll des Erstellungszeitpunkts und
 * werden bewusst **nicht** editierbar gemacht. Ließe man sie ändern, stünde in
 * der Datenbank eine Vorgabe, aus der der gespeicherte Text nie entstanden ist –
 * die nachträgliche Bearbeitung gehört an Beschreibung und Merkmale.
 *
 * Eigene Ebene über der Detailansicht (`z-70`, wie die Bilder-Ansicht; beide
 * öffnen aus derselben Ansicht und sind nie gleichzeitig offen). Backdrop und
 * Schließen-Knopf stoppen die Ausbreitung, sonst schlösse ein Klick auch die
 * Detailansicht darunter mit.
 */
export function CharacterInputModal({
  input,
  name,
  onClose,
}: {
  input: Partial<CharacterInput>;
  name: string;
  onClose: () => void;
}) {
  // Eigener Esc-Handler: die Detailansicht darunter hat keinen, und über
  // dieser Ebene liegt nichts. Der Listener hängt einmalig für die Lebensdauer
  // dieser Ansicht – die Falle aus `CharacterImagesModal` (Neu-Registrierung
  // während derselben Ereignisausbreitung) entsteht hier deshalb nicht.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const keys = Object.keys(INPUT_LABELS) as (keyof CharacterInput)[];
  const belegt = keys.filter((k) => inputDisplayValue(k, input) !== "").length;

  return (
    <div
      className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">Vorgaben bei der Erstellung</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Womit {name || "dieser Charakter"} erzeugt wurde – {belegt} von{" "}
              {keys.length} Feldern ausgefüllt.
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="shrink-0 rounded-md px-2 py-1 text-foreground/60 transition hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
          <table className="w-full text-sm">
            <tbody>
              {keys.map((key, i) => {
                const value = inputDisplayValue(key, input);
                return (
                  <tr
                    key={key}
                    className={
                      i % 2 === 0
                        ? "bg-black/[0.02] dark:bg-white/[0.03]"
                        : undefined
                    }
                  >
                    <th className="w-1/4 px-4 py-2 text-left align-top font-medium whitespace-nowrap text-foreground/60">
                      {INPUT_LABELS[key]}
                    </th>
                    <td className="px-4 py-2 align-top whitespace-pre-wrap">
                      {value || (
                        <span className="text-foreground/30">
                          — nichts angegeben —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
