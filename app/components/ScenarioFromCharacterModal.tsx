"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createScenario, generateScenarioFromCharacter } from "@/lib/client";
import {
  normalizeScenarioDetails,
  type GeneratedCharacter,
  type ScenarioDetails,
} from "@/lib/schema";
import type { StoredCharacter, StoredScenario } from "@/lib/serialize";
import { ScenarioFields } from "./ScenarioFields";
import { useBackdropClose } from "./useBackdropClose";

/**
 * Leitet aus einem Charakter ein **Szenario** ab – die Gegenrichtung zu
 * „Charakter für dieses Szenario anlegen" in der Szenario-Detailansicht.
 *
 * Der Ablauf ist bewusst **zweistufig**: erst schlägt das Modell vor, dann
 * legt der Nutzer an. Der Vorschlag landet in derselben Maske
 * (`ScenarioFields`), in der das Szenario später bearbeitet wird – wer hier
 * etwas ändert, muss es nicht anschließend nochmal aufsuchen. Erst „Szenario
 * anlegen" schreibt in die Datenbank. Ein ungefragt entstandenes Szenario
 * müsste man wieder löschen, und ein Modellvorschlag ist nicht zwangsläufig
 * gut.
 *
 * Eigene Ebene über der Detailansicht (`z-70`, wie Bilder- und
 * Vorgaben-Ansicht). Wie bei `CharacterInputModal` reicht hier ein gewöhnlicher
 * Esc-Handler: über dieser Ebene liegt nichts, und sie ist mit den anderen nie
 * gleichzeitig offen – die Neu-Registrierungs-Falle aus `CharacterImagesModal`
 * entsteht gar nicht erst.
 */
export function ScenarioFromCharacterModal({
  character: c,
  edited,
  storyHooks,
  genre,
  onScenarioCreated,
  onAssign,
  onClose,
}: {
  character: StoredCharacter;
  /**
   * Der **bearbeitete** Stand aus der Detailansicht, nicht der gespeicherte.
   * Wer gerade den Beruf geändert hat und dann ableiten lässt, meint den
   * neuen – dieselbe Regel wie bei „Text neu erzeugen".
   */
  edited: GeneratedCharacter;
  storyHooks: string;
  /**
   * Das Genre aus der Detailansicht – der **bearbeitete** Stand, nicht der
   * gespeicherte. Wer das Genre gerade umgestellt und noch nicht gespeichert
   * hat und dann ableiten lässt, meint das neue; dieselbe Regel wie bei
   * `edited`. Es **entscheidet** über das Genre des Szenarios und wird nicht
   * vom Modell gewählt: Wer einen Charakter als Märchenfigur angelegt hat,
   * will keine historische Welt zurückbekommen, bloß weil Mühle und Wald auch
   * dorthin passen würden.
   */
  genre: string;
  /** Das neue Szenario in die Liste der aufrufenden Seite aufnehmen. */
  onScenarioCreated: (scenario: StoredScenario) => void;
  /** Den Charakter dem Szenario zuordnen (persistiert). */
  onAssign: (scenarioId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [details, setDetails] = useState<ScenarioDetails>(
    normalizeScenarioDetails({}),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Gesetzt, sobald angelegt – die Maske wird dann zur Erfolgsmeldung. */
  const [created, setCreated] = useState<StoredScenario | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  /**
   * Nur das Setting-Feld der ursprünglichen Vorgaben – der beste verfügbare
   * Hinweis aufs Genre. Hier oben und nicht im Aufruf, weil `?.` in einer
   * Abhängigkeitsliste kein gültiger Ausdruck ist.
   */
  const backdrop = useBackdropClose(onClose, { stopPropagation: true });

  const setting = c.input?.setting ?? "";

  /**
   * Die Eingaben der Ableitung liegen in einem Ref, nicht in den
   * Abhängigkeiten von `ableiten`.
   *
   * Der Grund ist kein Stil, sondern ein beobachteter Fehler: Hängt
   * `ableiten` an `edited`, ändert es seine Identität, sobald die
   * Detailansicht darüber neu rendert – und das tut sie beim Anlegen, weil
   * das neue Szenario dort in die Liste und an den Charakter wandert. Der
   * Effekt weiter unten lief dadurch ein zweites Mal an und schickte
   * **nach** dem Anlegen noch eine Ableitung hinterher, die den fertigen
   * Vorschlag wieder aus der Maske räumte. Mit dem Ref bleibt `ableiten`
   * stabil, der Effekt hat leere Abhängigkeiten und kann nicht erneut
   * zünden.
   */
  const eingaben = useRef({ edited, storyHooks, setting, genre });
  useEffect(() => {
    eingaben.current = { edited, storyHooks, setting, genre };
  });

  const ableiten = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { edited, storyHooks, setting, genre } = eingaben.current;
      const { draft } = await generateScenarioFromCharacter(
        edited,
        storyHooks,
        setting,
        genre,
      );
      const { name: vorschlag, ...rest } = draft;
      setName(vorschlag);
      // Über `normalizeScenarioDetails`, damit `handlung` als leeres Feld
      // dasteht: der Entwurf liefert es nicht (er braucht mehrere Figuren),
      // und ein fehlender Schlüssel wäre in der Maske ein `undefined`.
      setDetails(normalizeScenarioDetails(rest));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  }, []);

  /**
   * Beim Öffnen sofort loslegen: Der Knopf, der hierher führt, heißt „Szenario
   * ableiten" – erst eine leere Maske und dann noch einen Knopf zu zeigen,
   * wäre ein Klick ohne Entscheidung. `useRef` verhindert den zweiten Lauf im
   * StrictMode, der sonst einen Aufruf verschenken würde.
   */
  const gestartet = useRef(false);
  useEffect(() => {
    if (gestartet.current) return;
    gestartet.current = true;
    void ableiten();
  }, [ableiten]);

  const nameValid = name.trim().length > 0;
  const hatVorschlag = nameValid || details.ort.trim() !== "";

  async function anlegen() {
    if (!nameValid || saving) return;
    // Ein Charakter gehört zu genau einem Szenario. Ist er schon zugeordnet,
    // wäre das Anlegen ein stiller Umzug – danach stünde er in einer Welt,
    // in die ihn niemand gestellt hat.
    if (
      c.scenarioId &&
      !confirm(
        `${edited.name} ist bereits einem Szenario zugeordnet und wird in das neue verschoben. Fortfahren?`,
      )
    )
      return;

    setSaving(true);
    setError(null);
    try {
      const scenario = await createScenario(name.trim(), details);
      onScenarioCreated(scenario);
      // Die Zuordnung ist der eigentliche Zweck: die Welt wurde aus dieser
      // Figur abgeleitet, also gehört sie hinein. Schlägt sie fehl, bleibt
      // das Szenario trotzdem bestehen – es von Hand zuzuordnen ist ein
      // Klick, es neu zu erzeugen kostet einen weiteren Modellaufruf.
      await onAssign(scenario.id);
      setCreated(scenario);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Anlegen fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      {...backdrop}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">
              Szenario aus {edited.name || "diesem Charakter"}
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              Die Welt, die diese Figur hervorgebracht hat – abgeleitet aus
              Beschreibung, Merkmalen und Ansatzpunkten. Alles lässt sich vor
              dem Anlegen ändern.
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="shrink-0 rounded-md px-2 py-1 text-foreground/60 transition hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {created ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-green-600/30 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-300">
              Szenario „{created.name}“ wurde angelegt und {edited.name} ist ihm
              zugeordnet.
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/scenarios/${created.id}`}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
              >
                Zum Szenario
              </Link>
              <button
                onClick={onClose}
                className="text-sm text-foreground/60 transition hover:text-foreground"
              >
                Schließen
              </button>
            </div>
            <p className="text-xs text-foreground/50">
              Ein Handlungsentwurf entsteht dort – er braucht mehrere Figuren.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {busy && !hatVorschlag ? (
              <p className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-sm text-foreground/60 dark:border-white/15">
                Die Welt wird entworfen … einen Moment.
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium">Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={busy || saving}
                    maxLength={80}
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
                  />
                  <span className="text-xs text-foreground/50">
                    Benennt die Welt, nicht die Person – es kommen weitere
                    Figuren dazu.
                  </span>
                </label>

                <ScenarioFields
                  details={details}
                  onChange={setDetails}
                  disabled={busy || saving}
                />
              </>
            )}

            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-4 dark:border-white/10">
              <button
                onClick={anlegen}
                disabled={!nameValid || busy || saving}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Lege an …" : "Szenario anlegen"}
              </button>
              <button
                onClick={() => {
                  if (
                    hatVorschlag &&
                    !confirm("Der Vorschlag wird ersetzt. Fortfahren?")
                  )
                    return;
                  void ableiten();
                }}
                disabled={busy || saving}
                title="Erzeugt einen neuen Vorschlag – kostet einen weiteren Modellaufruf"
                className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
              >
                {busy ? "Entwirft …" : "✨ Neu ableiten"}
              </button>
              <button
                onClick={onClose}
                disabled={saving}
                className="ml-auto text-sm text-foreground/60 transition hover:text-foreground disabled:opacity-50"
              >
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
