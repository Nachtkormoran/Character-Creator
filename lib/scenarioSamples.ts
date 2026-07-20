import { pickSome } from "./inspiration";
import { PLACES_BY_GENRE, GEGENWART_PLACES } from "./scenarioPlaces";
import { TIMES_BY_GENRE, GEGENWART_TIMES } from "./scenarioTimes";
import { RULES_BY_GENRE, GEGENWART_RULES } from "./scenarioRules";

/**
 * Ein paar Würfel-Einträge als **Formbeispiel** für die Ableitung eines
 * Szenarios aus einem Charakter.
 *
 * Warum das nötig ist: Für Ort und Regeln gibt es im Projekt längst einen
 * geschriebenen Hausstandard – 900 Regelsätze und 900 Orte, jeder nach einer
 * Regel gebaut, die in den Kopfkommentaren der Listen steht („Ein Ort ohne Riss
 * ist eine Kulisse"). Der Ableitungs-Prompt kannte ihn nicht und beschrieb ihn
 * mit eigenen Worten nach. Drei echte Einträge zeigen die Tonlage genauer als
 * drei Sätze über die Tonlage.
 *
 * **Beispiel heißt Form, nicht Inhalt.** Der Prompt sagt ausdrücklich, dass die
 * Einträge nicht übernommen werden dürfen; sie stammen aus einer Zufallsziehung
 * und haben mit dem Charakter nichts zu tun. Übernähme das Modell sie, stünde
 * im Szenario ein Ort, den niemand abgeleitet hat – genau das Gegenteil des
 * Zwecks. Deshalb ist das Ganze auch **abschaltbar** (Checkbox in der Maske):
 * Wer den Verdacht hat, dass die Beispiele durchschlagen, dreht sie ab und
 * leitet neu ab.
 *
 * Gezogen wird aus der Liste des **Genres**, wie bei den Würfeln selbst – ein
 * Formbeispiel aus der falschen Welt wäre ein Stilbruch statt einer Vorlage.
 * Unbekanntes oder fehlendes Genre fällt auf Gegenwart zurück (dieselbe Regel
 * wie überall).
 */
export type ScenarioSamples = {
  orte: string[];
  zeiten: string[];
  regeln: string[];
};

/**
 * Drei Beispiele je Feld. Drei, weil zwei als Zufall durchgehen und vier den
 * Prompt in die Länge ziehen, ohne mehr über die Form zu sagen; die Einträge
 * sind je ein bis zwei Zeilen.
 */
export function scenarioSamples(genre?: string): ScenarioSamples {
  const key = genre ?? "";
  return {
    orte: pickSome(PLACES_BY_GENRE[key] ?? GEGENWART_PLACES, 3, 3),
    zeiten: pickSome(TIMES_BY_GENRE[key] ?? GEGENWART_TIMES, 3, 3),
    regeln: pickSome(RULES_BY_GENRE[key] ?? GEGENWART_RULES, 3, 3),
  };
}
