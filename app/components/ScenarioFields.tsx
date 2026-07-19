"use client";

import {
  SCENARIO_HINTS,
  SCENARIO_LABELS,
  SCENARIO_MULTILINE,
  type ScenarioDetails,
} from "@/lib/schema";
import { GENRE_TEMPLATES } from "@/lib/templates";

/**
 * Die Eingabefelder eines Szenarios – geteilt zwischen Anlege-Formular und
 * Detailansicht, damit ein neues Feld an **einer** Stelle sichtbar wird.
 *
 * Gerendert wird über `SCENARIO_LABELS`, nicht über die Schlüssel des Objekts:
 * ein Szenario aus einem älteren Stand kennt ein später ergänztes Feld nicht,
 * und über die Labels zu laufen zeigt es leer an, statt es zu unterschlagen.
 * Damit kostet ein neues Feld genau zwei Zeilen im Schema – hier ist nichts
 * nachzutragen.
 *
 * Nur das Genre ist ein Sonderfall: es kommt aus derselben Liste wie die
 * Vorlagen im Erstellen-Formular (`GENRE_TEMPLATES`), damit beide Seiten
 * dieselben Genres kennen. Sonst stünde im Szenario „Steampunk" und im
 * Charakter-Formular etwas, das nicht dazu passt.
 */
export function ScenarioFields({
  details,
  onChange,
  disabled = false,
  onGenerateBeschreibung,
  generating = false,
}: {
  details: ScenarioDetails;
  onChange: (details: ScenarioDetails) => void;
  disabled?: boolean;
  /**
   * Erzeugt die Beschreibung per KI. Die Anfrage selbst macht die aufrufende
   * Seite – diese Komponente bleibt darstellend und kennt kein `fetch`.
   * Fehlt der Handler, erscheint der Knopf nicht.
   */
  onGenerateBeschreibung?: () => void;
  generating?: boolean;
}) {
  const set = (key: keyof ScenarioDetails, value: string) =>
    onChange({ ...details, [key]: value });

  const controlClass =
    "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40";

  return (
    <div className="flex flex-col gap-4">
      {(Object.keys(SCENARIO_LABELS) as Array<keyof ScenarioDetails>).map(
        (key) => (
          <label key={key} className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
              {SCENARIO_LABELS[key]}
              {key === "beschreibung" && onGenerateBeschreibung && (
                <button
                  type="button"
                  onClick={onGenerateBeschreibung}
                  disabled={disabled || generating}
                  title="Erzeugt die Beschreibung aus Genre, Ort, Zeit und Regeln"
                  className="rounded-md border border-black/15 px-2.5 py-1 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
                >
                  {generating
                    ? "Schreibt …"
                    : details.beschreibung.trim()
                      ? "✨ Neu erzeugen"
                      : "✨ Erzeugen"}
                </button>
              )}
            </span>

            {key === "genre" ? (
              <select
                value={details.genre}
                onChange={(e) => set("genre", e.target.value)}
                disabled={disabled}
                className={controlClass}
              >
                {/* Leer ist gültig – ein Szenario muss sich nicht festlegen. */}
                <option value="">— keins —</option>
                {GENRE_TEMPLATES.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.emoji} {g.label}
                  </option>
                ))}
              </select>
            ) : SCENARIO_MULTILINE.has(key) ? (
              <textarea
                value={details[key]}
                onChange={(e) => set(key, e.target.value)}
                disabled={disabled}
                rows={key === "ort" ? 2 : 6}
                className={`${controlClass} resize-y`}
              />
            ) : (
              <input
                value={details[key]}
                onChange={(e) => set(key, e.target.value)}
                disabled={disabled}
                className={controlClass}
              />
            )}

            <span className="text-xs text-foreground/50">
              {SCENARIO_HINTS[key]}
            </span>
          </label>
        ),
      )}
    </div>
  );
}
