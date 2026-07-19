"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CharacterForm } from "./components/CharacterForm";
import { CharacterResult } from "./components/CharacterResult";
import {
  generateImage,
  generateText,
  getScenario,
  listScenarios,
  saveCharacter,
} from "@/lib/client";
import {
  DEFAULT_IMAGE_STYLE,
  type CharacterInput,
  type GeneratedCharacter,
} from "@/lib/schema";
import { scenarioToInput, type ScenarioPrefill } from "@/lib/scenarioInput";
import type { StoredScenario } from "@/lib/serialize";

/**
 * `useSearchParams` verlangt eine Suspense-Grenze, sonst fällt die ganze Seite
 * beim Bauen ins clientseitige Rendern. Deshalb der Umweg über diese Hülle.
 */
export default function Page() {
  return (
    <Suspense
      fallback={<p className="text-foreground/60">Einen Moment …</p>}
    >
      <Home />
    </Suspense>
  );
}

function Home() {
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
  /**
   * Name des zuletzt gespeicherten Charakters – die Ergebnis-Ansicht schließt
   * nach dem Speichern, und ohne diese Rückmeldung stünde der Nutzer wortlos
   * wieder vor dem leeren Formular.
   */
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const [scenarios, setScenarios] = useState<StoredScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  // Szenarien laden, damit man den Charakter direkt beim Erstellen zuordnen kann.
  useEffect(() => {
    listScenarios()
      .then(setScenarios)
      .catch(() => {});
  }, []);

  /**
   * „Charakter für dieses Szenario" führt mit `?scenario=<id>` hierher. Das
   * Szenario belegt dann das Formular vor **und** ist als Zuordnung
   * ausgewählt – wer den Weg über den Knopf nimmt, meint genau dieses.
   */
  const scenarioParam = useSearchParams().get("scenario");
  const [prefill, setPrefill] = useState<ScenarioPrefill | null>(null);
  const [prefillName, setPrefillName] = useState<string | null>(null);
  const [prefillError, setPrefillError] = useState<string | null>(null);

  useEffect(() => {
    if (!scenarioParam) return;
    let abgebrochen = false;
    getScenario(scenarioParam)
      .then(({ scenario }) => {
        if (abgebrochen) return;
        setPrefill(scenarioToInput(scenario.name, scenario.details));
        setPrefillName(scenario.name);
        setSelectedScenarioId(scenario.id);
      })
      .catch((e) => {
        if (!abgebrochen)
          setPrefillError(e instanceof Error ? e.message : "Fehler.");
      });
    return () => {
      abgebrochen = true;
    };
  }, [scenarioParam]);

  /**
   * Auf die Vorbelegung warten, statt das Formular leer zu zeigen und
   * nachzuladen: `CharacterForm` liest sie nur beim ersten Rendern, und ein
   * Nachziehen würde Eingaben überschreiben, die in der Zwischenzeit entstanden
   * sind. Bei einem Fehler geht es ohne Vorbelegung weiter – ein unerreichbares
   * Szenario darf das Erstellen nicht blockieren.
   */
  const wartetAufSzenario =
    scenarioParam !== null && prefill === null && prefillError === null;

  async function handleGenerate(formInput: CharacterInput) {
    setTextLoading(true);
    setTextError(null);
    setCharacter(null);
    setImageData(null);
    setImageError(null);
    setSaved(false);
    setSavedNotice(null);
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
    setSavedNotice(null);
    resetToForm();
  }

  /** Ergebnis-Ansicht verlassen und alles Charakterbezogene verwerfen. */
  function resetToForm() {
    setView("form");
    setCharacter(null);
    setInput(null);
    setImageData(null);
    setImageError(null);
    setTextError(null);
    setSaved(false);
    // Kam der Nutzer über ein Szenario, bleibt dessen Zuordnung stehen: nach
    // dem Speichern legt man dort meist die nächste Figur an, und die
    // Auswahl jedes Mal neu zu treffen wäre nur eine Falle.
    setSelectedScenarioId(scenarioParam);
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
        selectedScenarioId,
      );
      setSaved(true);
      // Ansicht schließen: sie bietet sonst weiter einen Speichern-Knopf an,
      // und ein zweiter Klick legt einen zweiten Charakter an statt den
      // vorhandenen zu aktualisieren.
      resetToForm();
      setSavedNotice(character.name);
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

        {savedNotice && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-green-600/30 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-300">
            <span>„{savedNotice}“ wurde gespeichert.</span>
            <Link
              href={
                scenarioParam ? `/scenarios/${scenarioParam}` : "/gallery"
              }
              className="font-medium underline"
            >
              {scenarioParam ? "Zum Szenario" : "In der Galerie ansehen"}
            </Link>
          </div>
        )}

        {prefillName && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-black/10 bg-black/[0.03] px-4 py-3 text-sm dark:border-white/10 dark:bg-white/[0.04]">
            <span>
              Für das Szenario <strong>{prefillName}</strong>. Genre, Ort, Zeit
              und Regeln sind unten übernommen und lassen sich ändern.
            </span>
            <Link
              href={`/scenarios/${scenarioParam}`}
              className="font-medium underline"
            >
              Zum Szenario
            </Link>
          </div>
        )}

        {prefillError && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            Das Szenario konnte nicht geladen werden ({prefillError}) – das
            Formular bleibt leer.
          </div>
        )}

        {wartetAufSzenario ? (
          <p className="text-foreground/60">Lade Szenario …</p>
        ) : (
          <CharacterForm
            onGenerate={handleGenerate}
            loading={textLoading}
            initialInput={prefill?.values}
            initialGenre={prefill?.genre}
          />
        )}
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
          scenarios={scenarios}
          scenarioId={selectedScenarioId}
          onScenarioChange={setSelectedScenarioId}
          onGenerateImage={handleGenerateImage}
          onSave={handleSave}
          saving={saving}
          saved={saved}
        />
      )}
    </div>
  );
}
