"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  buildCharacterFile,
  createGroup,
  deleteCharacter,
  deleteGroup,
  generateName,
  generateStoryHooks,
  getImage,
  importCharacterFile,
  listCharacters,
  listGroups,
  regenerateDescription,
  updateCharacterContent,
  updateCharacterGroup,
} from "@/lib/client";
import { characterFileName } from "@/lib/characterFile";
import { downloadBlob, safeFileName } from "@/lib/download";
import { randomName } from "@/lib/names";
import {
  DEFAULT_STORY_HOOK_ANCHOR,
  STORY_HOOK_ANCHORS,
  withTrait,
  type CharacterTraits,
  type GeneratedCharacter,
  type StoryHookAnchor,
} from "@/lib/schema";
import {
  primaryImage,
  type StoredCharacter,
  type StoredGroup,
} from "@/lib/serialize";
import { AutoTextarea } from "../components/AutoTextarea";
import { CharacterImagesModal } from "../components/CharacterImagesModal";
import { ImageLightbox } from "../components/ImageLightbox";
import { TraitsTable } from "../components/TraitsTable";
import { CharacterInputModal } from "../components/CharacterInputModal";

const controlClass =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40";

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
  const [groups, setGroups] = useState<StoredGroup[]>([]);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoredCharacter | null>(null);

  // Filter: "all" | "none" | groupId
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listCharacters(), listGroups()])
      .then(([chars, grps]) => {
        setCharacters(chars);
        setGroups(grps);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler."))
      .finally(() => setLoading(false));
  }, []);

  // Charakter-Anzahl je Gruppe (clientseitig, immer aktuell)
  const groupCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of characters) if (c.groupId) m[c.groupId] = (m[c.groupId] ?? 0) + 1;
    return m;
  }, [characters]);
  const noneCount = characters.filter((c) => !c.groupId).length;

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
      const inGroup =
        filter === "all"
          ? true
          : filter === "none"
            ? c.groupId === null
            : c.groupId === filter;
      if (!inGroup) return false;
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
  ) {
    const updated = await updateCharacterContent(id, character, storyHooks);
    setCharacters((cs) => cs.map((x) => (x.id === id ? updated : x)));
    setSelected((s) => (s && s.id === id ? updated : s));
  }

  /** Übernimmt einen vom Server zurückgegebenen Stand in beide Zustände. */
  function applyUpdate(updated: StoredCharacter) {
    setCharacters((cs) => cs.map((x) => (x.id === updated.id ? updated : x)));
    setSelected((s) => (s && s.id === updated.id ? updated : s));
  }

  async function handleAssignGroup(id: string, groupId: string | null) {
    const updated = await updateCharacterGroup(id, groupId);
    setCharacters((cs) => cs.map((x) => (x.id === id ? updated : x)));
    setSelected((s) => (s && s.id === id ? updated : s));
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    const name = newGroupName.trim();
    if (!name || creatingGroup) return;
    setCreatingGroup(true);
    setGroupError(null);
    try {
      const group = await createGroup(name);
      setGroups((gs) => [...gs, group].sort((a, b) => a.name.localeCompare(b.name)));
      setNewGroupName("");
      setFilter(group.id);
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : "Fehler.");
    } finally {
      setCreatingGroup(false);
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

  async function handleDeleteGroup(id: string) {
    const group = groups.find((g) => g.id === id);
    if (
      !confirm(
        `Gruppe „${group?.name ?? ""}" löschen? Die zugeordneten Charaktere bleiben erhalten.`,
      )
    )
      return;
    const prevGroups = groups;
    const prevChars = characters;
    setGroups((gs) => gs.filter((g) => g.id !== id));
    // Charaktere dieser Gruppe lokal auf "ohne Gruppe" setzen
    setCharacters((cs) =>
      cs.map((c) => (c.groupId === id ? { ...c, groupId: null } : c)),
    );
    setSelected((s) => (s && s.groupId === id ? { ...s, groupId: null } : s));
    if (filter === id) setFilter("all");
    try {
      await deleteGroup(id);
    } catch {
      setGroups(prevGroups);
      setCharacters(prevChars);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Charaktere</h1>
        <div className="flex flex-wrap items-center gap-3">
          <label
            title="Zuvor exportierte Charakter-Dateien einspielen – sie kommen zum Bestand hinzu"
            className={`rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition dark:border-white/15 ${
              importing
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
            }`}
          >
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
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            + Neuer Charakter
          </Link>
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

      {/* Gruppen-Filter & -Verwaltung */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-white/[0.03]">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-foreground/60">Anzeigen:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className={controlClass}
          >
            <option value="all">Alle Charaktere ({characters.length})</option>
            <option value="none">Ohne Gruppe ({noneCount})</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({groupCounts[g.id] ?? 0})
              </option>
            ))}
          </select>
        </label>

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

        {/*
          Die Suche füllt den Rest der Zeile und gibt bei Platzmangel als erste
          nach (`flex-1` statt fester Breite). Mit `w-64` rutschte die
          Gruppen-Anlage schon auf eine zweite Zeile, obwohl rechts noch Platz
          war – die feste Breite gab ihn nicht her.
        */}
        <div className="relative flex min-w-48 flex-1 items-center">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Kurz halten: das Feld schrumpft mit, ein langer Platzhalter
            // würde abgeschnitten. Der volle Umfang steht im aria-label.
            placeholder="Suchen …"
            aria-label="Charaktere durchsuchen (Name, Text, Merkmale)"
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

        {/*
          Die beiden Gruppen-Bedienelemente bleiben als Block zusammen. Sobald
          der Löschen-Knopf dazukommt, passen fünf Elemente nicht mehr in die
          Zeile (der Rahmen ist `max-w-5xl`); dann rutscht der ganze Block nach
          unten statt nur das Eingabefeld. Kein `ml-auto` nötig – die Suche
          schiebt ihn nach rechts.
        */}
        <div className="flex shrink-0 items-center gap-2">
          {filter !== "all" && filter !== "none" && (
            <button
              type="button"
              onClick={() => handleDeleteGroup(filter)}
              className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
            >
              Gruppe löschen
            </button>
          )}

          <form onSubmit={handleCreateGroup} className="flex items-center gap-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Neue Gruppe …"
              maxLength={80}
              className={`${controlClass} w-36`}
            />
            <button
              type="submit"
              disabled={creatingGroup || !newGroupName.trim()}
              className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {creatingGroup ? "…" : "Anlegen"}
            </button>
          </form>
        </div>
        {groupError && (
          <span className="w-full text-xs text-red-600 dark:text-red-400">
            {groupError}
          </span>
        )}
      </div>

      {loading && <p className="text-foreground/60">Lade Charaktere …</p>}
      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {!loading && !error && characters.length === 0 && (
        <div className="rounded-xl border border-dashed border-black/15 p-10 text-center text-foreground/60 dark:border-white/15">
          Noch keine Charaktere gespeichert.{" "}
          <Link href="/" className="underline">
            Jetzt einen erstellen
          </Link>
          .
        </div>
      )}

      {!loading && !error && characters.length > 0 && visibleCharacters.length === 0 && (
        <div className="rounded-xl border border-dashed border-black/15 p-10 text-center text-foreground/60 dark:border-white/15">
          {query.trim()
            ? `Keine Treffer für „${query.trim()}" in dieser Auswahl.`
            : "Keine Charaktere in dieser Auswahl."}
        </div>
      )}

      {!loading && !error && query.trim() && visibleCharacters.length > 0 && (
        <p className="text-sm text-foreground/60">
          {`${visibleCharacters.length} Treffer für „${query.trim()}"`}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visibleCharacters.map((c) => {
          // Anzeigequelle ist das Thumbnail des Primärbilds; Originale liefert
          // die Listen-Route bewusst nicht mit (je ~2 MB).
          const preview = primaryImage(c)?.thumbnail;
          return (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="group flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white text-left transition hover:shadow-md dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="relative aspect-square w-full bg-black/[0.03] dark:bg-white/[0.03]">
              {preview ? (
                <Image
                  src={preview}
                  alt={c.character.name}
                  fill
                  sizes="(max-width: 640px) 50vw, 25vw"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl opacity-30">
                  🧑
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 p-3">
              <span className="truncate font-medium">{c.character.name}</span>
              <span className="line-clamp-2 text-xs text-foreground/60">
                {c.character.kurzbeschreibung}
              </span>
            </div>
          </button>
          );
        })}
      </div>

      {selected && (
        <DetailModal
          key={selected.id}
          character={selected}
          groups={groups}
          onClose={() => setSelected(null)}
          onDelete={() => handleDelete(selected.id)}
          onSaveContent={(character, storyHooks) =>
            handleSaveContent(selected.id, character, storyHooks)
          }
          onCharacterUpdated={applyUpdate}
          onAssignGroup={(groupId) => handleAssignGroup(selected.id, groupId)}
        />
      )}
    </div>
  );
}

function DetailModal({
  character: c,
  groups,
  onClose,
  onDelete,
  onSaveContent,
  onCharacterUpdated,
  onAssignGroup,
}: {
  character: StoredCharacter;
  groups: StoredGroup[];
  onClose: () => void;
  onDelete: () => void;
  onSaveContent: (
    character: GeneratedCharacter,
    storyHooks: string,
  ) => Promise<void>;
  onCharacterUpdated: (updated: StoredCharacter) => void;
  onAssignGroup: (groupId: string | null) => Promise<void>;
}) {
  // Editierbare Kopie der Charakter-Inhalte (Name, Kurzbeschreibung, Text,
  // Merkmale). Persistiert erst über "Änderungen speichern".
  const [edited, setEdited] = useState<GeneratedCharacter>(c.character);
  const [savingEdits, setSavingEdits] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  /**
   * Die Ansatzpunkte stehen neben `edited`, nicht darin: sie gehören zum
   * Charakter, sind aber kein Feld von `GeneratedCharacter` – das beschreibt,
   * was das Modell bei der Erstgenerierung liefert, und dazu zählen sie nicht.
   * Sie teilen sich mit `edited` nur den Speichern-Knopf.
   */
  const [hooks, setHooks] = useState(c.storyHooks);
  const [hooksBusy, setHooksBusy] = useState(false);
  const [hooksError, setHooksError] = useState<string | null>(null);
  /**
   * Wie fest die Ansatzpunkte am Charakter hängen sollen. Nur für diese
   * Sitzung – die Stufe beschreibt nichts am Charakter, sondern wie man ihn
   * gerade befragen will, und gehört deshalb nicht in die Datenbank.
   */
  const [anchor, setAnchor] = useState<StoryHookAnchor>(
    DEFAULT_STORY_HOOK_ANCHOR,
  );

  // Text neu erzeugen: Zusatzwunsch (Stil, Perspektive, Schwerpunkt).
  const [rewriteHint, setRewriteHint] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  // Alles rund um Bilder liegt in der eigenen Bilder-Ansicht.
  const [imagesOpen, setImagesOpen] = useState(false);

  // Die ursprünglichen Formular-Vorgaben ebenso – reine Anzeige.
  const [inputOpen, setInputOpen] = useState(false);

  // Das Original des Primärbilds kommt aus keiner Listen-Antwort (nur das
  // Thumbnail) und wird für Vollbild, Bild-Export und PDF nachgeladen.
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const primary = primaryImage(c);
  const primaryId = primary?.id ?? null;

  // Wechselt das Primärbild, ist das zwischengespeicherte Original hinfällig.
  const [cachedFor, setCachedFor] = useState<string | null>(null);
  const cachedImage = cachedFor === primaryId ? fullImage : null;

  async function ensureFullImage(): Promise<string | null> {
    if (!primaryId) return null;
    if (cachedImage) return cachedImage;
    setLoadingFull(true);
    try {
      const full = await getImage(c.id, primaryId);
      setFullImage(full);
      setCachedFor(primaryId);
      return full;
    } finally {
      setLoadingFull(false);
    }
  }

  async function openLightbox() {
    const full = await ensureFullImage();
    if (full) setLightboxOpen(true);
  }

  // Anzeigequelle ist das Thumbnail des Primärbilds; der Rückfall auf das
  // Original greift nur, wenn ein Bild ohne Thumbnail gespeichert wurde.
  const preview = primary?.thumbnail ?? cachedImage;
  const [assigningGroup, setAssigningGroup] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [namingAI, setNamingAI] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  /**
   * Nachträglich einen neuen Namen würfeln. Grundlage sind die **Merkmale**
   * des fertigen Charakters (Geschlecht, Herkunft) – sie sind konkreter als
   * die ursprünglichen Formular-Vorgaben. Eine Genre-Id gibt es hier nicht
   * mehr, deshalb dient das gespeicherte Setting als Notnagel.
   */
  function rollName() {
    setNameError(null);
    setField(
      "name",
      randomName({
        gender: edited.merkmale.geschlecht,
        herkunft: edited.merkmale.herkunft,
        setting: c.input.setting,
      }),
    );
  }

  /** Namensvorschlag der KI, unter Einbeziehung der Merkmalstabelle. */
  async function suggestName() {
    if (namingAI) return;
    setNamingAI(true);
    setNameError(null);
    try {
      const { name } = await generateName(c.input, edited.merkmale);
      setField("name", name);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setNamingAI(false);
    }
  }

  /**
   * Den Beschreibungstext neu erzeugen – aus den ursprünglichen Vorgaben plus
   * dem Zusatzwunsch. Der neue Text landet als **ungespeicherte Änderung** im
   * Bearbeitungs-Zustand: er ist nicht zwangsläufig besser als der alte, und
   * über „Verwerfen" kommt der alte zurück, solange nicht gespeichert wurde.
   *
   * Grundlage sind die **bearbeiteten** Merkmale (`edited`), nicht die
   * gespeicherten: wer gerade den Beruf geändert hat und dann den Text neu
   * erzeugt, meint den neuen Beruf.
   */
  async function rewriteDescription() {
    if (rewriting) return;
    setRewriting(true);
    setRewriteError(null);
    try {
      const { beschreibung } = await regenerateDescription(
        c.input,
        edited,
        rewriteHint,
      );
      setField("beschreibung", beschreibung);
    } catch (e) {
      setRewriteError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setRewriting(false);
    }
  }

  /**
   * Drei Ansatzpunkte für eine Geschichte ableiten. Ebenfalls erst einmal nur
   * eine ungespeicherte Änderung – und ein zweiter Klick überschreibt, was im
   * Feld steht. Deshalb die Rückfrage, sobald dort schon etwas steht: von Hand
   * ergänzte Notizen wären sonst still weg.
   */
  async function deriveHooks() {
    if (hooksBusy) return;
    if (
      hooks.trim() &&
      !confirm("Die vorhandenen Ansatzpunkte werden ersetzt. Fortfahren?")
    )
      return;
    setHooksBusy(true);
    setHooksError(null);
    try {
      const { ansatzpunkte } = await generateStoryHooks(edited, anchor);
      setHooks(ansatzpunkte);
    } catch (e) {
      setHooksError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setHooksBusy(false);
    }
  }

  /**
   * Charakter als Datei sichern – Texte, Merkmale, Vorgaben und alle Bilder in
   * Originalgröße. Grundlage sind die **bearbeiteten** Werte (`edited`), damit
   * ungespeicherte Änderungen nicht stillschweigend aus der Datei fallen.
   */
  async function exportJson() {
    if (exportingJson) return;
    setExportingJson(true);
    setExportError(null);
    try {
      const datei = await buildCharacterFile(c, edited, hooks);
      const blob = new Blob([JSON.stringify(datei, null, 2)], {
        type: "application/json",
      });
      downloadBlob(blob, characterFileName(safeFileName(edited.name)));
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export fehlgeschlagen.");
    } finally {
      setExportingJson(false);
    }
  }

  async function exportPdf() {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const { renderCharacterPdfBlob } = await import(
        "../components/CharacterPdf"
      );
      const groupName = groups.find((g) => g.id === c.groupId)?.name ?? null;
      const imageData = await ensureFullImage();
      const blob = await renderCharacterPdfBlob({
        name: edited.name,
        kurzbeschreibung: edited.kurzbeschreibung,
        beschreibung: edited.beschreibung,
        merkmale: edited.merkmale,
        imageData,
        groupName,
        createdAt: c.createdAt,
      });
      downloadBlob(blob, `${safeFileName(edited.name)}.pdf`);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export fehlgeschlagen.");
    } finally {
      setExporting(false);
    }
  }

  const setField = <K extends keyof GeneratedCharacter>(
    key: K,
    value: GeneratedCharacter[K],
  ) => setEdited((e) => ({ ...e, [key]: value }));

  const setTrait = (key: keyof CharacterTraits, value: string) =>
    setEdited((e) => ({ ...e, merkmale: withTrait(e.merkmale, key, value) }));

  const dirty =
    JSON.stringify(edited) !== JSON.stringify(c.character) ||
    hooks !== c.storyHooks;
  const nameValid = edited.name.trim().length > 0;

  async function saveEdits() {
    if (!dirty || !nameValid || savingEdits) return;
    setSavingEdits(true);
    setEditError(null);
    const payload = { ...edited, name: edited.name.trim() };
    try {
      await onSaveContent(payload, hooks);
      setEdited(payload);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setSavingEdits(false);
    }
  }

  async function assignGroup(groupId: string | null) {
    setAssigningGroup(true);
    try {
      await onAssignGroup(groupId);
    } finally {
      setAssigningGroup(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-5xl rounded-xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={edited.name}
                onChange={(e) => setField("name", e.target.value)}
                aria-label="Name des Charakters"
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 -mx-2 text-2xl font-semibold outline-none transition hover:border-black/15 focus:border-black/40 dark:hover:border-white/15 dark:focus:border-white/40"
              />
              <button
                type="button"
                onClick={rollName}
                title="Zufallsname passend zu Geschlecht und Herkunft aus der Merkmalstabelle – sofort und ohne KI"
                className="shrink-0 rounded-md border border-black/15 px-2.5 py-1 text-xs font-medium transition hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06]"
              >
                🎲 Würfeln
              </button>
              <button
                type="button"
                onClick={suggestName}
                disabled={namingAI}
                title="Namensvorschlag der KI auf Basis der Merkmalstabelle"
                className="shrink-0 rounded-md border border-black/15 px-2.5 py-1 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
              >
                {namingAI ? "Denkt nach …" : "✨ Zu den Merkmalen"}
              </button>
            </div>
            {nameError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {nameError}
              </p>
            )}
            <AutoTextarea
              value={edited.kurzbeschreibung}
              onChange={(value) => setField("kurzbeschreibung", value)}
              ariaLabel="Kurzbeschreibung"
              placeholder="Kurzbeschreibung"
              className="mt-1 text-foreground/70 italic"
            />
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-foreground/60 transition hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {/* Änderungen speichern (erscheint bei Änderungen) */}
        {dirty && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <span className="text-sm text-amber-800 dark:text-amber-300">
              Ungespeicherte Änderungen
            </span>
            <button
              onClick={saveEdits}
              disabled={savingEdits || !nameValid}
              className="ml-auto rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {savingEdits ? "Speichere …" : "Änderungen speichern"}
            </button>
            <button
              onClick={() => {
                setEdited(c.character);
                setHooks(c.storyHooks);
              }}
              disabled={savingEdits}
              className="text-sm text-foreground/60 transition hover:text-foreground disabled:opacity-50"
            >
              Verwerfen
            </button>
            {editError && (
              <span className="w-full text-xs text-red-600 dark:text-red-400">
                {editError}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
          <div className="order-2 md:order-1">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-wide text-foreground/60 uppercase">
                Beschreibung
              </h3>
              <span className="text-xs text-foreground/50">
                {edited.beschreibung.length.toLocaleString("de-DE")} Zeichen
              </span>
            </div>
            <AutoTextarea
              value={edited.beschreibung}
              onChange={(value) => setField("beschreibung", value)}
              ariaLabel="Beschreibung"
              className="text-[15px]"
            />

            {/*
              Text neu erzeugen. Steht unter dem Textfeld, nicht darüber: es ist
              der Griff zum vorhandenen Text, keine Überschrift.
            */}
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-black/10 bg-black/[0.02] p-2 dark:border-white/10 dark:bg-white/[0.03]">
              <input
                value={rewriteHint}
                onChange={(e) => setRewriteHint(e.target.value)}
                maxLength={1000}
                placeholder="Zusätzliche Wünsche – z. B. nüchterner Stil, mehr über die Kindheit …"
                aria-label="Zusätzliche Wünsche für den neuen Text"
                className="min-w-40 flex-1 rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-black/40 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
              />
              <button
                type="button"
                onClick={rewriteDescription}
                disabled={rewriting}
                title="Erzeugt den Beschreibungstext neu – aus den ursprünglichen Vorgaben und der Merkmalstabelle. Name und Merkmale bleiben unverändert."
                className="shrink-0 rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
              >
                {rewriting ? "Schreibt …" : "✨ Text neu erzeugen"}
              </button>
              {rewriteError ? (
                <p className="w-full text-xs text-red-600 dark:text-red-400">
                  {rewriteError}
                </p>
              ) : (
                <p className="w-full text-xs text-foreground/50">
                  Ersetzt den Text oben. Bis zum Speichern lässt er sich
                  verwerfen.
                </p>
              )}
            </div>
          </div>
          <div className="order-1 md:order-2">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03]">
              {preview ? (
                <button
                  type="button"
                  onClick={openLightbox}
                  disabled={loadingFull}
                  aria-label="Bild in voller Größe anzeigen"
                  className="group absolute inset-0 cursor-zoom-in"
                >
                  <Image
                    src={preview}
                    alt={c.character.name}
                    fill
                    sizes="240px"
                    className="object-cover transition group-hover:opacity-90"
                    unoptimized
                  />
                </button>
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-center text-sm text-foreground/40">
                  Kein Bild
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setImagesOpen(true)}
              className="mt-3 w-full rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06]"
            >
              {c.images.length > 0
                ? `Bilder verwalten (${c.images.length})`
                : "Bild erzeugen …"}
            </button>
            <p className="mt-1.5 text-xs text-foreground/50">
              Weitere Bilder erzeugen, hochladen und das primäre wählen.
            </p>

          </div>
        </div>

        {/*
          Ansatzpunkte für eine Geschichte. Über die volle Breite und nicht in
          der Beschreibungs-Spalte: es sind drei Absätze Fließtext, und neben
          dem Bild stünde jeder davon als schmale Säule.
        */}
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-foreground/60 uppercase">
              Ansatzpunkte für eine Geschichte
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs">
                <span className="text-foreground/60">Bindung:</span>
                <select
                  value={anchor}
                  onChange={(e) =>
                    setAnchor(e.target.value as StoryHookAnchor)
                  }
                  title={
                    STORY_HOOK_ANCHORS.find((a) => a.value === anchor)?.hint
                  }
                  className="rounded-md border border-black/15 bg-white px-2 py-1 text-xs outline-none transition focus:border-black/40 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
                >
                  {STORY_HOOK_ANCHORS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={deriveHooks}
                disabled={hooksBusy}
                title="Leitet aus Beschreibung und Merkmalen drei Ausgangslagen für eine Geschichte ab"
                className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
              >
                {hooksBusy
                  ? "Denkt nach …"
                  : hooks.trim()
                    ? "✨ Neu ableiten"
                    : "✨ Ableiten"}
              </button>
            </div>
          </div>
          {/* Der Hinweis erklärt die Stufe, ohne dass man das Menü aufklappen muss. */}
          <p className="mb-2 text-xs text-foreground/50">
            {STORY_HOOK_ANCHORS.find((a) => a.value === anchor)?.hint}
          </p>
          <div className="rounded-md border border-black/10 bg-black/[0.02] px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
            <AutoTextarea
              value={hooks}
              onChange={setHooks}
              ariaLabel="Ansatzpunkte für eine Geschichte"
              placeholder="Noch keine Ansatzpunkte – der Knopf oben schlägt drei vor. Der Text lässt sich anschließend frei bearbeiten."
              className="text-sm"
            />
          </div>
          {hooksError && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              {hooksError}
            </p>
          )}
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-foreground/60 uppercase">
            Merkmale
          </h3>
          <TraitsTable traits={edited.merkmale} onChange={setTrait} compact />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4 dark:border-white/10">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-foreground/60">Gruppe:</span>
            <select
              value={c.groupId ?? ""}
              onChange={(e) => assignGroup(e.target.value || null)}
              disabled={assigningGroup}
              className="rounded-md border border-black/15 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
            >
              <option value="">— keine —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <span className="text-xs text-foreground/50">
              {new Date(c.createdAt).toLocaleDateString("de-DE")}
            </span>
            <button
              onClick={() => setInputOpen(true)}
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06]"
            >
              Vorgaben anzeigen
            </button>
            <button
              onClick={exportPdf}
              disabled={exporting}
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
            >
              {exporting ? "Erstelle PDF …" : "Als PDF exportieren"}
            </button>
            <button
              onClick={exportJson}
              disabled={exportingJson}
              title="Charakter samt Bildern als Datei – lässt sich anderswo wieder importieren"
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
            >
              {exportingJson ? "Sammle Bilder …" : "Als Datei exportieren"}
            </button>
            <button
              onClick={onDelete}
              className="rounded-md border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
            >
              Löschen
            </button>
          </div>
          {exportError && (
            <span className="w-full text-right text-xs text-red-600 dark:text-red-400">
              {exportError}
            </span>
          )}
        </div>
      </div>

      {imagesOpen && (
        <CharacterImagesModal
          character={c}
          edited={edited}
          onChange={onCharacterUpdated}
          onClose={() => setImagesOpen(false)}
        />
      )}

      {inputOpen && (
        <CharacterInputModal
          input={c.input ?? {}}
          name={c.character.name}
          onClose={() => setInputOpen(false)}
        />
      )}

      {lightboxOpen && cachedImage && (
        <ImageLightbox
          src={cachedImage}
          alt={c.character.name}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
