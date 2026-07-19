/**
 * Übersetzt ein **Szenario** in Vorbelegungen für das Erstellen-Formular.
 *
 * Der Weg über die Formularfelder ist Absicht. Man könnte das Szenario auch
 * unsichtbar an `buildTextPrompt` durchreichen – dann stünde aber im Formular
 * nichts davon, der Nutzer sähe nicht, was den Charakter prägt, und könnte es
 * nicht ändern. So sind die Übernahmen **sichtbar und editierbar**, und sie
 * landen zugleich in `input`, also in der Vorgaben-Ansicht: Später ist
 * nachvollziehbar, aus welchem Weltstand die Figur entstand. Ändert sich das
 * Szenario danach, bleibt die Figur bei dem, was zu ihrer Zeit galt – das ist
 * richtig so, denn der gespeicherte Text ist aus diesen Vorgaben entstanden.
 *
 * Deshalb braucht auch **keine Route eine Änderung**: `setting` und `notes`
 * fließen längst in den Text-Prompt.
 */

import { DEFAULT_GENRE, genreLabel } from "./templates";
import type { CharacterInput, ScenarioDetails } from "./schema";

/** Kürzt auf eine Länge und hängt Auslassungspunkte an, wenn geschnitten wurde. */
function kuerzen(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export interface ScenarioPrefill {
  /** Genre-Id für die Vorlagen-Umschaltung (steuert Würfel und Namenslisten). */
  genre: string;
  /** Vorbelegte Formularfelder. */
  values: Partial<CharacterInput>;
}

/**
 * Welche Felder belegt werden und warum:
 *
 * - **Genre** → die Vorlagen-Umschaltung. Sie steuert Würfel, Namenslisten und
 *   Berufe; das ist die folgenreichste Übernahme von allen.
 * - **`setting`** ← Genre, Ort und Zeit, kompakt in einer Zeile. Das Feld ist
 *   ein einzeiliges Eingabefeld mit 200 Zeichen – hier passt nur das Gerüst.
 * - **`notes`** ← Regeln und Weltbeschreibung. Ein Textfeld mit 2000 Zeichen,
 *   und der einzige Ort im Formular, an dem längerer Weltkontext unterkommt.
 *
 * Bewusst **nicht** belegt werden `background`, `personality` und `appearance`:
 * Das sind Eigenschaften der Person, nicht der Welt. Ein Szenario, das die
 * Persönlichkeit seiner Figuren vorschreibt, brächte sechs Varianten derselben.
 */
export function scenarioToInput(
  name: string,
  details: ScenarioDetails,
): ScenarioPrefill {
  const settingTeile = [
    details.genre ? genreLabel(details.genre) : "",
    details.ort,
    details.zeit,
  ]
    .map((t) => t.trim())
    .filter(Boolean);

  const kontext = [
    details.regeln.trim() &&
      `Im Szenario „${name}" gilt: ${details.regeln.trim()}`,
    details.beschreibung.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    genre: details.genre || DEFAULT_GENRE,
    values: {
      setting: kuerzen(settingTeile.join(" · "), 200),
      notes: kuerzen(kontext, 2000),
    },
  };
}
