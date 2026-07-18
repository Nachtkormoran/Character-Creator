"use client";

import { useEffect, useState } from "react";
import { CharacterForm } from "./components/CharacterForm";
import { CharacterResult } from "./components/CharacterResult";
import {
  generateImage,
  generateText,
  listGroups,
  saveCharacter,
} from "@/lib/client";
import {
  DEFAULT_IMAGE_STYLE,
  type CharacterInput,
  type GeneratedCharacter,
} from "@/lib/schema";
import type { StoredGroup } from "@/lib/serialize";

export default function Home() {
  // Ansicht: Eingabeformular oder Ergebnis
  const [view, setView] = useState<"form" | "result">("form");

  const [input, setInput] = useState<CharacterInput | null>(null);
  const [character, setCharacter] = useState<GeneratedCharacter | null>(null);

  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  const [imageData, setImageData] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageStyle, setImageStyle] = useState<string>(DEFAULT_IMAGE_STYLE);
  const [includeTraits, setIncludeTraits] = useState(true);
  const [includeTextDetails, setIncludeTextDetails] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");
  // Vorlage gilt nur für die Sitzung und wird nicht mitgespeichert.
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [groups, setGroups] = useState<StoredGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Gruppen laden, damit man den Charakter direkt beim Erstellen zuordnen kann.
  useEffect(() => {
    listGroups()
      .then(setGroups)
      .catch(() => {});
  }, []);

  async function handleGenerate(formInput: CharacterInput) {
    setTextLoading(true);
    setTextError(null);
    setCharacter(null);
    setImageData(null);
    setImageError(null);
    setSaved(false);
    setInput(formInput);
    setView("result"); // sofort zur Ergebnis-Ansicht wechseln
    try {
      const { character } = await generateText(formInput);
      setCharacter(character);
    } catch (err) {
      setTextError(err instanceof Error ? err.message : "Fehler.");
    } finally {
      setTextLoading(false);
    }
  }

  // Hochgeladenes oder erzeugtes Bild setzen (erneutes Speichern ermöglichen)
  function handleSetImage(dataUrl: string) {
    setImageData(dataUrl);
    setImageError(null);
    setSaved(false);
  }

  // Zurück zum Formular für einen neuen Charakter
  function handleNew() {
    setView("form");
    setCharacter(null);
    setInput(null);
    setImageData(null);
    setImageError(null);
    setTextError(null);
    setSaved(false);
    setSelectedGroupId(null);
    setExtraPrompt("");
  }

  async function handleGenerateImage() {
    if (!character || !input) return;
    setImageLoading(true);
    setImageError(null);
    try {
      const { imageData } = await generateImage(character, imageStyle, {
        includeTraits,
        includeTextDetails,
        extraPrompt,
        referenceImages: referenceImage ? [referenceImage] : [],
      });
      setImageData(imageData);
      setSaved(false);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "Fehler.");
    } finally {
      setImageLoading(false);
    }
  }

  async function handleSave() {
    if (!character || !input) return;
    setSaving(true);
    try {
      await saveCharacter(
        { ...input, imageStyle },
        character,
        imageData,
        selectedGroupId,
      );
      setSaved(true);
    } catch (err) {
      setTextError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  if (view === "form") {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Charakter erstellen
          </h1>
          <p className="mt-2 max-w-2xl text-foreground/70">
            Gib ein paar Vorgaben an – der Rest wird passend ergänzt.
            Anschließend entsteht ein ausführlicher Text, eine Merkmals-Tabelle
            und auf Wunsch ein Portrait.
          </p>
        </div>

        <CharacterForm onGenerate={handleGenerate} loading={textLoading} />
      </div>
    );
  }

  // Ergebnis-Ansicht
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Dein Charakter
        </h1>
        <button
          type="button"
          onClick={handleNew}
          className="shrink-0 rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06]"
        >
          + Neuen Charakter erstellen
        </button>
      </div>

      {textError && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {textError}
        </div>
      )}

      {textLoading && (
        <div className="rounded-xl border border-black/10 bg-white p-6 text-center text-foreground/60 dark:border-white/10 dark:bg-white/[0.03]">
          Der Charakter wird erschaffen … einen Moment.
        </div>
      )}

      {character && (
        <CharacterResult
          character={character}
          imageData={imageData}
          imageLoading={imageLoading}
          imageError={imageError}
          imageStyle={imageStyle}
          onImageStyleChange={setImageStyle}
          onSetImage={handleSetImage}
          onCharacterChange={setCharacter}
          includeTraits={includeTraits}
          onIncludeTraitsChange={setIncludeTraits}
          includeTextDetails={includeTextDetails}
          onIncludeTextDetailsChange={setIncludeTextDetails}
          extraPrompt={extraPrompt}
          onExtraPromptChange={setExtraPrompt}
          referenceImage={referenceImage}
          onReferenceImageChange={setReferenceImage}
          groups={groups}
          groupId={selectedGroupId}
          onGroupChange={setSelectedGroupId}
          onGenerateImage={handleGenerateImage}
          onSave={handleSave}
          saving={saving}
          saved={saved}
        />
      )}
    </div>
  );
}
