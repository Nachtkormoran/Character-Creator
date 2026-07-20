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
import { GENDERS } from "./schema";
import type { CharacterInput, PlotPerson, ScenarioDetails } from "./schema";

/** Kürzt auf eine Länge und hängt Auslassungspunkte an, wenn geschnitten wurde. */
function kuerzen(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Der **erste Satz** eines Feldes.
 *
 * Ort und Zeit sind seit der mehrdimensionalen Ableitung mehrere Sätze lang:
 * der Ort nennt einen Rahmen und zwei bis drei Schauplätze darin, die Zeit
 * einen Zeitraum und was sich in ihm verschiebt. In `setting` – ein einzeiliges
 * Feld mit 200 Zeichen – passt davon nur der Anfang, und ein blankes Abschneiden
 * bei 200 Zeichen ließe den Ort das ganze Feld füllen und die Zeit ganz
 * herausfallen. Der erste Satz ist bei beiden Feldern der Rahmen; die
 * Schauplätze und Verschiebungen stehen danach und gehören ohnehin eher in
 * `notes`.
 */
function ersterSatz(text: string): string {
  const t = text.trim();
  // Punkt, Frage- oder Ausrufezeichen gefolgt von Leerraum – oder ein Umbruch,
  // falls das Modell die Schauplätze als Liste untereinander geschrieben hat.
  const treffer = t.match(/^[\s\S]*?[.!?](?=\s)|^[^\n]+/);
  return (treffer ? treffer[0] : t).trim();
}

export interface ScenarioPrefill {
  /**
   * Vorbelegte Formularfelder – **einschließlich des Genres**. Das war einmal
   * ein eigenes Feld neben `values`, weil das Formular das Genre getrennt
   * führte; seit es zu den Vorgaben gehört, ist es eine Vorbelegung wie jede
   * andere.
   */
  values: Partial<CharacterInput>;
}

/**
 * Welche Felder belegt werden und warum:
 *
 * - **Genre** → die Vorlagen-Umschaltung. Sie steuert Würfel, Namenslisten und
 *   Berufe; das ist die folgenreichste Übernahme von allen. Es bleibt zudem am
 *   Charakter gespeichert – wer später aus ihm wieder ein Szenario ableitet,
 *   landet dadurch im selben Genre und nicht in der Gegenwart.
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
    ersterSatz(details.ort),
    ersterSatz(details.zeit),
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
    values: {
      genre: details.genre || DEFAULT_GENRE,
      setting: kuerzen(settingTeile.join(" · "), 200),
      notes: kuerzen(kontext, 2000),
    },
  };
}

/**
 * Übersetzt eine im Handlungsentwurf gefundene **Person** in Vorbelegungen
 * für das Erstellen-Formular.
 *
 * Gedacht als Ergänzung zu `scenarioToInput`, nicht als Ersatz: Jenes liefert
 * die **Welt** (Genre, Setting, Weltkontext), dieses die **Person** darin.
 * Beide Ergebnisse werden übereinandergelegt, und weil sie sich in keinem Feld
 * überschneiden, kann dabei nichts verlorengehen.
 *
 * Die Aufteilung folgt derselben Regel wie dort, nur andersherum: Ein Szenario
 * darf `background`, `personality` und `appearance` **nicht** belegen (sonst
 * entstünden sechs Varianten derselben Figur) – bei einer einzelnen Person
 * sind genau das die interessanten Felder.
 *
 * Der **Name** wandert in `input.name`, den Wunschnamen. `buildTextPrompt`
 * behandelt ein einzelnes Wort als Vornamen und ergänzt einen Nachnamen; steht
 * im Entwurf „Bengt", bekommt die Figur also einen vollständigen Namen, und
 * nennt er „Alva Reit", bleibt der Name unangetastet. Genau das ist gewollt.
 */
export function plotPersonToInput(person: PlotPerson): Partial<CharacterInput> {
  /**
   * Das Geschlecht ist im Schema ein Enum, im Entwurf aber Freitext – und das
   * Modell darf es leer lassen, wenn der Text nichts hergibt. Was nicht in die
   * Auswahl passt, wird zu „egal": Eine erfundene Zuordnung wäre schlechter
   * als keine, denn sie stünde später als Vorgabe da, die niemand gemacht hat.
   */
  const gender = (GENDERS as readonly string[]).includes(person.geschlecht)
    ? (person.geschlecht as CharacterInput["gender"])
    : "egal";

  /**
   * Leere Felder werden **weggelassen** und nicht als leerer String gesetzt:
   * Die Vorbelegung wird über die Werte des Szenarios gelegt, und ein leerer
   * String würde dort etwas überschreiben, was schon dasteht.
   */
  const werte: Partial<CharacterInput> = { gender };
  const belegen = (
    key: "name" | "age" | "occupation" | "background" | "personality" | "appearance",
    wert: string,
    max: number,
  ) => {
    const t = wert.trim();
    if (t) werte[key] = kuerzen(t, max);
  };

  // Die Längen sind die des Formularschemas – was hier zu lang ankommt, würde
  // sonst erst beim Absenden auffallen.
  belegen("name", person.name, 120);
  belegen("age", person.alter, 60);
  belegen("occupation", person.beruf, 200);
  belegen("background", person.hintergrund, 2000);
  belegen("personality", person.persoenlichkeit, 1000);
  belegen("appearance", person.aussehen, 1500);

  return werte;
}
