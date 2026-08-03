"use client";

import { useState } from "react";
import Image from "next/image";
import { fileToDataUrl } from "@/lib/image";
import {
  IMAGE_STYLES,
  withTrait,
  type CharacterTraits,
  type GeneratedCharacter,
} from "@/lib/schema";
import type { StoredScenario } from "@/lib/serialize";
import { AutoTextarea } from "./AutoTextarea";
import { ReferenceImagePicker } from "./ReferenceImagePicker";
import { ImageLightbox } from "./ImageLightbox";
import { TraitsTable } from "./TraitsTable";

export function CharacterResult({
  character,
  imageData,
  imageLoading,
  imageError,
  imageStyle,
  onImageStyleChange,
  onSetImage,
  onCharacterChange,
  includeTraits,
  onIncludeTraitsChange,
  includeTextDetails,
  onIncludeTextDetailsChange,
  extraPrompt,
  onExtraPromptChange,
  referenceImage,
  onReferenceImageChange,
  scenarios,
  scenarioId,
  onScenarioChange,
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
  onCharacterChange: (next: GeneratedCharacter) => void;
  includeTraits: boolean;
  onIncludeTraitsChange: (value: boolean) => void;
  includeTextDetails: boolean;
  onIncludeTextDetailsChange: (value: boolean) => void;
  extraPrompt: string;
  onExtraPromptChange: (value: string) => void;
  referenceImage: string | null;
  onReferenceImageChange: (dataUrl: string | null) => void;
  scenarios: StoredScenario[];
  scenarioId: string | null;
  onScenarioChange: (value: string | null) => void;
  onGenerateImage: () => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const charCount = character.beschreibung.length;

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  const setField = <K extends keyof GeneratedCharacter>(
    key: K,
    value: GeneratedCharacter[K],
  ) => onCharacterChange({ ...character, [key]: value });

  const setTrait = (key: keyof CharacterTraits, value: string) =>
    onCharacterChange({
      ...character,
      merkmale: withTrait(character.merkmale, key, value),
    });

  return (
    <div className="flex flex-col gap-6 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div>
        <input
          value={character.name}
          onChange={(e) => setField("name", e.target.value)}
          aria-label="Name des Charakters"
          className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 -mx-2 text-2xl font-semibold outline-none transition hover:border-border focus:border-primary/50"
        />
        <AutoTextarea
          value={character.kurzbeschreibung}
          onChange={(value) => setField("kurzbeschreibung", value)}
          ariaLabel="Kurzbeschreibung"
          placeholder="Kurzbeschreibung"
          className="mt-1 text-muted-foreground italic"
        />
      </div>

      {/* Merkmals-Tabelle – über dem Text, editierbar */}
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Merkmale
        </h3>
        <TraitsTable traits={character.merkmale} onChange={setTrait} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_280px]">
        {/* Beschreibung */}
        <div className="order-2 md:order-1">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Beschreibung
            </h3>
            <span className="text-xs text-muted-foreground">
              {charCount.toLocaleString("de-DE")} Zeichen
            </span>
          </div>
          <AutoTextarea
            value={character.beschreibung}
            onChange={(value) => setField("beschreibung", value)}
            ariaLabel="Beschreibung"
            className="text-[15px]"
          />
        </div>

        {/* Portrait + Stilauswahl */}
        <div className="order-1 md:order-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
            {imageData ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label="Portrait in voller Größe anzeigen"
                className="group absolute inset-0 cursor-zoom-in"
              >
                <Image
                  src={imageData}
                  alt={`Portrait von ${character.name}`}
                  fill
                  sizes="280px"
                  className="object-cover transition group-hover:opacity-90"
                  unoptimized
                />
              </button>
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                {imageLoading
                  ? "Portrait wird erzeugt …"
                  : uploading
                    ? "Bild wird geladen …"
                    : "Noch kein Portrait"}
              </div>
            )}
          </div>

          <ReferenceImagePicker
            value={referenceImage}
            onChange={onReferenceImageChange}
            disabled={busy}
          />

          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Zusätzliche Bild-Details (optional)
            </span>
            <textarea
              value={extraPrompt}
              onChange={(e) => onExtraPromptChange(e.target.value)}
              disabled={busy}
              rows={2}
              maxLength={1000}
              placeholder="Zusätzlich fürs Bild berücksichtigen – z. B. Attribute, die nicht in der Tabelle oder Beschreibung stehen (Kleidung, Pose, Requisiten, Hintergrund …)"
              className="w-full resize-y rounded-md border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
            />
          </label>

          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Bild-Stil
            </span>
            <select
              value={imageStyle}
              onChange={(e) => onImageStyleChange(e.target.value)}
              disabled={imageLoading}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
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
              <span>
                Merkmalstabelle einbeziehen (inkl. Persönlichkeit)
                {referenceImage && includeTraits && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Kann mit der Vorlage kollidieren – bei Widersprüchen
                    (z. B. Haarfarbe) ist das Ergebnis nicht vorhersagbar.
                  </span>
                )}
              </span>
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
            className="mt-2 w-full rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            {imageLoading
              ? "Erzeuge …"
              : imageData
                ? "Neues Portrait erzeugen"
                : "Portrait erzeugen"}
          </button>


          <div className="mt-4 border-t border-border pt-3">
            <span className="text-xs font-medium text-muted-foreground">
              Stattdessen eigenes Bild verwenden
            </span>
          </div>

          <label
            className={`mt-2 block w-full cursor-pointer rounded-md border border-border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted ${
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
            <p className="mt-2 text-xs text-destructive">
              {imageError || uploadError}
            </p>
          )}
        </div>
      </div>

      {/* Speichern */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          type="button"
          onClick={onSave}
          disabled={saving || saved}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {saved ? "Gespeichert ✓" : saving ? "Speichere …" : "Charakter speichern"}
        </button>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Szenario:</span>
          <select
            value={scenarioId ?? ""}
            onChange={(e) => onScenarioChange(e.target.value || null)}
            disabled={saving || saved}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
          >
            <option value="">— keine —</option>
            {scenarios.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        {saved && (
          <span className="text-sm text-muted-foreground">
            {`Unter „Charaktere" verfügbar.`}
          </span>
        )}
      </div>

      {lightboxOpen && imageData && (
        <ImageLightbox
          src={imageData}
          alt={`Portrait von ${character.name}`}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
