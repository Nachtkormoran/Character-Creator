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
  onChooseOwn,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  disabled?: boolean;
  /**
   * Öffnet die Auswahl unter den eigenen Bildern des Charakters. Nur gesetzt,
   * wo es die überhaupt schon gibt – in der Erstellen-Ansicht ist der Charakter
   * noch nicht gespeichert und hat folglich keine.
   */
  onChooseOwn?: () => void;
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
      <span className="text-xs font-medium text-muted-foreground">
        Referenzbild (optional)
      </span>

      {value ? (
        <div className="flex items-center gap-3 rounded-md border border-border p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Gewählte Vorlage"
            className="h-12 w-12 shrink-0 rounded object-cover"
          />
          <span className="min-w-0 flex-1 text-xs text-muted-foreground">
            Wird als Stil- und Motivvorlage mitgegeben.
          </span>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Referenzbild entfernen"
            className="rounded px-2 py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50 dark:hover:bg-white/[0.08]"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 sm:flex-row">
          <label
            className={`flex-1 rounded-md border border-dashed border-border px-3 py-2 text-center text-sm text-muted-foreground transition ${
              disabled || loading
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:border-border hover:text-foreground"
            }`}
          >
            {loading ? "Lade …" : "Datei wählen …"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
              disabled={disabled || loading}
            />
          </label>

          {onChooseOwn && (
            <button
              type="button"
              onClick={onChooseOwn}
              disabled={disabled || loading}
              className="flex-1 rounded-md border border-dashed border-border px-3 py-2 text-center text-sm text-muted-foreground transition hover:border-border hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Charakterbild wählen …
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
