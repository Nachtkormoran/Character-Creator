"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { cloneCharacter, listCharacters, updateCharacterScenario } from "@/lib/client";
import { primaryImage, type StoredCharacter, type StoredScenario } from "@/lib/serialize";
import { useBackdropClose } from "./useBackdropClose";
import { useOpenAtTop } from "./useOpenAtTop";

/**
 * Einen **bestehenden** Charakter zu einem Szenario hinzufügen – die
 * Gegenrichtung zu „+ Charakter für dieses Szenario" (das eine neue Figur
 * anlegt).
 *
 * Gezeigt werden nur Charaktere, die dem Szenario **noch nicht** angehören.
 * Zwei Fälle beim Hinzufügen:
 * - **Ohne Szenario:** schlichtes Zuordnen (der Charakter zieht her).
 * - **Schon in einem anderen Szenario:** ein Umhängen wäre dort ein Wegnehmen.
 *   Deshalb eine **Warnung** und, wenn gewünscht, eine **Kopie** – das Original
 *   bleibt in seiner Welt. (Das Datenmodell ist bewusst 1-zu-n; eine echte
 *   Mehrfachzuordnung hätte weitreichende Folgen, s. CLAUDE.md.)
 *
 * Erste Overlay-Ebene über einer echten Seite (kein `backdrop-blur`-Vorfahr),
 * daher ein gewöhnlicher Esc-Handler wie bei `PlotPersonModal`.
 */
export function AddCharacterToScenarioModal({
  scenarioId,
  scenarios,
  onAdded,
  onClose,
}: {
  scenarioId: string;
  /** Alle Szenarien – nur, um zum fremden `scenarioId` den Namen zu zeigen. */
  scenarios: StoredScenario[];
  /** Der zugeordnete bzw. kopierte Charakter, zum Einreihen in die Seite. */
  onAdded: (character: StoredCharacter) => void;
  onClose: () => void;
}) {
  const backdrop = useBackdropClose(onClose, { stopPropagation: true });
  const dialog = useRef<HTMLDivElement>(null);
  useOpenAtTop(dialog);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const [kandidaten, setKandidaten] = useState<StoredCharacter[]>([]);
  const [laden, setLaden] = useState(true);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [suche, setSuche] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Der fremdzugeordnete Charakter, für den die Kopie-Rückfrage offen ist. */
  const [bestaetigung, setBestaetigung] = useState<StoredCharacter | null>(null);

  // Nur Charaktere, die diesem Szenario noch nicht angehören.
  useEffect(() => {
    listCharacters()
      .then((alle) =>
        setKandidaten(alle.filter((c) => c.scenarioId !== scenarioId)),
      )
      .catch((e) =>
        setLadeFehler(e instanceof Error ? e.message : "Laden fehlgeschlagen."),
      )
      .finally(() => setLaden(false));
  }, [scenarioId]);

  const szenarioName = useMemo(() => {
    const m = new Map(scenarios.map((s) => [s.id, s.name]));
    return (id: string | null) => (id ? m.get(id) ?? "einem anderen Szenario" : null);
  }, [scenarios]);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return kandidaten;
    return kandidaten.filter((c) =>
      (c.character.name ?? "").toLowerCase().includes(q),
    );
  }, [kandidaten, suche]);

  /** Klick auf einen Kandidaten: fremdzugeordnet → Rückfrage, sonst zuordnen. */
  function waehlen(c: StoredCharacter) {
    if (busyId) return;
    if (c.scenarioId && c.scenarioId !== scenarioId) {
      setBestaetigung(c);
      return;
    }
    zuordnen(c);
  }

  /** Unzugeordneten Charakter herziehen (schlichtes Umhängen). */
  async function zuordnen(c: StoredCharacter) {
    setBusyId(c.id);
    setFehler(null);
    try {
      const updated = await updateCharacterScenario(c.id, scenarioId);
      onAdded(updated);
      setKandidaten((ks) => ks.filter((k) => k.id !== c.id));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Zuordnen fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  /** Kopie des fremdzugeordneten Charakters anlegen und herholen. */
  async function kopieren(c: StoredCharacter) {
    setBusyId(c.id);
    setFehler(null);
    try {
      const kopie = await cloneCharacter(c.id, scenarioId);
      onAdded(kopie);
      // Das Original zeigen wir nicht erneut – eine zweite Kopie wäre selten
      // gewollt, und die Liste bleibt so „was sich noch hinzufügen lässt".
      setKandidaten((ks) => ks.filter((k) => k.id !== c.id));
      setBestaetigung(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Kopie fehlgeschlagen.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div
      {...backdrop}
      className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
    >
      <div
        ref={dialog}
        className="my-8 flex w-full max-w-2xl flex-col rounded-xl border border-border bg-background p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Charakter hinzufügen</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Nur Charaktere, die diesem Szenario noch nicht angehören.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="rounded-md px-2 py-1 text-xl leading-none text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* --- Kopie-Rückfrage (fremdzugeordneter Charakter) ---------------- */}
        {bestaetigung ? (
          <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              „{bestaetigung.character.name}“ gehört bereits zu „
              {szenarioName(bestaetigung.scenarioId)}“.
            </p>
            <p className="mt-2 text-sm text-amber-800/90 dark:text-amber-200/80">
              Ein Charakter kann immer nur in einem Szenario liegen. Fügst du ihn
              hier hinzu, wird eine <strong>Kopie</strong> angelegt und diesem
              Szenario zugeordnet – das Original bleibt unverändert in „
              {szenarioName(bestaetigung.scenarioId)}“. Die Kopie ist danach
              eigenständig; spätere Änderungen wirken nicht auf das Original.
            </p>
            {fehler && (
              <p className="mt-2 text-xs text-destructive">
                {fehler}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setBestaetigung(null)}
                disabled={busyId !== null}
                className="text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-50"
              >
                Zurück
              </button>
              <button
                type="button"
                onClick={() => kopieren(bestaetigung)}
                disabled={busyId !== null}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {busyId ? "Lege Kopie an …" : "Kopie anlegen"}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Suche – bei vielen Charakteren hilfreich. */}
            <input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder="Nach Name suchen …"
              aria-label="Charaktere nach Name durchsuchen"
              className="mt-4 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary/50"
            />

            {fehler && (
              <p className="mt-3 text-xs text-destructive">
                {fehler}
              </p>
            )}

            <div className="mt-4 max-h-[55vh] overflow-y-auto">
              {laden ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Lade Charaktere …
                </p>
              ) : ladeFehler ? (
                <p className="py-8 text-center text-sm text-destructive">
                  {ladeFehler}
                </p>
              ) : gefiltert.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {kandidaten.length === 0
                    ? "Alle vorhandenen Charaktere gehören bereits zu diesem Szenario."
                    : "Kein Charakter passt zur Suche."}
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {gefiltert.map((c) => {
                    const preview = primaryImage(c)?.thumbnail;
                    const fremd = !!c.scenarioId && c.scenarioId !== scenarioId;
                    const busy = busyId === c.id;
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => waehlen(c)}
                          disabled={busyId !== null}
                          title={c.character.kurzbeschreibung}
                          className="flex w-full items-center gap-3 rounded-lg border border-border bg-card p-2 text-left transition hover:border-border disabled:opacity-50"
                        >
                          <div className="relative aspect-square w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                            {preview ? (
                              <Image
                                src={preview}
                                alt={c.character.name ?? ""}
                                fill
                                sizes="48px"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-lg opacity-30">
                                🧑
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {c.character.name || "(ohne Name)"}
                            </p>
                            <p className="truncate text-xs text-foreground/55">
                              {c.character.kurzbeschreibung}
                            </p>
                          </div>
                          {fremd ? (
                            <span
                              title={`Gehört zu „${szenarioName(c.scenarioId)}" – wird als Kopie hinzugefügt`}
                              className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
                            >
                              Kopie
                            </span>
                          ) : (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {busy ? "…" : "hinzufügen"}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
