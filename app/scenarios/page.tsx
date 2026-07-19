"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  createScenario,
  generateScenarioDescription,
  listScenarios,
} from "@/lib/client";
import {
  SCENARIO_LABELS,
  normalizeScenarioDetails,
  type ScenarioDetails,
} from "@/lib/schema";
import type { StoredScenario } from "@/lib/serialize";
import { GENRE_TEMPLATES } from "@/lib/templates";
import { ScenarioFields } from "../components/ScenarioFields";

/** Genre-Id → Anzeigename. Gespeichert wird die Id, angezeigt das Label. */
export function genreLabel(id: string): string {
  const g = GENRE_TEMPLATES.find((t) => t.id === id);
  return g ? `${g.emoji} ${g.label}` : id;
}

/**
 * Die Zeile unter dem Namen in der Übersicht: die gefüllten Festlegungen,
 * durch „·" getrennt. Läuft über `SCENARIO_LABELS`, damit ein neues Feld
 * automatisch mitkommt – und überspringt leere, damit ein frisch angelegtes
 * Szenario nicht als Reihe von Gedankenstrichen dasteht.
 */
function summary(details: ScenarioDetails): string {
  return (Object.keys(SCENARIO_LABELS) as Array<keyof ScenarioDetails>)
    .map((key) => {
      // Die Beschreibung bleibt draußen: sie ist der längste Text von allen
      // und würde die Zeile allein füllen. Hier stehen die Eckdaten.
      if (key === "beschreibung") return null;
      const value = details[key]?.trim();
      if (!value) return null;
      if (key === "genre") return genreLabel(value);
      // Die Regeln sind oft mehrere Sätze – in einer Zeile nur angerissen.
      return key === "regeln" ? `${value.slice(0, 60)}…` : value;
    })
    .filter(Boolean)
    .join(" · ");
}

const LEER: ScenarioDetails = normalizeScenarioDetails({});

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<StoredScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Anlege-Formular. Eingeklappt, solange es nicht gebraucht wird: die Seite
  // ist in erster Linie eine Übersicht.
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [details, setDetails] = useState<ScenarioDetails>(LEER);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  /**
   * Beschreibung erzeugen. Ein zweiter Klick überschreibt, was im Feld steht –
   * deshalb die Rückfrage, sobald dort schon etwas ist. Von Hand Geschriebenes
   * wäre sonst still weg.
   */
  async function generateDescription() {
    if (generating) return;
    if (
      details.beschreibung.trim() &&
      !confirm("Die vorhandene Beschreibung wird ersetzt. Fortfahren?")
    )
      return;
    setGenerating(true);
    setFormError(null);
    try {
      const { beschreibung } = await generateScenarioDescription(
        name.trim(),
        details,
      );
      setDetails((d) => ({ ...d, beschreibung }));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Fehler.");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    listScenarios()
      .then(setScenarios)
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler."))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setName("");
    setDetails(LEER);
    setFormError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const neu = await createScenario(name.trim(), details);
      setScenarios((s) =>
        [...s, neu].sort((a, b) => a.name.localeCompare(b.name, "de")),
      );
      resetForm();
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Fehler.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Szenarien</h1>
          <p className="mt-1 text-sm text-foreground/60">
            Ein Szenario fasst Charaktere für eine Geschichte zusammen und hält
            fest, was für sie alle gilt.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormOpen((o) => !o);
            if (formOpen) resetForm();
          }}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          {formOpen ? "Abbrechen" : "+ Neues Szenario"}
        </button>
      </div>

      {formOpen && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              autoFocus
              placeholder="z. B. „Die Bucht von Vigo“"
              className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
            />
            <span className="text-xs text-foreground/50">
              Das Einzige, was ein Szenario braucht. Alles Weitere lässt sich
              auch später ergänzen.
            </span>
          </label>

          <ScenarioFields
            details={details}
            onChange={setDetails}
            disabled={saving}
            onGenerateBeschreibung={generateDescription}
            generating={generating}
          />

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Lege an …" : "Szenario anlegen"}
            </button>
            {formError && (
              <span className="text-sm text-red-600 dark:text-red-400">
                {formError}
              </span>
            )}
          </div>
        </form>
      )}

      {loading && <p className="text-foreground/60">Lade Szenarien …</p>}
      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && scenarios.length === 0 && !formOpen && (
        <div className="rounded-xl border border-dashed border-black/15 p-10 text-center text-foreground/60 dark:border-white/15">
          Noch keine Szenarien.{" "}
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="underline"
          >
            Jetzt eines anlegen
          </button>
          .
        </div>
      )}

      {scenarios.length > 0 && (
        <ul className="flex flex-col gap-3">
          {scenarios.map((s) => {
            const zeile = summary(s.details);
            return (
              <li key={s.id}>
                <Link
                  href={`/scenarios/${s.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-black/10 bg-white p-4 transition hover:shadow-md dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{s.name}</span>
                    <p className="truncate text-sm text-foreground/60">
                      {zeile || "Noch keine Festlegungen"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-foreground/50">
                    {s.count === 1 ? "1 Charakter" : `${s.count} Charaktere`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
