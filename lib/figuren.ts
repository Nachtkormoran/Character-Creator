/**
 * Figuren-Notizen als Liste – Zerlegen, Zusammensetzen und die je Figur
 * eigene **Aktiv-Markierung**.
 *
 * **Gespeichert bleibt ein einzelner String** (`ScenarioDetails.figuren`), die
 * Einträge durch einen Zeilenumbruch getrennt – genau das Format, das Würfel,
 * KI-Ergänzung und das „Zufällige Szenario" seit jeher schreiben („Name: Rolle;
 * Riss." je Zeile). Kein JSON-Array, obwohl die Oberfläche die Figuren als
 * Kartenliste führt: Die Verbraucher des Feldes – die Prompts von
 * `scenario-plot`, `scenario-arc`, das Ergänzen und die Personensuche – wollen
 * Fließtext, und alte Sicherungen wie Exportdateien enthalten den String. Die
 * Liste ist eine **Sache der Oberfläche**; unten bleibt derselbe Text wie zuvor.
 * Dieselbe Überlegung wie bei den Ansatzpunkten (`lib/storyHooks.ts`).
 *
 * **Ob eine Figur in Handlungsentwurf/Story Arc einfließt, steht ebenfalls im
 * String** – als Präfix `⊘ ` vor den **inaktiven** Figuren. So ist die Wahl
 * eine Eigenschaft der Figur, die über „Änderungen speichern", Export und Import
 * mitreist, ohne eine zweite Datenquelle oder eine Schemaänderung. Aktive
 * Figuren tragen **kein** Präfix: Ein Altbestand (kein Präfix) ist damit
 * durchweg aktiv, und ein Szenario, in dem alle Figuren aktiv sind, ist
 * zeichengleich mit dem von vorher. Prompts und das Ergänzen bekommen den Text
 * stets **ohne** Präfix (`aktiveFiguren` / `figurenText`) – das Markup bleibt in
 * Oberfläche und Speicher.
 *
 * Der Trenner ist kein Format, das jemand einhalten muss: `joinFigurenDetail`
 * ebnet Umbrüche **innerhalb** eines Eintrags zu Leerzeichen ein – tippt jemand
 * in eine Figur-Karte einen Absatz, zerfiele sie sonst beim nächsten Laden in
 * zwei Figuren.
 */

/** Präfix vor **inaktiven** Figuren. Aktive tragen keins (s. o.). */
export const INAKTIV_PRAEFIX = "⊘ ";

/** Eine Figur samt ihrer Aktiv-Wahl, wie die Oberfläche sie führt. */
export interface FigurEintrag {
  text: string;
  aktiv: boolean;
}

/** Zerlegt den gespeicherten Text in einzelne Figuren (eine je Zeile). */
export function splitFiguren(text: string): string[] {
  return text
    .split(/\n+/)
    .map((zeile) => zeile.trim())
    .filter(Boolean);
}

/** Setzt eine Liste **reiner Texte** (ohne Markup) zu einem String zusammen. */
export function joinFiguren(figuren: string[]): string {
  return figuren
    .map((eintrag) => eintrag.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Liest eine Zeile in `{ text, aktiv }` – `⊘ ` am Anfang heißt inaktiv. */
export function parseFigur(zeile: string): FigurEintrag {
  const t = zeile.trim();
  if (t.startsWith(INAKTIV_PRAEFIX)) {
    return { text: t.slice(INAKTIV_PRAEFIX.length).trim(), aktiv: false };
  }
  return { text: t, aktiv: true };
}

/** Zerlegt den gespeicherten Text in Figuren **samt Aktiv-Wahl**. */
export function splitFigurenDetail(text: string): FigurEintrag[] {
  return splitFiguren(text).map(parseFigur);
}

/**
 * Setzt Figuren **samt Aktiv-Wahl** zum gespeicherten String zusammen. Leere
 * Einträge fallen weg (auch inaktive – ein `⊘ ` allein wäre keine Figur);
 * interne Umbrüche werden eingeebnet.
 */
export function joinFigurenDetail(figuren: FigurEintrag[]): string {
  return figuren
    .map((f) => ({ text: f.text.replace(/\s*\n\s*/g, " ").trim(), aktiv: f.aktiv }))
    .filter((f) => f.text)
    .map((f) => (f.aktiv ? f.text : INAKTIV_PRAEFIX + f.text))
    .join("\n");
}

/**
 * Die **aktiven** Figuren als reiner Text (ohne Markup), je Zeile eine – das,
 * was in Handlungsentwurf und Story Arc einfließt. Sind keine aktiv, ist das
 * Ergebnis `""`, und der Prompt ist zeichengenau der ohne Figuren-Notizen.
 */
export function aktiveFiguren(text: string): string {
  return splitFigurenDetail(text)
    .filter((f) => f.aktiv)
    .map((f) => f.text)
    .join("\n");
}

/** **Alle** Figuren als reiner Text (ohne Markup), unabhängig von der Aktiv-Wahl. */
export function figurenText(text: string): string {
  return splitFigurenDetail(text)
    .map((f) => f.text)
    .join("\n");
}
