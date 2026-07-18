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

  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className={`w-full ${textSize}`}>
        <tbody>
          {keys.map((key, i) => (
            <tr
              key={key}
              className={
                i % 2 === 0
                  ? "bg-black/[0.02] dark:bg-white/[0.03]"
                  : undefined
              }
            >
              <th
                className={`${labelWidth} whitespace-nowrap px-4 py-1 text-left font-medium text-foreground/60`}
              >
                {TRAIT_LABELS[key]}
              </th>
              <td className="px-4 py-0.5">
                {onChange ? (
                  <input
                    value={String(traits[key])}
                    onChange={(e) => onChange(key, e.target.value)}
                    inputMode={key === "alter" ? "numeric" : undefined}
                    className={`w-full rounded-md border border-black/15 bg-white px-2 py-0.5 ${textSize} outline-none transition focus:border-black/40 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40`}
                  />
                ) : (
                  String(traits[key])
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
