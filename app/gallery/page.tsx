"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  createScenario,
  deleteCharacter,
  deleteScenario,
  importCharacterFile,
  listCharacters,
  listScenarios,
  updateCharacterContent,
  updateCharacterScenario,
} from "@/lib/client";
import { type GeneratedCharacter } from "@/lib/schema";
import {
  primaryImage,
  type StoredCharacter,
  type StoredScenario,
} from "@/lib/serialize";
import { CharacterDetailModal } from "../components/CharacterDetailModal";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { CharacterCardSkeleton } from "../components/ui/Skeleton";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from "../components/ui/icons";

/** Token-getriebene Basisklasse für Selects/Inputs in der Filterleiste. */
const controlClass =
  "rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50 disabled:opacity-50";

type SortKey = "newest" | "oldest" | "name-asc" | "name-desc";

const SORT_LABELS: Record<SortKey, string> = {
  newest: "Neueste zuerst",
  oldest: "Älteste zuerst",
  "name-asc": "Name A–Z",
  "name-desc": "Name Z–A",
};

/**
 * Kleinschreibung ohne Diakritika, damit „muller" auch „Müller" findet,
 * „grosse" auch „große" und „osullivan" auch „O'Sullivan".
 */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/['’‘´`]/g, "")
    .toLowerCase();
}

/** Durchsuchbarer Text eines Charakters: Name, beide Texte und alle Merkmale. */
function searchableText(c: StoredCharacter): string {
  const { name, kurzbeschreibung, beschreibung, merkmale } = c.character;
  return normalize(
    [
      name,
      kurzbeschreibung,
      beschreibung,
      ...Object.values(merkmale).map(String),
    ].join(" "),
  );
}

export default function GalleryPage() {
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
  const [scenarios, setScenarios] = useState<StoredScenario[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoredCharacter | null>(null);

  // Filter: "all" | "none" | scenarioId
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [newScenarioName, setNewScenarioName] = useState("");
  const [creatingScenario, setCreatingScenario] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCharacters(), listScenarios()])
      .then(([chars, grps]) => {
        setCharacters(chars);
        setScenarios(grps);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler."))
      .finally(() => setLoading(false));
  }, []);

  // Charakter-Anzahl je Szenario (clientseitig, immer aktuell)
  const scenarioCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of characters)
      if (c.scenarioId) m[c.scenarioId] = (m[c.scenarioId] ?? 0) + 1;
    return m;
  }, [characters]);
  const noneCount = characters.filter((c) => !c.scenarioId).length;

  // Suchtext je Charakter einmal vorberechnen – die Beschreibungen sind lang.
  const searchIndex = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of characters) m.set(c.id, searchableText(c));
    return m;
  }, [characters]);

  const visibleCharacters = useMemo(() => {
    // Mehrere Suchbegriffe werden UND-verknüpft.
    const terms = normalize(query).split(/\s+/).filter(Boolean);

    const matching = characters.filter((c) => {
      const inScenario =
        filter === "all"
          ? true
          : filter === "none"
            ? c.scenarioId === null
            : c.scenarioId === filter;
      if (!inScenario) return false;
      if (terms.length === 0) return true;
      const haystack = searchIndex.get(c.id) ?? "";
      return terms.every((t) => haystack.includes(t));
    });

    return matching.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return a.createdAt.localeCompare(b.createdAt);
        case "name-asc":
          return a.character.name.localeCompare(b.character.name, "de");
        case "name-desc":
          return b.character.name.localeCompare(a.character.name, "de");
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [characters, filter, query, sort, searchIndex]);

  async function handleDelete(id: string) {
    if (!confirm("Diesen Charakter wirklich löschen?")) return;
    const prev = characters;
    setCharacters((c) => c.filter((x) => x.id !== id));
    if (selected?.id === id) setSelected(null);
    try {
      await deleteCharacter(id);
    } catch {
      setCharacters(prev); // Rollback bei Fehler
    }
  }

  async function handleSaveContent(
    id: string,
    character: GeneratedCharacter,
    storyHooks: string,
    genre: string,
  ) {
    const updated = await updateCharacterContent(
      id,
      character,
      storyHooks,
      genre,
    );
    setCharacters((cs) => cs.map((x) => (x.id === id ? updated : x)));
    setSelected((s) => (s && s.id === id ? updated : s));
  }

  /** Übernimmt einen vom Server zurückgegebenen Stand in beide Zustände. */
  function applyUpdate(updated: StoredCharacter) {
    setCharacters((cs) => cs.map((x) => (x.id === updated.id ? updated : x)));
    setSelected((s) => (s && s.id === updated.id ? updated : s));
  }

  async function handleAssignScenario(id: string, scenarioId: string | null) {
    const updated = await updateCharacterScenario(id, scenarioId);
    setCharacters((cs) => cs.map((x) => (x.id === id ? updated : x)));
    setSelected((s) => (s && s.id === id ? updated : s));
  }

  async function handleCreateScenario(e: React.FormEvent) {
    e.preventDefault();
    const name = newScenarioName.trim();
    if (!name || creatingScenario) return;
    setCreatingScenario(true);
    setScenarioError(null);
    try {
      const scenario = await createScenario(name);
      setScenarios((gs) =>
        [...gs, scenario].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setNewScenarioName("");
      setFilter(scenario.id);
    } catch (err) {
      setScenarioError(err instanceof Error ? err.message : "Fehler.");
    } finally {
      setCreatingScenario(false);
    }
  }

  /**
   * Exportdateien einspielen. Mehrere Dateien laufen **nacheinander** durch,
   * nicht parallel: jede trägt ihre Bilder als base64 mit, und ein Schwung
   * gleichzeitiger Mehr-Megabyte-Anfragen bringt nichts als Spitzenlast.
   *
   * Eine fehlerhafte Datei bricht den Rest nicht ab – am Ende steht, was
   * angekommen ist und was nicht.
   */
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    // Zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
    e.target.value = "";
    if (files.length === 0) return;

    setImporting(true);
    setImportMessage(null);
    setImportError(null);

    const neue: StoredCharacter[] = [];
    const fehler: string[] = [];
    for (const file of files) {
      try {
        const { character } = await importCharacterFile(file);
        neue.push(character);
      } catch (err) {
        fehler.push(
          `${file.name}: ${err instanceof Error ? err.message : "Fehler."}`,
        );
      }
    }

    if (neue.length > 0) {
      setCharacters((cs) => [...neue, ...cs]);
      setImportMessage(
        neue.length === 1
          ? `„${neue[0].character.name}" importiert.`
          : `${neue.length} Charaktere importiert: ${neue.map((c) => c.character.name).join(", ")}.`,
      );
    }
    if (fehler.length > 0) setImportError(fehler.join(" · "));
    setImporting(false);
  }

  async function handleDeleteScenario(id: string) {
    const scenario = scenarios.find((g) => g.id === id);
    if (
      !confirm(
        `Szenario „${scenario?.name ?? ""}" löschen? Die zugeordneten Charaktere bleiben erhalten.`,
      )
    )
      return;
    const prevScenarios = scenarios;
    const prevChars = characters;
    setScenarios((gs) => gs.filter((g) => g.id !== id));
    // Charaktere dieser Szenario lokal auf "ohne Szenario" setzen
    setCharacters((cs) =>
      cs.map((c) => (c.scenarioId === id ? { ...c, scenarioId: null } : c)),
    );
    setSelected((s) =>
      s && s.scenarioId === id ? { ...s, scenarioId: null } : s,
    );
    if (filter === id) setFilter("all");
    try {
      await deleteScenario(id);
    } catch {
      setScenarios(prevScenarios);
      setCharacters(prevChars);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Charaktere
        </h1>
        <div className="flex flex-wrap items-center gap-3">
          <label
            title="Zuvor exportierte Charakter-Dateien einspielen – sie kommen zum Bestand hinzu"
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted ${
              importing ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            <Upload size={16} strokeWidth={1.75} aria-hidden="true" />
            {importing ? "Importiere …" : "Charakter importieren"}
            <input
              type="file"
              accept=".json,application/json"
              multiple
              className="hidden"
              disabled={importing}
              onChange={handleImport}
            />
          </label>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
            Neuer Charakter
          </Link>
        </div>
      </div>

      {importMessage && (
        <p className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
          <CheckCircle2 size={16} className="text-primary" aria-hidden="true" />
          {importMessage}
        </p>
      )}
      {importError && (
        <p className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertTriangle size={16} aria-hidden="true" />
          {importError}
        </p>
      )}

      {/* Szenario-Filter & -Verwaltung */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Anzeigen:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={controlClass}
          >
            <option value="all">Alle Charaktere ({characters.length})</option>
            <option value="none">Ohne Szenario ({noneCount})</option>
            {scenarios.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({scenarioCounts[g.id] ?? 0})
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Sortieren:</span>
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

        {/*
          Die Suche füllt den Rest der Zeile und gibt bei Platzmangel als erste
          nach (`flex-1` statt fester Breite).
        */}
        <div className="relative flex min-w-48 flex-1 items-center">
          <Search
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen …"
            aria-label="Charaktere durchsuchen (Name, Text, Merkmale)"
            className={`${controlClass} w-full pl-9`}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Suche zurücksetzen"
              className="absolute right-2 text-muted-foreground transition hover:text-foreground"
            >
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {filter !== "all" && filter !== "none" && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => handleDeleteScenario(filter)}
            >
              <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
              Szenario löschen
            </Button>
          )}

          <form
            onSubmit={handleCreateScenario}
            className="flex items-center gap-2"
          >
            <input
              value={newScenarioName}
              onChange={(e) => setNewScenarioName(e.target.value)}
              placeholder="Neues Szenario …"
              maxLength={80}
              className={`${controlClass} w-36`}
            />
            <Button
              type="submit"
              size="sm"
              disabled={creatingScenario || !newScenarioName.trim()}
            >
              {creatingScenario ? "…" : "Anlegen"}
            </Button>
          </form>
        </div>
        {scenarioError && (
          <span className="w-full text-xs text-destructive">
            {scenarioError}
          </span>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <CharacterCardSkeleton key={i} />
          ))}
        </div>
      )}
      {error && (
        <p className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle size={16} aria-hidden="true" />
          {error}
        </p>
      )}

      {!loading && !error && characters.length === 0 && (
        <EmptyState
          icon={<Users size={40} strokeWidth={1.25} />}
          title="Noch keine Charaktere"
          description="Erschaffe deine erste Figur – Text, Merkmale und Portrait in einem Zug."
          action={
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              Neuer Charakter
            </Link>
          }
        />
      )}

      {!loading &&
        !error &&
        characters.length > 0 &&
        visibleCharacters.length === 0 && (
          <EmptyState
            icon={<Search size={40} strokeWidth={1.25} />}
            title="Keine Treffer"
            description={
              query.trim()
                ? `Für „${query.trim()}" gibt es in dieser Auswahl nichts.`
                : "In dieser Auswahl liegt kein Charakter."
            }
          />
        )}

      {!loading && !error && query.trim() && visibleCharacters.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {`${visibleCharacters.length} Treffer für „${query.trim()}"`}
        </p>
      )}

      {!loading && !error && visibleCharacters.length > 0 && (
        <div className="grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
          {visibleCharacters.map((c, i) => (
            <CharacterTafel
              key={c.id}
              character={c}
              index={i}
              onOpen={() => setSelected(c)}
            />
          ))}
        </div>
      )}

      {selected && (
        <CharacterDetailModal
          key={selected.id}
          character={selected}
          scenarios={scenarios}
          onClose={() => setSelected(null)}
          onDelete={() => handleDelete(selected.id)}
          onSaveContent={(character, storyHooks, genre) =>
            handleSaveContent(selected.id, character, storyHooks, genre)
          }
          onCharacterUpdated={applyUpdate}
          onAssignScenario={(scenarioId) =>
            handleAssignScenario(selected.id, scenarioId)
          }
          onScenarioCreated={(scenario) =>
            setScenarios((gs) =>
              [...gs, scenario].sort((a, b) => a.name.localeCompare(b.name)),
            )
          }
        />
      )}
    </div>
  );
}

/**
 * Signature-Element: die Charakter-„Tafel" – eine Manuskript-/Sammelkarten-
 * Platte. Portrait mit feinem Innen-Passepartout, Name in Fraunces, ein paar
 * Kern-Merkmale als Chips; ruhiger Hover-Lift, gestaffeltes Auftauchen.
 */
function CharacterTafel({
  character: c,
  index,
  onOpen,
}: {
  character: StoredCharacter;
  index: number;
  onOpen: () => void;
}) {
  const preview = primaryImage(c)?.thumbnail;
  const alter = String(c.character.merkmale.alter ?? "").trim();
  const beruf = String(c.character.merkmale.beruf ?? "").trim();

  return (
    <button
      onClick={onOpen}
      // Der Stagger deckelt bei ~12, damit späte Karten nicht spürbar nachhinken.
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      className="cc-reveal group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-md)]"
    >
      <div className="relative aspect-square w-full bg-muted">
        {preview ? (
          <Image
            src={preview}
            alt={c.character.name}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <User size={40} strokeWidth={1.25} aria-hidden="true" />
          </div>
        )}
        {/* Passepartout: feine Innenkante, gibt der Karte den Tafel-Charakter. */}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/10 dark:ring-white/10" />
      </div>
      <div className="flex flex-col gap-1.5 p-3">
        <span className="truncate font-display text-base font-medium">
          {c.character.name}
        </span>
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {c.character.kurzbeschreibung}
        </span>
        {(alter || beruf) && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {alter && alter !== "0" && <Badge tabular>{alter} J.</Badge>}
            {beruf && <Badge className="max-w-full truncate">{beruf}</Badge>}
          </div>
        )}
      </div>
    </button>
  );
}
