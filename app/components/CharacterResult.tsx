"use client";

import { useState } from "react";
import Image from "next/image";
import { fileToDataUrl } from "@/lib/image";
import { IMAGE_STYLES, type GeneratedCharacter } from "@/lib/schema";
import { TraitsTable } from "./TraitsTable";

export function CharacterResult({
  character,
  imageData,
  imageLoading,
  imageError,
  imageStyle,
  onImageStyleChange,
  onSetImage,
  onNameChange,
  includeTraits,
  onIncludeTraitsChange,
  includeTextDetails,
  onIncludeTextDetailsChange,
  onGenerateImage,
  onSave,
  saving,
  saved,
}: {
  character: GeneratedCharacter;
  imageData: string | null;
  imageLoading: boolean;
  imageError: string | null;
  imageStyle: string;
  onImageStyleChange: (value: string) => void;
  onSetImage: (dataUrl: string) => void;
  onNameChange: (value: string) => void;
  includeTraits: boolean;
  onIncludeTraitsChange: (value: boolean) => void;
  includeTextDetails: boolean;
  onIncludeTextDetailsChange: (value: boolean) => void;
  onGenerateImage: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const charCount = character.beschreibung.length;

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erlaubt erneutes Wählen derselben Datei
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      onSetImage(dataUrl);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Fehler beim Upload.");
    } finally {
      setUploading(false);
    }
  }

  const busy = imageLoading || uploading;

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div>
        <input
          value={character.name}
          onChange={(e) => onNameChange(e.target.value)}
          aria-label="Name des Charakters"
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 -mx-2 text-2xl font-semibold outline-none transition hover:border-black/15 focus:border-black/40 dark:hover:border-white/15 dark:focus:border-white/40"
        />
        {character.kurzbeschreibung && (
          <p className="mt-1 text-foreground/70 italic">
            {character.kurzbeschreibung}
          </p>
        )}
      </div>

      {/* Merkmals-Tabelle – über dem Text */}
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-wide text-foreground/60 uppercase">
          Merkmale
        </h3>
        <TraitsTable traits={character.merkmale} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px]">
        {/* Beschreibung */}
        <div className="order-2 md:order-1">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-foreground/60 uppercase">
              Beschreibung
            </h3>
            <span className="text-xs text-foreground/50">
              {charCount.toLocaleString("de-DE")} Zeichen
            </span>
          </div>
          <div className="space-y-3 leading-relaxed whitespace-pre-line text-[15px]">
            {character.beschreibung}
          </div>
        </div>

        {/* Portrait + Stilauswahl */}
        <div className="order-1 md:order-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03]">
            {imageData ? (
              <Image
                src={imageData}
                alt={`Portrait von ${character.name}`}
                fill
                sizes="280px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-foreground/40">
                {imageLoading
                  ? "Portrait wird erzeugt …"
                  : uploading
                    ? "Bild wird geladen …"
                    : "Noch kein Portrait"}
              </div>
            )}
          </div>

          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-foreground/60">
              Bild-Stil
            </span>
            <select
              value={imageStyle}
              onChange={(e) => onImageStyleChange(e.target.value)}
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
                onChange={(e) => onIncludeTraitsChange(e.target.checked)}
                disabled={imageLoading}
                className="mt-0.5"
              />
              <span>Merkmalstabelle einbeziehen (inkl. Persönlichkeit)</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeTextDetails}
                onChange={(e) => onIncludeTextDetailsChange(e.target.checked)}
                disabled={imageLoading}
                className="mt-0.5"
              />
              <span>Visuelle Details aus Fließtext miteinbeziehen</span>
            </label>
          </div>

          <button
            type="button"
            onClick={onGenerateImage}
            disabled={busy}
            className="mt-2 w-full rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
          >
            {imageLoading
              ? "Erzeuge …"
              : imageData
                ? "Neues Portrait erzeugen"
                : "Portrait erzeugen"}
          </button>

          <label
            className={`mt-2 block w-full cursor-pointer rounded-md border border-black/15 px-4 py-2 text-center text-sm font-medium transition hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06] ${
              busy ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {uploading ? "Lade hoch …" : "Bild hochladen"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
              disabled={busy}
            />
          </label>

          {(imageError || uploadError) && (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {imageError || uploadError}
            </p>
          )}
        </div>
      </div>

      {/* Speichern */}
      <div className="flex items-center gap-3 border-t border-black/10 pt-4 dark:border-white/10">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || saved}
          className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {saved ? "Gespeichert ✓" : saving ? "Speichere …" : "Charakter speichern"}
        </button>
        {saved && (
          <span className="text-sm text-foreground/60">
            In der Galerie verfügbar.
          </span>
        )}
      </div>
    </div>
  );
}
