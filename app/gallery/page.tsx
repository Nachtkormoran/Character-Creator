"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  createGroup,
  deleteCharacter,
  deleteGroup,
  generateImage,
  listCharacters,
  listGroups,
  updateCharacterGroup,
  updateCharacterImage,
  updateCharacterName,
} from "@/lib/client";
import { fileToDataUrl } from "@/lib/image";
import { DEFAULT_IMAGE_STYLE, IMAGE_STYLES } from "@/lib/schema";
import type { StoredCharacter, StoredGroup } from "@/lib/serialize";
import { TraitsTable } from "../components/TraitsTable";

const controlClass =
  "rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40";

export default function GalleryPage() {
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
  const [groups, setGroups] = useState<StoredGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoredCharacter | null>(null);

  // Filter: "all" | "none" | groupId
  const [filter, setFilter] = useState<string>("all");
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

  const visibleCharacters = characters.filter((c) => {
    if (filter === "all") return true;
    if (filter === "none") return c.groupId === null;
    return c.groupId === filter;
  });

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

  async function handleRename(id: string, name: string) {
    const updated = await updateCharacterName(id, name);
    setCharacters((cs) => cs.map((x) => (x.id === id ? updated : x)));
    setSelected((s) => (s && s.id === id ? updated : s));
  }

  async function handlePersistImage(id: string, imageData: string) {
    const updated = await updateCharacterImage(id, imageData);
    setCharacters((cs) => cs.map((x) => (x.id === id ? updated : x)));
    setSelected((s) => (s && s.id === id ? updated : s));
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">Galerie</h1>
        <Link
          href="/"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
        >
          + Neuer Charakter
        </Link>
      </div>

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

        {filter !== "all" && filter !== "none" && (
          <button
            type="button"
            onClick={() => handleDeleteGroup(filter)}
            className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
          >
            Gruppe löschen
          </button>
        )}

        <form onSubmit={handleCreateGroup} className="ml-auto flex items-center gap-2">
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Neue Gruppe …"
            maxLength={80}
            className={`${controlClass} w-40`}
          />
          <button
            type="submit"
            disabled={creatingGroup || !newGroupName.trim()}
            className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
          >
            {creatingGroup ? "…" : "Anlegen"}
          </button>
        </form>
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
          Keine Charaktere in dieser Auswahl.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {visibleCharacters.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c)}
            className="group flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white text-left transition hover:shadow-md dark:border-white/10 dark:bg-white/[0.03]"
          >
            <div className="relative aspect-square w-full bg-black/[0.03] dark:bg-white/[0.03]">
              {c.imageData ? (
                <Image
                  src={c.imageData}
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
        ))}
      </div>

      {selected && (
        <DetailModal
          character={selected}
          groups={groups}
          onClose={() => setSelected(null)}
          onDelete={() => handleDelete(selected.id)}
          onRename={(name) => handleRename(selected.id, name)}
          onPersistImage={(imageData) =>
            handlePersistImage(selected.id, imageData)
          }
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
  onRename,
  onPersistImage,
  onAssignGroup,
}: {
  character: StoredCharacter;
  groups: StoredGroup[];
  onClose: () => void;
  onDelete: () => void;
  onRename: (name: string) => Promise<void>;
  onPersistImage: (imageData: string) => Promise<void>;
  onAssignGroup: (groupId: string | null) => Promise<void>;
}) {
  const [name, setName] = useState(c.character.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [imageStyle, setImageStyle] = useState<string>(
    c.input.imageStyle || DEFAULT_IMAGE_STYLE,
  );
  const [includeTraits, setIncludeTraits] = useState(true);
  const [includeTextDetails, setIncludeTextDetails] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const [assigningGroup, setAssigningGroup] = useState(false);

  async function assignGroup(groupId: string | null) {
    setAssigningGroup(true);
    try {
      await onAssignGroup(groupId);
    } finally {
      setAssigningGroup(false);
    }
  }

  const trimmed = name.trim();
  const nameChanged = trimmed.length > 0 && trimmed !== c.character.name;

  async function saveName() {
    if (!nameChanged || savingName) return;
    setSavingName(true);
    setNameError(null);
    try {
      await onRename(trimmed);
    } catch (e) {
      setNameError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setSavingName(false);
    }
  }

  async function regenerateImage() {
    if (imageLoading) return;
    setImageLoading(true);
    setImageError(null);
    try {
      const { imageData } = await generateImage(c.character, imageStyle, {
        includeTraits,
        includeTextDetails,
        extraPrompt,
      });
      await onPersistImage(imageData);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setImageLoading(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || imageLoading) return;
    setImageLoading(true);
    setImageError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      await onPersistImage(dataUrl);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Fehler beim Upload.");
    } finally {
      setImageLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-3xl rounded-xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                }}
                aria-label="Name des Charakters"
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 -mx-2 text-2xl font-semibold outline-none transition hover:border-black/15 focus:border-black/40 dark:hover:border-white/15 dark:focus:border-white/40"
              />
              {nameChanged && (
                <button
                  onClick={saveName}
                  disabled={savingName}
                  className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                >
                  {savingName ? "…" : "Speichern"}
                </button>
              )}
            </div>
            {nameError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {nameError}
              </p>
            )}
            <p className="mt-1 text-foreground/70 italic">
              {c.character.kurzbeschreibung}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-foreground/60 transition hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="mb-6">
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-foreground/60 uppercase">
            Merkmale
          </h3>
          <TraitsTable traits={c.character.merkmale} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
          <div className="order-2 md:order-1">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-wide text-foreground/60 uppercase">
                Beschreibung
              </h3>
              <span className="text-xs text-foreground/50">
                {c.character.beschreibung.length.toLocaleString("de-DE")} Zeichen
              </span>
            </div>
            <div className="leading-relaxed whitespace-pre-line text-[15px]">
              {c.character.beschreibung}
            </div>
          </div>
          <div className="order-1 md:order-2">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03]">
              {c.imageData ? (
                <Image
                  src={c.imageData}
                  alt={c.character.name}
                  fill
                  sizes="240px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center p-4 text-center text-sm text-foreground/40">
                  {imageLoading ? "Bild wird erzeugt …" : "Kein Bild"}
                </div>
              )}
            </div>

            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground/60">
                Zusätzliche Bild-Details (optional)
              </span>
              <textarea
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                disabled={imageLoading}
                rows={2}
                maxLength={1000}
                placeholder="Zusätzlich fürs Bild berücksichtigen – z. B. Attribute, die nicht in der Tabelle oder Beschreibung stehen (Kleidung, Pose, Requisiten, Hintergrund …)"
                className="w-full resize-y rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
              />
            </label>

            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground/60">
                Bild-Stil
              </span>
              <select
                value={imageStyle}
                onChange={(e) => setImageStyle(e.target.value)}
                disabled={imageLoading}
                className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
              >
                {IMAGE_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 flex flex-col gap-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeTraits}
                  onChange={(e) => setIncludeTraits(e.target.checked)}
                  disabled={imageLoading}
                  className="mt-0.5"
                />
                <span>Merkmalstabelle einbeziehen (inkl. Persönlichkeit)</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeTextDetails}
                  onChange={(e) => setIncludeTextDetails(e.target.checked)}
                  disabled={imageLoading}
                  className="mt-0.5"
                />
                <span>Visuelle Details aus Fließtext miteinbeziehen</span>
              </label>
            </div>

            <button
              type="button"
              onClick={regenerateImage}
              disabled={imageLoading}
              className="mt-3 w-full rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
            >
              {imageLoading
                ? "Erzeuge …"
                : c.imageData
                  ? "Neues Bild erzeugen"
                  : "Bild erzeugen"}
            </button>

            <label
              className={`mt-2 block w-full cursor-pointer rounded-md border border-black/15 px-4 py-2 text-center text-sm font-medium transition hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06] ${
                imageLoading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Bild hochladen
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
                disabled={imageLoading}
              />
            </label>
            {imageError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                {imageError}
              </p>
            )}
          </div>
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
              onClick={onDelete}
              className="rounded-md border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
            >
              Löschen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
