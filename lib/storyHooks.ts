/**
 * Ansatzpunkte als Liste – Zerlegen und Zusammensetzen.
 *
 * **Gespeichert bleibt ein einzelner String** (`Character.storyHooks`), die
 * Einträge durch eine Leerzeile getrennt. Kein JSON-Array, obwohl das Projekt
 * das sonst tut (`traits`, `input`, `details`): Die beiden Verbraucher dieses
 * Feldes – `buildScenarioPlotPrompt` und `buildScenarioFromCharacterPrompt` –
 * wollen Fließtext, und die Exportdatei ebenso. Ein Array müsste an jeder
 * dieser Stellen wieder zu Text werden, und alte Sicherungen und Exportdateien
 * würden ungültig. Die Liste ist eine **Sache der Oberfläche**; unten bleibt es
 * derselbe Text wie zuvor.
 *
 * Die Leerzeile als Trenner ist deshalb kein Format, das jemand einhalten muss:
 * `joinHooks` stellt sie her, indem es Leerzeilen **innerhalb** eines Eintrags
 * zu einfachen Umbrüchen einebnet. Ohne das könnte ein Eintrag, in den jemand
 * einen Absatz tippt, beim nächsten Laden in zwei zerfallen.
 */

/** Zerlegt den gespeicherten Text in einzelne Ansatzpunkte. */
export function splitHooks(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((eintrag) =>
      eintrag
        .trim()
        // Bestände von vor der Liste sind nummeriert („1. Titel: …“), weil der
        // Prompt das damals verlangte. Die Nummer wäre in einer Liste, die man
        // einzeln löscht, sofort falsch – deshalb fällt sie beim Lesen weg.
        .replace(/^\d+[.)]\s*/, ""),
    )
    .filter(Boolean);
}

/** Setzt die Liste zu dem Text zusammen, der in der Datenbank landet. */
export function joinHooks(hooks: string[]): string {
  return hooks
    .map((eintrag) => eintrag.trim().replace(/\n\s*\n+/g, "\n"))
    .filter(Boolean)
    .join("\n\n");
}
