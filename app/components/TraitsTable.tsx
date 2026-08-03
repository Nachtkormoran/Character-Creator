import { TRAIT_LABELS, type CharacterTraits } from "@/lib/schema";

export function TraitsTable({
  traits,
  onChange,
  compact = false,
}: {
  traits: CharacterTraits;
  /** Wenn gesetzt, werden die Werte editierbar (Inputs). */
  onChange?: (key: keyof CharacterTraits, value: string) => void;
  /**
   * Kleinere Schrift und schmalere Beschriftungsspalte. Für die Detailansicht
   * der Galerie: die ist breiter als das Formular, dort ließe `w-2/5` neben
   * kurzen Werten wie „34" eine halbe Zeile Leerraum stehen.
   */
  compact?: boolean;
}) {
  const keys = Object.keys(TRAIT_LABELS) as (keyof CharacterTraits)[];
  const labelWidth = compact ? "w-1/5" : "w-2/5";
  const textSize = compact ? "text-xs" : "text-sm";
  // Eingaben mobil auf 16px, damit iOS beim Fokus nicht hineinzoomt; ab `sm`
  // wieder kompakt.
  const inputSize = compact ? "text-base sm:text-xs" : "text-base sm:text-sm";

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className={`w-full ${textSize}`}>
        <tbody>
          {keys.map((key, i) => {
            const numeric = key === "alter";
            return (
              <tr key={key} className={i % 2 === 0 ? "bg-muted" : undefined}>
                <th
                  className={`${labelWidth} whitespace-nowrap px-4 py-1 text-left font-medium text-muted-foreground`}
                >
                  {TRAIT_LABELS[key]}
                </th>
                <td className={`px-4 py-0.5 ${numeric ? "tabular-nums" : ""}`}>
                  {onChange ? (
                    <input
                      value={String(traits[key])}
                      onChange={(e) => onChange(key, e.target.value)}
                      inputMode={numeric ? "numeric" : undefined}
                      className={`w-full rounded-md border border-border bg-background px-2 py-0.5 ${inputSize} ${numeric ? "tabular-nums" : ""} text-foreground outline-none transition focus:border-primary/50`}
                    />
                  ) : (
                    String(traits[key])
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
