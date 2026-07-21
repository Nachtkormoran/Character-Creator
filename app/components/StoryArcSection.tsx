"use client";

import { ARC_PHASE_LABELS, type ArcPhase, type StoryArc } from "@/lib/schema";
import { AutoTextarea } from "./AutoTextarea";

/**
 * Der **Story Arc** eines Szenarios – die dramaturgische Zerlegung des aktiven
 * Handlungsentwurfs in eine geordnete Folge von Stationen, dargestellt als
 * vertikale Zeitleiste von Karten.
 *
 * Bewusst **präsentierend**, wie `ScenarioFields`: Die Komponente kennt kein
 * `fetch`. Sie zeigt den Arc, meldet Änderungen (Titel/Beschreibung tippen,
 * Station löschen) über `onChange` und den Ableiten-Wunsch über `onAbleiten`.
 * Erzeugen, Speichern und Verwerfen liegen in der Seite (`scenarios/[id]`),
 * die den Arc in ihren Bearbeitungs-Zustand einreiht – wie `plotVariants`.
 *
 * Die **Farbfolge der Phasen ist Struktur, keine Deko**: Die fünf Stufen sind
 * eine typisierte, aufsteigende Reihenfolge (Exposition → Auflösung), und die
 * Farbe macht sie beim Überfliegen erkennbar. Die Klassen stehen als Literale
 * in der Tabelle unten, damit Tailwind sie erzeugt (dynamisch zusammengesetzte
 * Klassen würde der JIT nicht sehen).
 */
const PHASE_STYLE: Record<ArcPhase, { dot: string; chip: string }> = {
  exposition: {
    dot: "bg-[#607089] dark:bg-[#93a3bb]",
    chip: "text-[#607089] dark:text-[#93a3bb] border-[#607089]/30 bg-[#607089]/10 dark:border-[#93a3bb]/30 dark:bg-[#93a3bb]/10",
  },
  steigerung: {
    dot: "bg-[#c2740a] dark:bg-[#f0a531]",
    chip: "text-[#c2740a] dark:text-[#f0a531] border-[#c2740a]/30 bg-[#c2740a]/10 dark:border-[#f0a531]/30 dark:bg-[#f0a531]/10",
  },
  hoehepunkt: {
    dot: "bg-[#d8375f] dark:bg-[#fb7392]",
    chip: "text-[#d8375f] dark:text-[#fb7392] border-[#d8375f]/30 bg-[#d8375f]/10 dark:border-[#fb7392]/30 dark:bg-[#fb7392]/10",
  },
  fall: {
    dot: "bg-[#7256c9] dark:bg-[#ab92f2]",
    chip: "text-[#7256c9] dark:text-[#ab92f2] border-[#7256c9]/30 bg-[#7256c9]/10 dark:border-[#ab92f2]/30 dark:bg-[#ab92f2]/10",
  },
  aufloesung: {
    dot: "bg-[#0f8a63] dark:bg-[#37c795]",
    chip: "text-[#0f8a63] dark:text-[#37c795] border-[#0f8a63]/30 bg-[#0f8a63]/10 dark:border-[#37c795]/30 dark:bg-[#37c795]/10",
  },
};

export function StoryArcSection({
  storyArc,
  onChange,
  onAbleiten,
  busy,
  error,
  disabled,
  handlung,
  quelleLabel,
}: {
  storyArc: StoryArc;
  onChange: (arc: StoryArc) => void;
  onAbleiten: () => void;
  busy: boolean;
  error: string | null;
  disabled: boolean;
  /** Der aktive Handlungsentwurf – ohne ihn lässt sich nichts ableiten. */
  handlung: string;
  /** Etikett des Entwurfs, aus dem abgeleitet wird (z. B. „Entwurf 2"). */
  quelleLabel: string;
}) {
  const stufen = storyArc.stufen;
  const hatArc = stufen.length > 0;
  const kannAbleiten = handlung.trim().length > 0 && !busy && !disabled;

  function stufeAendern(i: number, patch: Partial<StoryArc["stufen"][number]>) {
    onChange({
      stufen: stufen.map((s, k) => (k === i ? { ...s, ...patch } : s)),
    });
  }

  function stufeLoeschen(i: number) {
    onChange({ stufen: stufen.filter((_, k) => k !== i) });
  }

  return (
    <section className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-foreground/60 uppercase">
            Story Arc
          </h2>
          <p className="mt-1 text-xs text-foreground/50">
            {hatArc
              ? `Fünfakter – abgeleitet aus ${quelleLabel}.`
              : "Die dramaturgische Zerlegung des Handlungsentwurfs in fünf Stationen."}
          </p>
        </div>
        <button
          type="button"
          onClick={onAbleiten}
          disabled={!kannAbleiten}
          title={
            handlung.trim()
              ? "Zerlegt den aktiven Handlungsentwurf in einen Fünfakter"
              : "Zuerst einen Handlungsentwurf erzeugen"
          }
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
        >
          {busy
            ? "Leite ab …"
            : hatArc
              ? "📖 Neu ableiten"
              : "📖 Story Arc ableiten"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {!hatArc && !busy && (
        <p className="mt-4 text-sm text-foreground/50">
          {handlung.trim()
            ? "Noch kein Story Arc. „Story Arc ableiten“ zerlegt den Handlungsentwurf oben in Exposition, Steigerung, Höhepunkt, Fall und Auflösung."
            : "Sobald ein Handlungsentwurf steht, lässt sich daraus ein Story Arc ableiten."}
        </p>
      )}

      {hatArc && (
        <ol className="relative mt-5">
          {/* durchgehende Linie hinter den Punkten */}
          <span
            aria-hidden
            className="absolute top-3 bottom-3 left-[0.34rem] w-px bg-black/10 dark:bg-white/10"
          />
          {stufen.map((s, i) => {
            const stil = PHASE_STYLE[s.phase];
            return (
              <li
                key={i}
                className="relative grid grid-cols-[1.25rem_1fr] gap-3 pb-4 last:pb-0"
              >
                <div className="relative">
                  <span
                    className={`absolute top-2 left-0 size-3 rounded-full ring-4 ring-white dark:ring-[#0a0a0a] ${stil.dot}`}
                  />
                </div>
                <div className="rounded-lg border border-black/10 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase ${stil.chip}`}
                    >
                      <span className="tabular-nums opacity-70">{i + 1}</span>
                      {ARC_PHASE_LABELS[s.phase]}
                    </span>
                    <button
                      type="button"
                      onClick={() => stufeLoeschen(i)}
                      disabled={disabled}
                      aria-label={`Station ${i + 1} löschen`}
                      title="Station löschen"
                      className="rounded px-1.5 py-0.5 text-sm leading-none text-foreground/35 transition hover:bg-black/[0.05] hover:text-foreground/70 disabled:opacity-40 dark:hover:bg-white/[0.06]"
                    >
                      ✕
                    </button>
                  </div>

                  <input
                    value={s.titel}
                    onChange={(e) => stufeAendern(i, { titel: e.target.value })}
                    disabled={disabled}
                    aria-label={`Titel der Station ${i + 1}`}
                    placeholder="Titel der Station"
                    maxLength={200}
                    className="mt-2 -mx-2 w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none transition hover:border-black/15 focus:border-black/40 disabled:opacity-60 dark:hover:border-white/15 dark:focus:border-white/40"
                  />

                  <AutoTextarea
                    value={s.beschreibung}
                    onChange={(v) => stufeAendern(i, { beschreibung: v })}
                    ariaLabel={`Beschreibung der Station ${i + 1}`}
                    placeholder="Was in dieser Station geschieht …"
                    className="text-sm text-foreground/80"
                  />

                  {s.figuren.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.figuren.map((f, k) => (
                        <span
                          key={k}
                          className="rounded-full border border-black/10 bg-black/[0.04] px-2 py-0.5 text-xs text-foreground/70 dark:border-white/10 dark:bg-white/[0.06]"
                        >
                          ◆ {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
