"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  deleteScenarioImage,
  generateScenarioImage,
  getScenarioImage,
  saveScenarioImage,
} from "@/lib/client";
import { downloadImage, safeFileName } from "@/lib/download";
import { fileToDataUrl } from "@/lib/image";
import {
  DEFAULT_IMAGE_STYLE,
  IMAGE_STYLES,
  type ScenarioDetails,
} from "@/lib/schema";
import { ImageLightbox } from "./ImageLightbox";
import { useBackdropClose } from "./useBackdropClose";

/**
 * Die **Bild-Ansicht eines Szenarios** – eigene Ebene über der Detailseite, in
 * der die gesamte Bild-Bedienung liegt (Stil, Stichwörter, Erzeugen, Hochladen,
 * Löschen, Exportieren). Das Gegenstück zur `CharacterImagesModal`, bewusst
 * herausgezogen aus der Detailansicht: Dort blieb sonst die halbe Spalte voller
 * Schalter, und die Weltbeschreibung stand neben einem Bedienfeld statt neben
 * dem Bild.
 *
 * **Datenmodell ist weiterhin einbildig** – ein Szenario hat genau ein Weltbild
 * (`Scenario.imageData` + `thumbnail`). Diese Ansicht verschiebt nur die
 * Bedienung; sie ist aber der Ort, an dem später eine Kachelgalerie mit
 * `isPrimary`-Logik entstünde, wenn das Szenario auf mehrere Bilder umgestellt
 * wird (dann analog zu `CharacterImagesModal`).
 *
 * Die Detailseite ist eine echte Seite (kein Modal), diese Ansicht also die
 * **erste** Overlay-Ebene – deshalb ein gewöhnlicher Esc-/Backdrop-Handler wie
 * bei `CharacterInputModal`, nicht die verschachtelte Capture-Phase-Logik der
 * Galerie. Das Vollbild (`ImageLightbox`) öffnet darüber; solange es offen ist,
 * schließt Esc **es** und nicht diese Ansicht.
 */
export function ScenarioImageModal({
  scenarioId,
  name,
  details,
  thumbnail,
  onChange,
  onClose,
}: {
  scenarioId: string;
  name: string;
  /** Aktueller, womöglich ungespeicherter Stand – Grundlage der Erzeugung. */
  details: ScenarioDetails;
  /** Das gespeicherte Bild als Thumbnail (oder `null`). */
  thumbnail: string | null;
  /** Meldet der Seite ein geändertes gespeichertes Bild (Thumbnail oder `null`). */
  onChange: (thumbnail: string | null) => void;
  onClose: () => void;
}) {
  const [kandidat, setKandidat] = useState<string | null>(null);
  const [stil, setStil] = useState<string>(DEFAULT_IMAGE_STYLE);
  const [stichwoerter, setStichwoerter] = useState("");
  // Default an = bisheriges Verhalten (Welt ohne Figuren). Aus = das Modell
  // darf Menschen zeigen. Reiner Lauf-Parameter, nicht gespeichert.
  const [ohneMenschen, setOhneMenschen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Original fürs Vollbild – geladen bei Klick aufs gespeicherte Bild. */
  const [vollbild, setVollbild] = useState<string | null>(null);
  const dateiWahl = useRef<HTMLInputElement>(null);

  // Eigener Esc-Handler. Solange das Vollbild offen ist, gehört Esc **ihm** –
  // die Lightbox schließt sich über ihren eigenen Handler, dieser hält sich
  // dann zurück, damit nicht beide Ebenen auf einen Druck verschwinden.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !vollbild) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, vollbild]);

  const backdrop = useBackdropClose(onClose, { stopPropagation: true });

  /**
   * Ein Weltbild erzeugen. Es landet als **Kandidat** (ungespeichert) – das
   * gespeicherte Bild bleibt, bis „Übernehmen" es ersetzt. Die Festlegungen
   * gehen im aktuellen Stand mit; die Route persistiert nichts.
   */
  async function erzeugen() {
    if (busy) return;
    setBusy(true);
    setFehler(null);
    try {
      const { imageData } = await generateScenarioImage(details, stil, {
        extraPrompt: stichwoerter.trim() || undefined,
        ohneMenschen,
      });
      setKandidat(imageData);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  /** Ein eigenes Bild hochladen – ebenfalls erst Kandidat, dann „Übernehmen". */
  async function hochladen(file: File) {
    setFehler(null);
    try {
      setKandidat(await fileToDataUrl(file));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Datei fehlerhaft.");
    }
  }

  /** Den Kandidaten speichern – ersetzt das bisherige Bild. */
  async function uebernehmen() {
    if (!kandidat || busy) return;
    setBusy(true);
    setFehler(null);
    try {
      const s = await saveScenarioImage(scenarioId, kandidat);
      onChange(s.thumbnail);
      setKandidat(null);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function loeschen() {
    if (busy || !thumbnail) return;
    if (!confirm("Das Szenario-Bild löschen?")) return;
    setBusy(true);
    setFehler(null);
    try {
      const s = await deleteScenarioImage(scenarioId);
      onChange(s.thumbnail);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Das gespeicherte Bild als Datei sichern. Geholt wird das **Original** über
   * `getScenarioImage` (nicht das Thumbnail der Kachel) – für einen Export soll
   * die volle Auflösung heraus. Nur ein Bild je Szenario, deshalb ohne
   * Positionszusatz im Dateinamen, anders als beim Charakter mit mehreren.
   */
  async function exportieren() {
    if (!thumbnail || exporting) return;
    setExporting(true);
    setFehler(null);
    try {
      const original = await getScenarioImage(scenarioId);
      await downloadImage(original, `${safeFileName(name)}_Weltbild`);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Export fehlgeschlagen.");
    } finally {
      setExporting(false);
    }
  }

  /** Original fürs Vollbild nachladen (das Thumbnail ist nur die Vorschau). */
  async function vollbildOeffnen() {
    if (!thumbnail) return;
    try {
      setVollbild(await getScenarioImage(scenarioId));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Bild laden fehlgeschlagen.");
    }
  }

  const anzeige = kandidat ?? thumbnail;

  return (
    <div
      className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      {...backdrop}
    >
      <div
        className="my-8 w-full max-w-md rounded-xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">Weltbild</h2>
            <p className="mt-1 text-sm text-foreground/60">
              Ein Establishing-Shot der Welt von {name || "diesem Szenario"} –
              ohne Figuren.
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="shrink-0 rounded-md px-2 py-1 text-foreground/60 transition hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {/* Kandidat (ungespeichert) hat Vorrang vor dem gespeicherten Bild. */}
        <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03]">
          {anzeige ? (
            kandidat ? (
              <Image
                src={kandidat}
                alt="Vorschau des Szenario-Bilds"
                fill
                sizes="320px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <button
                type="button"
                onClick={vollbildOeffnen}
                title="In voller Größe ansehen"
                className="absolute inset-0 h-full w-full cursor-zoom-in"
              >
                <Image
                  src={anzeige}
                  alt={`Weltbild von ${name}`}
                  fill
                  sizes="320px"
                  className="object-cover"
                  unoptimized
                />
              </button>
            )
          ) : (
            <div className="flex h-full items-center justify-center text-5xl opacity-25">
              🏞️
            </div>
          )}
        </div>

        {kandidat && (
          <p className="mt-2 text-center text-xs text-amber-700 dark:text-amber-400">
            Vorschau – noch nicht gespeichert
          </p>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {kandidat ? (
            <>
              <button
                type="button"
                onClick={uebernehmen}
                disabled={busy}
                className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Speichere …" : "Als Weltbild speichern"}
              </button>
              <button
                type="button"
                onClick={() => setKandidat(null)}
                disabled={busy}
                className="w-full rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
              >
                Verwerfen
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="szenario-bild-stil"
                  className="text-xs font-medium text-foreground/70"
                >
                  Stil
                </label>
                <select
                  id="szenario-bild-stil"
                  value={stil}
                  onChange={(e) => setStil(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
                >
                  {IMAGE_STYLES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor="szenario-bild-stichwoerter"
                  className="text-xs font-medium text-foreground/70"
                >
                  Stichwörter (optional)
                </label>
                <input
                  id="szenario-bild-stichwoerter"
                  value={stichwoerter}
                  onChange={(e) => setStichwoerter(e.target.value)}
                  disabled={busy}
                  maxLength={1000}
                  placeholder="z. B. Regen, Dämmerung"
                  title="Zusätzliche Wünsche fürs Bild – Perspektive, Lichtstimmung, Wetter. Wird nicht gespeichert."
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
                />
              </div>

              <label
                className="flex cursor-pointer items-start gap-2 text-sm text-foreground/70"
                title="An (Standard): das Weltbild zeigt keine Figuren. Aus: das Modell darf Menschen in die Szene setzen. Wird nicht gespeichert."
              >
                <input
                  type="checkbox"
                  checked={ohneMenschen}
                  onChange={(e) => setOhneMenschen(e.target.checked)}
                  disabled={busy}
                  className="mt-0.5"
                />
                <span>ohne Menschen</span>
              </label>

              <button
                type="button"
                onClick={erzeugen}
                disabled={busy}
                className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {busy
                  ? "Erzeuge …"
                  : thumbnail
                    ? "✨ Neu erzeugen"
                    : "✨ Bild erzeugen"}
              </button>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => dateiWahl.current?.click()}
                  disabled={busy}
                  className="flex-1 rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
                >
                  Hochladen
                </button>
                {thumbnail && (
                  <button
                    type="button"
                    onClick={exportieren}
                    disabled={busy || exporting}
                    title="Das gespeicherte Weltbild in voller Auflösung herunterladen"
                    className="flex-1 rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
                  >
                    {exporting ? "Exportiere …" : "Exportieren"}
                  </button>
                )}
                {thumbnail && (
                  <button
                    type="button"
                    onClick={loeschen}
                    disabled={busy}
                    className="flex-1 rounded-md border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                  >
                    Löschen
                  </button>
                )}
              </div>
              <input
                ref={dateiWahl}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) hochladen(f);
                  e.target.value = "";
                }}
              />
            </>
          )}

          {fehler && (
            <p className="text-xs text-red-600 dark:text-red-400">{fehler}</p>
          )}
        </div>
      </div>

      {vollbild && (
        <ImageLightbox
          src={vollbild}
          alt={`Weltbild von ${name}`}
          onClose={() => setVollbild(null)}
        />
      )}
    </div>
  );
}
