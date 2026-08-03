"use client";

import { useState } from "react";
import Image from "next/image";
import {
  buildCharacterFile,
  generateName,
  generateStoryHooks,
  getImage,
  regenerateDescription,
} from "@/lib/client";
import { characterFileName } from "@/lib/characterFile";
import { downloadBlob, safeFileName } from "@/lib/download";
import { randomName } from "@/lib/names";
import { DEFAULT_GENRE, GENRE_TEMPLATES } from "@/lib/templates";
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
  type StoredScenario,
} from "@/lib/serialize";
import { joinHooks, splitHooks } from "@/lib/storyHooks";
import { AutoTextarea } from "./AutoTextarea";
import { CharacterImagesModal } from "./CharacterImagesModal";
import { ImageLightbox } from "./ImageLightbox";
import { TraitsTable } from "./TraitsTable";
import { CharacterInputModal } from "./CharacterInputModal";
import { ScenarioFromCharacterModal } from "./ScenarioFromCharacterModal";
import { useBackdropClose } from "./useBackdropClose";
import { Button } from "./ui/Button";
import { IconButton } from "./ui/IconButton";
import {
  Dices,
  Download,
  FileText,
  Images,
  Sparkles,
  Trash2,
  X,
} from "./ui/icons";

/** Token-getriebene Eingabe-Klasse (16px mobil gegen iOS-Zoom, ab sm kompakt). */
const FIELD =
  "rounded-md border border-border bg-background px-3 py-1.5 text-base text-foreground outline-none transition focus:border-primary/50 disabled:opacity-50 sm:text-sm";

export function CharacterDetailModal({
  character: c,
  scenarios,
  onClose,
  onDelete,
  onSaveContent,
  onCharacterUpdated,
  onAssignScenario,
  onScenarioCreated,
}: {
  character: StoredCharacter;
  scenarios: StoredScenario[];
  onClose: () => void;
  onDelete: () => void;
  onSaveContent: (
    character: GeneratedCharacter,
    storyHooks: string,
    genre: string,
  ) => Promise<void>;
  onCharacterUpdated: (updated: StoredCharacter) => void;
  onAssignScenario: (scenarioId: string | null) => Promise<void>;
  /** Ein hier abgeleitetes Szenario in die Liste der Seite aufnehmen. */
  onScenarioCreated: (scenario: StoredScenario) => void;
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
   *
   * Als **Liste**, obwohl die Datenbank einen String hält: Jeder Ansatzpunkt
   * ist für sich brauchbar oder nicht, und nur einzeln lässt sich einer
   * wegwerfen, ohne die anderen mitzunehmen. Umgerechnet wird an genau zwei
   * Stellen – hier beim Laden und in `saveEdits` beim Schreiben (s.
   * `lib/storyHooks.ts`).
   */
  const [hooks, setHooks] = useState<string[]>(() => splitHooks(c.storyHooks));

  /**
   * Das Genre steht aus demselben Grund neben `edited` wie die Ansatzpunkte:
   * Es gehört zum Charakter, ist aber kein Feld von `GeneratedCharacter` – es
   * kommt aus den Vorgaben. Auch hier nur der Speichern-Knopf gemeinsam.
   *
   * Es ist die **einzige** Vorgabe, die sich nachträglich ändern lässt. Die
   * übrigen sind ein Protokoll des Erstellungszeitpunkts; die Genre-Id geht
   * dagegen nie in den Text-Prompt ein (dorthin gehen `setting` und `notes`),
   * sondern steuert Würfel und Szenario-Ableitung. Ohne diesen Weg blieben
   * alle vor der Genre-Spalte angelegten Charaktere dauerhaft „Gegenwart".
   */
  const [genre, setGenre] = useState(c.input?.genre ?? DEFAULT_GENRE);

  /**
   * Schließt bei einem Klick daneben – aber nicht, wenn nur eine
   * Textmarkierung aus dem Dialog heraus über dem Backdrop endet. Genau das
   * kostete hier sonst **alle ungespeicherten Änderungen**, sobald jemand die
   * Beschreibung zum Kopieren markierte.
   */
  const backdrop = useBackdropClose(onClose);
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
  /**
   * Stichworte zur Richtung der Ansatzpunkte. Aus demselben Grund wie die
   * Stufe **nur für diese Sitzung**: Beides beschreibt nichts am Charakter,
   * sondern wie man ihn gerade befragen will. Was dabei herauskommt, wird
   * gespeichert – der Weg dorthin nicht.
   */
  const [hookDirection, setHookDirection] = useState("");

  // Text neu erzeugen: Zusatzwunsch (Stil, Perspektive, Schwerpunkt).
  const [rewriteHint, setRewriteHint] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);

  // Alles rund um Bilder liegt in der eigenen Bilder-Ansicht.
  const [imagesOpen, setImagesOpen] = useState(false);

  // Die ursprünglichen Formular-Vorgaben ebenso – reine Anzeige.
  const [inputOpen, setInputOpen] = useState(false);
  const [scenarioDraftOpen, setScenarioDraftOpen] = useState(false);

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
  const [assigningScenario, setAssigningScenario] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  /** Bild(er) in die Export-Datei aufnehmen. Default **an** (mit Bild). */
  const [exportMitBild, setExportMitBild] = useState(true);
  const [exportError, setExportError] = useState<string | null>(null);
  const [namingAI, setNamingAI] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  /** Schon vorgeschlagene Namen – Ausschlussliste gegen Wiederholungen. */
  const [nameHistory, setNameHistory] = useState<string[]>([]);

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
        /**
         * Hier **kein** `genre`, obwohl es die Vorgaben inzwischen tragen:
         * `randomName` stellt die Genre-Id über das Setting, und bei einem
         * Altbestand ist die Id nur der aufgefüllte Default. Ein vor der
         * Genre-Spalte angelegter Fantasy-Charakter bekäme dadurch plötzlich
         * Gegenwartsnamen. Das Setting-Feld sagt in beiden Fällen die
         * Wahrheit – bei neuen Charakteren belegt die Genre-Vorlage es.
         */
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
      const { name } = await generateName(
        c.input,
        edited.merkmale,
        // Der aktuelle Name zählt mit – er soll nicht gleich wieder kommen.
        Array.from(new Set([edited.name, ...nameHistory].filter(Boolean))),
      );
      setField("name", name);
      setNameHistory((h) => [...h, name].slice(-20));
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
   * Einen Ansatzpunkt ableiten und **anhängen**. Vorher ersetzte der Knopf den
   * ganzen Block und musste deshalb nachfragen; jetzt kann er nichts zerstören,
   * und die Rückfrage entfällt. Die vorhandenen gehen als Ausschlussliste mit,
   * sonst käme beim zweiten Klick dieselbe Idee in anderen Worten zurück.
   *
   * Wie zuvor nur eine ungespeicherte Änderung – abgelegt wird erst über
   * „Änderungen speichern".
   */
  async function deriveHooks() {
    if (hooksBusy) return;
    setHooksBusy(true);
    setHooksError(null);
    try {
      const { ansatzpunkte } = await generateStoryHooks(
        edited,
        anchor,
        hookDirection,
        hooks,
      );
      // Über `joinHooks` statt roh: Eine Leerzeile mitten in der Antwort
      // würde den Eintrag beim nächsten Laden in zwei zerlegen.
      const neu = joinHooks([ansatzpunkte]);
      if (neu) setHooks((h) => [...h, neu]);
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
      const datei = await buildCharacterFile(
        c,
        edited,
        hooksText,
        !exportMitBild,
      );
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
        "./CharacterPdf"
      );
      const scenarioName = scenarios.find((g) => g.id === c.scenarioId)?.name ?? null;
      const imageData = await ensureFullImage();
      const blob = await renderCharacterPdfBlob({
        name: edited.name,
        kurzbeschreibung: edited.kurzbeschreibung,
        beschreibung: edited.beschreibung,
        merkmale: edited.merkmale,
        imageData,
        scenarioName,
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

  /**
   * Die Liste in der Form, die Datenbank, Exportdatei und die Prompts der
   * Szenario-Routen erwarten. Einmal abgeleitet statt an jeder Verwendung neu:
   * Sie geht in den Vergleich für `dirty` ebenso ein wie ins Speichern, in den
   * JSON-Export und in die Szenario-Ableitung – und die vier müssen sich einig
   * sein, sonst gilt etwas als geändert, was nur anders geschrieben ist.
   */
  const hooksText = joinHooks(hooks);

  const dirty =
    JSON.stringify(edited) !== JSON.stringify(c.character) ||
    hooksText !== c.storyHooks ||
    genre !== (c.input?.genre ?? DEFAULT_GENRE);
  const nameValid = edited.name.trim().length > 0;

  async function saveEdits() {
    if (!dirty || !nameValid || savingEdits) return;
    setSavingEdits(true);
    setEditError(null);
    const payload = { ...edited, name: edited.name.trim() };
    try {
      await onSaveContent(payload, hooksText, genre);
      setEdited(payload);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setSavingEdits(false);
    }
  }

  async function assignScenario(scenarioId: string | null) {
    setAssigningScenario(true);
    try {
      await onAssignScenario(scenarioId);
    } finally {
      setAssigningScenario(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      {...backdrop}
    >
      <div
        className="my-8 w-full max-w-5xl rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={edited.name}
                onChange={(e) => setField("name", e.target.value)}
                aria-label="Name des Charakters"
                className="-mx-2 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-2xl font-semibold outline-none transition hover:border-border focus:border-primary/50"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={rollName}
                title="Zufallsname passend zu Geschlecht und Herkunft aus der Merkmalstabelle – sofort und ohne KI"
                className="shrink-0"
              >
                <Dices size={15} strokeWidth={1.75} aria-hidden="true" />
                Würfeln
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={suggestName}
                disabled={namingAI}
                title="Namensvorschlag der KI auf Basis der Merkmalstabelle"
                className="shrink-0"
              >
                <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
                {namingAI ? "Denkt nach …" : "Zu den Merkmalen"}
              </Button>
            </div>
            {nameError && (
              <p className="mt-1 text-xs text-destructive">{nameError}</p>
            )}
            <AutoTextarea
              value={edited.kurzbeschreibung}
              onChange={(value) => setField("kurzbeschreibung", value)}
              ariaLabel="Kurzbeschreibung"
              placeholder="Kurzbeschreibung"
              className="mt-1 text-muted-foreground italic"
            />
          </div>
          <IconButton label="Schließen" onClick={onClose} className="shrink-0">
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </IconButton>
        </div>

        {/* Änderungen speichern (erscheint bei Änderungen) */}
        {dirty && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <span className="text-sm text-amber-800 dark:text-amber-300">
              Ungespeicherte Änderungen
            </span>
            <Button
              size="sm"
              onClick={saveEdits}
              disabled={savingEdits || !nameValid}
              className="ml-auto"
            >
              {savingEdits ? "Speichere …" : "Änderungen speichern"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEdited(c.character);
                setHooks(splitHooks(c.storyHooks));
                setGenre(c.input?.genre ?? DEFAULT_GENRE);
              }}
              disabled={savingEdits}
            >
              Verwerfen
            </Button>
            {editError && (
              <span className="w-full text-xs text-destructive">
                {editError}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
          <div className="order-2 md:order-1">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Beschreibung
              </h3>
              <span className="text-xs text-muted-foreground tabular-nums">
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
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted p-2">
              <input
                value={rewriteHint}
                onChange={(e) => setRewriteHint(e.target.value)}
                maxLength={1000}
                placeholder="Zusätzliche Wünsche – z. B. nüchterner Stil, mehr über die Kindheit …"
                aria-label="Zusätzliche Wünsche für den neuen Text"
                className={`min-w-40 flex-1 ${FIELD}`}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={rewriteDescription}
                disabled={rewriting}
                title="Erzeugt den Beschreibungstext neu – aus den ursprünglichen Vorgaben und der Merkmalstabelle. Name und Merkmale bleiben unverändert."
                className="shrink-0"
              >
                <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
                {rewriting ? "Schreibt …" : "Text neu erzeugen"}
              </Button>
              {rewriteError ? (
                <p className="w-full text-xs text-destructive">
                  {rewriteError}
                </p>
              ) : (
                <p className="w-full text-xs text-muted-foreground">
                  Ersetzt den Text oben. Bis zum Speichern lässt er sich
                  verwerfen.
                </p>
              )}
            </div>
          </div>
          <div className="order-1 md:order-2">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted">
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
                <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                  Kein Bild
                </div>
              )}
            </div>

            <Button
              variant="secondary"
              onClick={() => setImagesOpen(true)}
              className="mt-3 w-full"
            >
              <Images size={16} strokeWidth={1.75} aria-hidden="true" />
              {c.images.length > 0
                ? `Bilder verwalten (${c.images.length})`
                : "Bild erzeugen …"}
            </Button>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Weitere Bilder erzeugen, hochladen und das primäre wählen.
            </p>

            {/*
              Genre und Szenario stehen zusammen unter dem Bild: Beides ordnet
              die Figur ein, statt sie zu beschreiben – anders als Name, Text
              und Merkmale in der Spalte daneben.

              Sie speichern allerdings **verschieden**: Das Szenario ordnet
              sofort zu (eigener PATCH, es kann nichts halb geändert sein), das
              Genre wartet auf „Änderungen speichern", weil es zu den Vorgaben
              gehört und mit Text und Merkmalen zusammen verworfen werden darf.
              Untereinander mit eigener Beschriftung ist das zu erkennen –
              nebeneinander in einer Zeile wäre es eine Falle.
            */}
            <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Genre</span>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className={`w-full ${FIELD}`}
                >
                  {GENRE_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.emoji} {t.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  Steuert die Würfel und das Genre eines abgeleiteten
                  Szenarios. Wird erst beim Speichern der Änderungen übernommen.
                </span>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Szenario</span>
                <select
                  value={c.scenarioId ?? ""}
                  onChange={(e) => assignScenario(e.target.value || null)}
                  disabled={assigningScenario}
                  className={`w-full ${FIELD}`}
                >
                  <option value="">— keine —</option>
                  {scenarios.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  Wird sofort gespeichert.
                </span>
              </label>
            </div>
          </div>
        </div>

        {/*
          Ansatzpunkte für eine Geschichte. Über die volle Breite und nicht in
          der Beschreibungs-Spalte: es sind mehrere Absätze Fließtext, und neben
          dem Bild stünde jeder davon als schmale Säule.
        */}
        <div className="mt-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Ansatzpunkte für eine Geschichte
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Bindung:</span>
                <select
                  value={anchor}
                  onChange={(e) => setAnchor(e.target.value as StoryHookAnchor)}
                  title={STORY_HOOK_ANCHORS.find((a) => a.value === anchor)?.hint}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-base text-foreground outline-none transition focus:border-primary/50 sm:text-xs"
                >
                  {STORY_HOOK_ANCHORS.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                variant="secondary"
                size="sm"
                onClick={deriveHooks}
                disabled={hooksBusy}
                title="Leitet aus Beschreibung und Merkmalen eine weitere Ausgangslage für eine Geschichte ab und hängt sie an die Liste an"
              >
                <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
                {hooksBusy
                  ? "Denkt nach …"
                  : hooks.length
                    ? "Weiteren ableiten"
                    : "Ableiten"}
              </Button>
            </div>
          </div>
          {/* Der Hinweis erklärt die Stufe, ohne dass man das Menü aufklappen muss. */}
          <p className="mb-2 text-xs text-muted-foreground">
            {STORY_HOOK_ANCHORS.find((a) => a.value === anchor)?.hint}
          </p>

          {/*
            Stichworte zur Richtung. Steht **über** dem Textfeld und direkt
            unter der Bindungsstufe, weil beides zusammen die Frage stellt, die
            der Knopf oben beantwortet – anders als der Zusatzwunsch beim Text
            neu erzeugen, der unter seinem Textfeld sitzt: Der greift einen
            vorhandenen Text auf, dieser hier füllt ein leeres Feld.

            Ein Freitextfeld und kein weiteres Menü: Was jemand von drei
            Ansatzpunkten will, lässt sich nicht in eine Liste sperren.
          */}
          <div className="mb-2">
            <input
              value={hookDirection}
              onChange={(e) => setHookDirection(e.target.value)}
              maxLength={500}
              placeholder="Richtung (optional) – z. B. alte Schuld, Verrat im Kollegium, eher leise …"
              aria-label="Stichworte zur Richtung der Ansatzpunkte"
              className={`w-full ${FIELD}`}
            />
            {/*
              Bei „eng" ist der Hinweis eine **Warnung**, keine Erläuterung:
              Gemessen bricht das Modell die Bindung, wenn die Stichworte
              Erfundenes verlangen (s. CLAUDE.md). Das lässt sich per Prompt
              nicht durchsetzen – der Nutzer erfährt es deshalb hier, statt
              sich über Ansatzpunkte zu wundern, die die Stufe verbieten sollte.
            */}
            {hookDirection.trim() && (
              <p
                className={
                  anchor === "eng"
                    ? "mt-1 text-xs text-amber-700 dark:text-amber-400"
                    : "mt-1 text-xs text-muted-foreground"
                }
              >
                {anchor === "eng"
                  ? "Achtung: Stichworte, die Erfundenes verlangen (Verschwörung, geheime Organisation …), weichen die enge Bindung auf. Ist das gewollt, passt „mittel“ oder „frei“ besser."
                  : "Wählt aus, woran angesetzt wird."}
              </p>
            )}
          </div>
          {/*
            Eine Liste statt eines Blocks: Jeder Ansatzpunkt ist für sich
            brauchbar oder nicht. Der Löschknopf sitzt deshalb an der einzelnen
            Karte und wirkt **sofort** – ohne Rückfrage, denn abgelegt ist
            nichts, solange „Änderungen speichern" nicht gedrückt wurde, und
            „Verwerfen" holt die gespeicherte Liste zurück.
          */}
          {hooks.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Noch keine Ansatzpunkte – der Knopf oben schlägt einen vor. Jeder
              weitere Klick hängt einen an.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {hooks.map((hook, i) => (
                <li
                  // Der Index als Key ist hier richtig: Die Einträge haben
                  // keine Id, und die Liste ändert sich nur am Ende (Anhängen)
                  // oder durch Löschen – beides ohne Umsortieren.
                  key={i}
                  className="flex items-start gap-2 rounded-md border border-border bg-muted px-3 py-2"
                >
                  <span className="mt-1 w-4 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <AutoTextarea
                      value={hook}
                      onChange={(v) =>
                        setHooks((h) => h.map((x, j) => (j === i ? v : x)))
                      }
                      ariaLabel={`Ansatzpunkt ${i + 1}`}
                      className="text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setHooks((h) => h.filter((_, j) => j !== i))}
                    title="Diesen Ansatzpunkt entfernen"
                    aria-label={`Ansatzpunkt ${i + 1} entfernen`}
                    className="mt-0.5 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hooksError && (
            <p className="mt-1 text-xs text-destructive">{hooksError}</p>
          )}
        </div>

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Merkmale
          </h3>
          <TraitsTable traits={edited.merkmale} onChange={setTrait} compact />
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {new Date(c.createdAt).toLocaleDateString("de-DE")}
          </span>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {/*
              „mit Bild" (Default an) gehört zum Datei-Export: Ohne Häkchen geht
              der Charakter **ohne Bilder** in die Datei. Betrifft nur den
              Datei-Export, nicht das PDF.
            */}
            <label
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
              title="Bild(er) in die Export-Datei aufnehmen. Ohne Häkchen wird der Charakter ohne Bilder exportiert – deutlich kleinere Datei."
            >
              <input
                type="checkbox"
                checked={exportMitBild}
                onChange={(e) => setExportMitBild(e.target.checked)}
                disabled={exportingJson}
                className="size-4 accent-primary"
              />
              mit Bild
            </label>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportJson}
              disabled={exportingJson}
              title="Charakter als Datei – lässt sich anderswo wieder importieren. Mit oder ohne Bild je nach Häkchen."
            >
              <Download size={15} strokeWidth={1.75} aria-hidden="true" />
              {exportingJson
                ? exportMitBild
                  ? "Sammle Bilder …"
                  : "Exportiere …"
                : "Datei"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportPdf}
              disabled={exporting}
            >
              <Download size={15} strokeWidth={1.75} aria-hidden="true" />
              {exporting ? "PDF …" : "PDF"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setInputOpen(true)}
            >
              <FileText size={15} strokeWidth={1.75} aria-hidden="true" />
              Vorgaben
            </Button>
            {/*
              Die Gegenrichtung zu „+ Charakter für dieses Szenario": dort prägt
              eine Welt eine neue Figur, hier spannt eine Figur die Welt auf.
            */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setScenarioDraftOpen(true)}
              title="Leitet aus Beschreibung, Merkmalen und Ansatzpunkten ein neues Szenario ab und ordnet den Charakter ihm zu"
            >
              <Sparkles size={15} strokeWidth={1.75} aria-hidden="true" />
              Szenario ableiten
            </Button>
            {/* Destruktiv abgesetzt (eigener Trenner). */}
            <span
              aria-hidden="true"
              className="mx-1 hidden h-6 w-px bg-border sm:block"
            />
            <Button variant="danger" size="sm" onClick={onDelete}>
              <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
              Löschen
            </Button>
          </div>
          </div>
          {exportError && (
            <p className="mt-2 text-right text-xs text-destructive">
              {exportError}
            </p>
          )}
        </div>
      </div>

      {imagesOpen && (
        <CharacterImagesModal
          character={c}
          edited={edited}
          genre={genre}
          onChange={onCharacterUpdated}
          onClose={() => setImagesOpen(false)}
        />
      )}

      {scenarioDraftOpen && (
        <ScenarioFromCharacterModal
          character={c}
          edited={edited}
          storyHooks={hooksText}
          genre={genre}
          onScenarioCreated={onScenarioCreated}
          onAssign={(scenarioId) => onAssignScenario(scenarioId)}
          onClose={() => setScenarioDraftOpen(false)}
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
