"use client";

import { useEffect, useRef } from "react";
import type { PlotPerson } from "@/lib/schema";
import { useBackdropClose } from "./useBackdropClose";
import { useOpenAtTop } from "./useOpenAtTop";

/**
 * Rückfrage, bevor aus einer im Handlungsentwurf gefundenen Person ein
 * Charakter wird.
 *
 * Bewusst **kein** `confirm()`, obwohl das Projekt es anderswo verwendet: Dort
 * geht es um „wirklich ersetzen?", hier um „stimmt das, was ich gefunden
 * habe?". Die Antwort darauf hängt davon ab, was extrahiert wurde – und das
 * muss man dafür sehen können. Ein Systemdialog kann nur eine Zeile Text.
 *
 * Die Angaben sind hier **Anzeige, nicht Formular**. Geändert wird im
 * Erstellen-Formular, wohin es gleich weitergeht; dieselben Felder zweimal
 * editierbar zu zeigen wäre eine Einladung, die Arbeit doppelt zu machen.
 *
 * Eine einzelne Ebene ohne etwas darüber, deshalb ein gewöhnlicher
 * Esc-Handler wie bei `CharacterInputModal` – die Capture-Phasen-Falle der
 * Bilder-Ansicht entsteht hier gar nicht erst.
 */
export function PlotPersonModal({
  person,
  /** Warnung, wenn am Szenario ungespeicherte Änderungen hängen. */
  dirty,
  onConfirm,
  onClose,
}: {
  person: PlotPerson;
  dirty: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const backdrop = useBackdropClose(onClose, { stopPropagation: true });

  /** Öffnet im Blick, nicht oberhalb davon – Begründung in `useOpenAtTop`. */
  const dialog = useRef<HTMLDivElement>(null);
  useOpenAtTop(dialog);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /**
   * Nur die Felder, zu denen der Entwurf etwas hergibt. Leere auszublenden
   * statt sie mit „— nichts angegeben —" zu füllen, ist hier richtig: Diese
   * Ansicht soll die Frage „reicht das für eine Figur?" beantworten, und
   * dafür zählt, was dasteht. (Die Vorgaben-Ansicht eines gespeicherten
   * Charakters macht es andersherum – dort ist die Lücke die Information.)
   */
  const felder: [string, string][] = [
    ["Geschlecht", person.geschlecht],
    ["Alter", person.alter],
    ["Beruf / Rolle", person.beruf],
    ["Hintergrund", person.hintergrund],
    ["Persönlichkeit", person.persoenlichkeit],
    ["Aussehen", person.aussehen],
  ].filter(([, wert]) => wert.trim()) as [string, string][];

  return (
    <div
      {...backdrop}
      className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialog}
        className="my-8 w-full max-w-lg rounded-xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/10"
      >
        <h2 className="text-lg font-semibold">
          Charakter für {person.name} anlegen?
        </h2>
        <p className="mt-1 text-sm text-foreground/60">
          Diese Angaben stammen aus dem Handlungsentwurf und belegen das
          Erstellen-Formular vor. Dort lassen sie sich vor dem Erzeugen noch
          ändern.
        </p>

        {felder.length > 0 ? (
          <dl className="mt-4 flex flex-col gap-2 rounded-md border border-black/10 bg-black/[0.02] p-3 text-sm dark:border-white/10 dark:bg-white/[0.03]">
            {felder.map(([label, wert]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-xs tracking-wide text-foreground/50 uppercase">
                  {label}
                </dt>
                <dd className="whitespace-pre-wrap">{wert}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 rounded-md border border-dashed border-black/15 p-4 text-center text-sm text-foreground/60 dark:border-white/15">
            Der Entwurf nennt nur den Namen. Alles Weitere entsteht beim
            Erzeugen – oder du ergänzt es vorher im Formular.
          </p>
        )}

        {dirty && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
            Am Szenario hängen ungespeicherte Änderungen. Sie gehen beim
            Wechsel ins Formular verloren – erst speichern, dann anlegen.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-foreground/60 transition hover:text-foreground"
          >
            Abbrechen
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90"
          >
            Ja, Charakter anlegen
          </button>
        </div>
      </div>
    </div>
  );
}
