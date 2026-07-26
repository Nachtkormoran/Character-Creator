"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  createScenario,
  generateScenarioDescription,
  generateScenarioField,
  generateScenarioFigures,
  importScenarioFile,
  listScenarios,
} from "@/lib/client";
import {
  SCENARIO_LABELS,
  normalizeScenarioDetails,
  type ScenarioDetails,
} from "@/lib/schema";
import type { StoredScenario } from "@/lib/serialize";
import { genreLabel } from "@/lib/templates";
import { ScenarioFields } from "../components/ScenarioFields";
import { RandomScenarioModal } from "../components/RandomScenarioModal";

/**
 * Die Zeile unter dem Namen in der Übersicht: die gefüllten Festlegungen,
 * durch „·" getrennt. Läuft über `SCENARIO_LABELS`, damit ein neues Feld
 * automatisch mitkommt – und überspringt leere, damit ein frisch angelegtes
 * Szenario nicht als Reihe von Gedankenstrichen dasteht.
 */
function summary(details: ScenarioDetails): string {
  return (Object.keys(SCENARIO_LABELS) as Array<keyof ScenarioDetails>)
    .map((key) => {
      // Die langen Texte bleiben draußen: sie würden die Zeile allein füllen.
      // Hier stehen die Eckdaten (auch die Figuren-Notizen sind mehrzeilig).
      if (
        key === "beschreibung" ||
        key === "figuren" ||
        key === "handlung" ||
        key === "handlungselemente"
      )
        return null;
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

/** Gemeinsame Optik der Bedienelemente (Auswahl + Suche) – wie in der Galerie. */
const controlClass =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40";

type SortKey = "name-asc" | "name-desc" | "newest" | "oldest";

const SORT_LABELS: Record<SortKey, string> = {
  "name-asc": "Name A–Z",
  "name-desc": "Name Z–A",
  newest: "Neueste zuerst",
  oldest: "Älteste zuerst",
};

/**
 * Kleinschreibung ohne Diakritika, damit „muller" auch „Müller" findet – dieselbe
 * Normalisierung wie in der Charakterübersicht (dort lokal, hier lokal: die
 * beiden Seiten teilen sonst nichts, und die Funktion ist winzig).
 */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/['’‘´`]/g, "")
    .toLowerCase();
}

/**
 * Durchsuchbarer Text eines Szenarios: Name und **alle** Festlegungen (Genre als
 * Label, nicht als Id). Läuft über `SCENARIO_LABELS`, damit ein später ergänztes
 * Feld automatisch mitdurchsucht wird – dieselbe Idee wie bei `summary`.
 */
function searchableText(s: StoredScenario): string {
  const felder = (Object.keys(SCENARIO_LABELS) as Array<keyof ScenarioDetails>)
    .map((key) => {
      const value = s.details[key]?.trim();
      if (!value) return "";
      return key === "genre" ? genreLabel(value) : value;
    });
  return normalize([s.name, ...felder].join(" "));
}

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState<StoredScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Suche und Sortierung – wie in der Charakterübersicht. Standard bleibt die
  // alphabetische Reihenfolge (die die Listen-Route ohnehin liefert).
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name-asc");

  // Anlege-Formular. Eingeklappt, solange es nicht gebraucht wird: die Seite
  // ist in erster Linie eine Übersicht.
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [details, setDetails] = useState<ScenarioDetails>(LEER);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatingField, setGeneratingField] = useState<
    keyof ScenarioDetails | null
  >(null);
  /** Ob das „Zufälliges Szenario"-Modal offen ist. */
  const [randomOpen, setRandomOpen] = useState(false);

  // Import einer Szenario-Datei.
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  /**
   * Stichwörter für die Erzeugung, je Feld. Hier ist das nur die Beschreibung.
   *
   * Gehalten wird das **in der Seite, nicht in `details`** – und **gespeichert
   * wird es nicht**: Die Stichwörter beschreiben nichts am Szenario, sondern
   * wie man es gerade befragen will (dieselbe Regel wie „Bindung", „Richtung"
   * und der Zusatzwunsch am Handlungsentwurf). Nach dem Erzeugen bleiben sie
   * stehen, weil der häufigste Fall ein zweiter Versuch mit einer Ergänzung
   * ist; `resetForm` räumt sie mit dem übrigen Formular weg.
   */
  const [zusatz, setZusatz] = useState<
    Partial<Record<keyof ScenarioDetails, string>>
  >({});

  /**
   * Im Anlege-Formular ist **nur die Beschreibung** erzeugbar. Der
   * Handlungsentwurf braucht ein gespeichertes Szenario mit zugeordneten
   * Charakteren – beides gibt es hier noch nicht. Der Knopf erscheint erst in
   * der Detailansicht, statt hier zu sitzen und zu scheitern.
   */
  const ERZEUGBAR: ReadonlySet<keyof ScenarioDetails> = new Set([
    "ort",
    "zeit",
    "regeln",
    "beschreibung",
    "figuren",
  ]);

  /**
   * Beschreibung erzeugen. Ein zweiter Klick überschreibt, was im Feld steht –
   * deshalb die Rückfrage, sobald dort schon etwas ist. Von Hand Geschriebenes
   * wäre sonst still weg.
   */
  async function handleGenerate(key: keyof ScenarioDetails, anzahl?: number) {
    if (generatingField) return;
    // Nur die Beschreibung wird ersetzt; Ort, Zeit und Regeln werden ergänzt.
    if (
      key === "beschreibung" &&
      details[key].trim() &&
      !confirm(`${SCENARIO_LABELS[key]} wird ersetzt. Fortfahren?`)
    )
      return;
    setGeneratingField(key);
    setFormError(null);
    try {
      if (key === "ort" || key === "zeit" || key === "regeln") {
        const { wert } = await generateScenarioField(
          key,
          name.trim(),
          details,
          zusatz[key] ?? "",
        );
        setDetails((d) => ({ ...d, [key]: wert }));
      } else if (key === "figuren") {
        // Ergänzt wie Ort/Zeit/Regeln: Vorhandenes bleibt und prägt die neuen.
        const { wert } = await generateScenarioFigures(
          name.trim(),
          details,
          zusatz.figuren ?? "",
          anzahl,
        );
        setDetails((d) => ({ ...d, figuren: wert }));
      } else {
        const { beschreibung } = await generateScenarioDescription(
          name.trim(),
          details,
          zusatz.beschreibung ?? "",
        );
        setDetails((d) => ({ ...d, beschreibung }));
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Fehler.");
    } finally {
      setGeneratingField(null);
    }
  }

  useEffect(() => {
    listScenarios()
      .then(setScenarios)
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler."))
      .finally(() => setLoading(false));
  }, []);

  // Suchtext je Szenario einmal vorberechnen – die Beschreibungen sind lang.
  const searchIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of scenarios) m.set(s.id, searchableText(s));
    return m;
  }, [scenarios]);

  const visibleScenarios = useMemo(() => {
    // Mehrere Suchbegriffe werden UND-verknüpft (wie in der Galerie).
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const matching = scenarios.filter((s) => {
      if (terms.length === 0) return true;
      const haystack = searchIndex.get(s.id) ?? "";
      return terms.every((t) => haystack.includes(t));
    });
    return matching.sort((a, b) => {
      switch (sort) {
        case "name-desc":
          return b.name.localeCompare(a.name, "de");
        case "newest":
          return b.createdAt.localeCompare(a.createdAt);
        case "oldest":
          return a.createdAt.localeCompare(b.createdAt);
        default:
          return a.name.localeCompare(b.name, "de");
      }
    });
  }, [scenarios, query, sort, searchIndex]);

  /**
   * Eine Szenario-Exportdatei einspielen.
   *
   * Das neue Szenario wird **einsortiert**, nicht angehängt: Die Liste ist
   * alphabetisch, und ein Eintrag am Ende stünde für den Nutzer an einer
   * Stelle, an der er ihn nicht sucht. (Beim Charakter-Import ist es
   * andersherum – dort sortiert die Galerie nach „Neueste zuerst", und der
   * frisch importierte gehört nach oben.)
   *
   * Die Meldung nennt die Zahl der mitgekommenen Figuren. Sie ist die einzige
   * Stelle, an der man sie erfährt, ohne das Szenario zu öffnen – und die
   * Antwort auf die Frage, die man beim Import einer fremden Datei hat:
   * War die Besetzung dabei?
   */
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
    e.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportMessage(null);
    setImportError(null);
    try {
      const { scenario, characters } = await importScenarioFile(file);
      setScenarios((s) =>
        [...s, scenario].sort((a, b) => a.name.localeCompare(b.name, "de")),
      );
      setImportMessage(
        characters === 0
          ? `Szenario „${scenario.name}" importiert – ohne Charaktere.`
          : `Szenario „${scenario.name}" importiert, mit ${characters} ${
              characters === 1 ? "Charakter" : "Charakteren"
            }.`,
      );
    } catch (err) {
      setImportError(
        `${file.name}: ${err instanceof Error ? err.message : "Fehler."}`,
      );
    } finally {
      setImporting(false);
    }
  }

  function resetForm() {
    setName("");
    setDetails(LEER);
    setZusatz({});
    setFormError(null);
  }

  /**
   * Das Ergebnis des „Zufälligen Szenarios" ins Formular übernehmen: Name und
   * Festlegungen ersetzen. Die gefüllten `details` enthalten den (unveränderten)
   * Handlungsentwurf schon mit.
   */
  function applyRandom(neuerName: string, neueDetails: ScenarioDetails) {
    setName(neuerName);
    setDetails(neueDetails);
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
        <div className="flex flex-wrap items-center gap-3">
          {/*
            Wie in der Galerie ein `<label>` um ein verstecktes Datei-Feld: Ein
            Knopf, der eine Dateiauswahl öffnet, ist die einzige Bedienung, die
            der Browser nicht über einen gewöhnlichen `onClick` erlaubt.

            **Ohne `multiple`** – anders als beim Charakter-Import. Eine
            Szenario-Datei bringt eine ganze Welt samt Besetzung mit; mehrere
            auf einmal einzuspielen ist kein Bedürfnis, das je aufgetreten
            wäre, und der Fortschritt bei Dateien von vielen Megabyte ließe sich
            schlechter zeigen als der Reihe nach.
          */}
          <label
            title="Eine zuvor exportierte Szenario-Datei einspielen – Welt und, falls enthalten, ihre Charaktere kommen zum Bestand hinzu"
            className={`rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition dark:border-white/15 ${
              importing
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }`}
          >
            {importing ? "Importiere …" : "Szenario importieren"}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              disabled={importing}
              onChange={handleImport}
            />
          </label>
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
      </div>

      {importMessage && (
        <p className="rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-800 dark:text-green-300">
          {importMessage}
        </p>
      )}
      {importError && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {importError}
        </p>
      )}

      {formOpen && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-4 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]"
        >
          {/*
            Ganz oben: das ganze Szenario auf einmal würfeln. Öffnet ein Modal
            mit freier Vorgabe; bereits ausgefüllte Felder bleiben, der Rest wird
            gefüllt. Rechtsbündig wie beim Charakter-Formular.
          */}
          <div className="-mb-1 flex justify-end">
            <button
              type="button"
              onClick={() => setRandomOpen(true)}
              disabled={saving}
              title="Das ganze Formular per KI ausfüllen – bereits ausgefüllte Felder bleiben erhalten"
              className="rounded-md border border-black/15 px-3 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
            >
              ✨ Zufälliges Szenario
            </button>
          </div>

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
            generatable={ERZEUGBAR}
            onGenerate={handleGenerate}
            generatingField={generatingField}
            zusatz={zusatz}
            onZusatzChange={(key, value) =>
              setZusatz((z) => ({ ...z, [key]: value }))
            }
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

      {/* Sortieren & Suchen – wie in der Charakterübersicht. Erst ab einem
          Szenario sinnvoll; die Leiste bleibt auch stehen, wenn die Suche
          gerade nichts findet (sonst käme man an das Zurücksetzen nicht heran). */}
      {scenarios.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-foreground/60">Sortieren:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={controlClass}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>

          <div className="relative flex min-w-48 flex-1 items-center">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen …"
              aria-label="Szenarien durchsuchen (Name und Festlegungen)"
              className={`${controlClass} w-full`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Suche zurücksetzen"
                className="absolute right-2 text-foreground/40 transition hover:text-foreground"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {scenarios.length > 0 && visibleScenarios.length === 0 && (
        <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-foreground/60 dark:border-white/15">
          Kein Szenario passt zur Suche.
        </div>
      )}

      {visibleScenarios.length > 0 && (
        <ul className="flex flex-col gap-3">
          {visibleScenarios.map((s) => {
            const zeile = summary(s.details);
            return (
              <li key={s.id}>
                <Link
                  href={`/scenarios/${s.id}`}
                  className="flex items-center gap-4 rounded-xl border border-black/10 bg-white p-4 transition hover:shadow-md dark:border-white/10 dark:bg-white/[0.03]"
                >
                  {s.thumbnail && (
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-black/[0.03] dark:bg-white/[0.03]">
                      <Image
                        src={s.thumbnail}
                        alt=""
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
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

      {randomOpen && (
        <RandomScenarioModal
          currentName={name}
          currentDetails={details}
          onFilled={applyRandom}
          onClose={() => setRandomOpen(false)}
        />
      )}
    </div>
  );
}
