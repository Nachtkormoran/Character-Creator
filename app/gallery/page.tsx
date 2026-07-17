"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  deleteCharacter,
  listCharacters,
  updateCharacterName,
} from "@/lib/client";
import type { StoredCharacter } from "@/lib/serialize";
import { TraitsTable } from "../components/TraitsTable";

export default function GalleryPage() {
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoredCharacter | null>(null);

  useEffect(() => {
    listCharacters()
      .then(setCharacters)
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler."))
      .finally(() => setLoading(false));
  }, []);

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {characters.map((c) => (
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
          onClose={() => setSelected(null)}
          onDelete={() => handleDelete(selected.id)}
          onRename={(name) => handleRename(selected.id, name)}
        />
      )}
    </div>
  );
}

function DetailModal({
  character: c,
  onClose,
  onDelete,
  onRename,
}: {
  character: StoredCharacter;
  onClose: () => void;
  onDelete: () => void;
  onRename: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(c.character.name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

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
          {c.imageData && (
            <div className="order-1 md:order-2">
              <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
                <Image
                  src={c.imageData}
                  alt={c.character.name}
                  fill
                  sizes="240px"
                  className="object-cover"
                  unoptimized
                />
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-black/10 pt-4 dark:border-white/10">
          <span className="text-xs text-foreground/50">
            Erstellt am {new Date(c.createdAt).toLocaleString("de-DE")}
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
  );
}
