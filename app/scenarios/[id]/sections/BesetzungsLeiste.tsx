"use client";

import Image from "next/image";
import { Star, User } from "../../../components/ui/icons";
import { primaryImage, type StoredCharacter } from "@/lib/serialize";

/**
 * **Besetzungs-Leiste** – eine schmale, dauerhaft sichtbare Referenz der
 * zugeordneten Charaktere im Story-Arc-Tab. Dort fehlt die volle Besetzung sonst
 * (die lebt im Tab „Besetzung & Handlung"), man will die Figuren beim Ausarbeiten
 * aber im Blick behalten. Rein zum **Ansehen und Anspringen**: Klick auf ein
 * Porträt öffnet die Charakter-Detailansicht (dieselbe wie eine Kachel), der
 * Stern markiert Protagonisten. Verwaltung (Anlegen/Figuren) bleibt im anderen Tab.
 */
export function BesetzungsLeiste({
  characters,
  onSelect,
  onGoToBesetzung,
}: {
  characters: StoredCharacter[];
  onSelect: (c: StoredCharacter) => void;
  onGoToBesetzung: () => void;
}) {
  if (characters.length === 0) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span>Diesem Szenario ist noch keine Figur zugeordnet.</span>
        <button
          type="button"
          onClick={onGoToBesetzung}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          → Besetzung &amp; Handlung
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <span className="flex flex-none flex-col leading-tight">
        <span className="text-[0.68rem] font-semibold tracking-wide text-muted-foreground uppercase">
          Besetzung
        </span>
        <span className="font-display text-base font-semibold tabular-nums">
          {characters.length}
        </span>
      </span>
      <div className="flex flex-1 gap-1.5 overflow-x-auto py-0.5">
        {characters.map((c) => {
          const preview = primaryImage(c)?.thumbnail;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              title={
                c.character.kurzbeschreibung
                  ? `${c.character.name} – ${c.character.kurzbeschreibung}`
                  : c.character.name
              }
              className="flex w-16 flex-none flex-col items-center gap-1 rounded-lg p-1 transition hover:bg-muted"
            >
              <span className="relative">
                <span
                  className={`relative flex size-11 items-center justify-center overflow-hidden rounded-full border-2 bg-muted ${
                    c.isProtagonist ? "border-amber-400" : "border-card"
                  }`}
                >
                  {preview ? (
                    <Image
                      src={preview}
                      alt={c.character.name}
                      fill
                      sizes="44px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <User
                      size={20}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      className="text-muted-foreground"
                    />
                  )}
                </span>
                {c.isProtagonist && (
                  <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-[1.5px] border-card bg-amber-400 text-white">
                    <Star size={9} strokeWidth={2.5} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-[0.7rem] leading-tight">
                {c.character.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
