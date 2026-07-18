"use client";

import { useState } from "react";
import { fileToReferenceDataUrl } from "@/lib/image";

/**
 * Auswahl einer Stil-/Motivvorlage für die Bildgenerierung.
 *
 * Bewusst getrennt vom "Bild hochladen"-Knopf: der **ersetzt** das Portrait,
 * diese Vorlage **fließt in die Erzeugung ein**. Die getroffene Wahl bleibt
 * deshalb als Vorschau sichtbar – eine unsichtbare Vorlage wird vergessen und
 * das abweichende Ergebnis später nicht erklärbar.
 */
export function ReferenceImagePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erlaubt erneutes Wählen derselben Datei
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      onChange(await fileToReferenceDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bild nicht lesbar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground/60">
        Referenzbild (optional)
      </span>

      {value ? (
        <div className="flex items-center gap-3 rounded-md border border-black/15 p-2 dark:border-white/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Gewählte Vorlage"
            className="h-12 w-12 shrink-0 rounded object-cover"
          />
          <span className="min-w-0 flex-1 text-xs text-foreground/60">
            Wird als Stil- und Motivvorlage mitgegeben.
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Referenzbild entfernen"
            className="rounded px-2 py-1 text-foreground/50 transition hover:bg-black/[0.06] hover:text-foreground disabled:opacity-50 dark:hover:bg-white/[0.08]"
          >
            ×
          </button>
        </div>
      ) : (
        <label
          className={`rounded-md border border-dashed border-black/20 px-3 py-2 text-center text-sm text-foreground/60 transition dark:border-white/20 ${
            disabled || loading
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer hover:border-black/40 hover:text-foreground dark:hover:border-white/40"
          }`}
        >
          {loading ? "Lade …" : "Vorlage wählen …"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
            disabled={disabled || loading}
          />
        </label>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
