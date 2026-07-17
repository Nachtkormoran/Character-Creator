import { TRAIT_LABELS, type CharacterTraits } from "@/lib/schema";

export function TraitsTable({ traits }: { traits: CharacterTraits }) {
  const keys = Object.keys(TRAIT_LABELS) as (keyof CharacterTraits)[];

  return (
    <div className="overflow-x-auto rounded-lg border border-black/10 dark:border-white/10">
      <table className="w-full text-sm">
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
              <th className="w-2/5 whitespace-nowrap px-4 py-2 text-left font-medium text-foreground/60">
                {TRAIT_LABELS[key]}
              </th>
              <td className="px-4 py-2">{String(traits[key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
