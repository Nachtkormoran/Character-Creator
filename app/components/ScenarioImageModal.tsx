"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  addScenarioImage,
  deleteScenarioImage,
  generateScenarioImage,
  getScenarioImage,
  setPrimaryScenarioImage,
} from "@/lib/client";
import { downloadImage, safeFileName } from "@/lib/download";
import { fileToDataUrl } from "@/lib/image";
import {
  DEFAULT_IMAGE_STYLE,
  IMAGE_STYLES,
  type ScenarioDetails,
} from "@/lib/schema";
import type { StoredImage, StoredScenario } from "@/lib/serialize";
import { ImageLightbox } from "./ImageLightbox";
import { useBackdropClose } from "./useBackdropClose";

/**
 * Die **Bilder-Ansicht eines Szenarios** – eigene Ebene über der Detailseite, in
 * der die gesamte Weltbild-Bedienung liegt (Stil, Stichwörter, „ohne Menschen",
 * Erzeugen, Hochladen, Primär setzen, Löschen, Exportieren, Vollbild).
 *
 * **Mehrere Bilder je Szenario** – wortgleich zur `CharacterImagesModal`, nur am
 * Szenario: eine Kachelgalerie, genau ein Bild ist `isPrimary` und wird überall
 * groß gezeigt (Übersichtskarte, Detailseite, Export). Anders als beim Charakter
 * zeigen die Bilder die **Welt, keine Figuren** – daher die „ohne Menschen"-
 * Option statt Merkmalstabelle/Textdetails.
 *
 * Die Detailseite ist eine echte Seite (kein Modal), diese Ansicht also die
 * **erste** Overlay-Ebene – deshalb ein gewöhnlicher Esc-/Backdrop-Handler
 * (kein `useOpenAtTop`, keine verschachtelte Capture-Phase-Logik der Galerie).
 * Das Vollbild (`ImageLightbox`) öffnet darüber; solange es offen ist, schließt
 * Esc **es** und nicht diese Ansicht.
 */
export function ScenarioImageModal({
  scenarioId,
  name,
  details,
  images,
  onChange,
  onClose,
}: {
  scenarioId: string;
  name: string;
  /** Der bearbeitete Stand der Festlegungen – Grundlage für den Bild-Prompt. */
  details: ScenarioDetails;
  /** Die aktuellen Weltbilder (ohne Originale). */
  images: StoredImage[];
  /** Meldet der Seite das geänderte Szenario (mit neuer Bildliste). */
  onChange: (scenario: StoredScenario) => void;
  onClose: () => void;
}) {
  const [stil, setStil] = useState<string>(DEFAULT_IMAGE_STYLE);
  const [stichwoerter, setStichwoerter] = useState("");
  // Default an = Welt ohne Figuren (bisheriges Verhalten). Aus = das Modell darf
  // Menschen zeigen. Reiner Lauf-Parameter, nicht gespeichert.
  const [ohneMenschen, setOhneMenschen] = useState(true);

  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  /** Id des Bildes, dessen Original gerade fürs Vollbild geladen wird. */
  const [loadingId, setLoadingId] = useState<string | null>(null);
  /** Id des Bildes, dessen Original gerade für den Download geladen wird. */
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [vollbild, setVollbild] = useState<string | null>(null);
  const dateiWahl = useRef<HTMLInputElement>(null);

  // Eigener Esc-Handler. Solange das Vollbild offen ist, gehört Esc **ihm**.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !vollbild) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, vollbild]);

  const backdrop = useBackdropClose(onClose, { stopPropagation: true });

  /** Eine schreibende Bild-Aktion ausführen und das Ergebnis melden. */
  async function run(action: () => Promise<StoredScenario>) {
    if (busy) return;
    setBusy(true);
    setFehler(null);
    try {
      onChange(await action());
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  const erzeugen = () =>
    run(async () => {
      const { imageData } = await generateScenarioImage(details, stil, {
        extraPrompt: stichwoerter.trim() || undefined,
        ohneMenschen,
      });
      return addScenarioImage(scenarioId, imageData);
    });

  async function hochladen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erlaubt erneutes Wählen derselben Datei
    if (!file) return;
    run(async () => addScenarioImage(scenarioId, await fileToDataUrl(file)));
  }

  function loeschen(imageId: string) {
    if (!confirm("Dieses Weltbild wirklich löschen?")) return;
    run(() => deleteScenarioImage(scenarioId, imageId));
  }

  /**
   * Ein einzelnes Bild als Datei herunterladen – immer das **Original** über
   * `getScenarioImage`, nicht das Thumbnail der Kachel. Bei mehreren Bildern
   * bekommt jede Datei ihre Position angehängt, sonst überschrieben sich die
   * Downloads im Zielordner gegenseitig.
   */
  async function exportieren(imageId: string) {
    if (exportingId) return;
    setExportingId(imageId);
    setFehler(null);
    try {
      const original = await getScenarioImage(scenarioId, imageId);
      const index = images.findIndex((i) => i.id === imageId);
      const base = `${safeFileName(name)}_Weltbild`;
      await downloadImage(
        original,
        images.length > 1 ? `${base}_${index + 1}` : base,
      );
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Export fehlgeschlagen.");
    } finally {
      setExportingId(null);
    }
  }

  /** Original nachladen und im Vollbild zeigen. */
  async function vollbildOeffnen(imageId: string) {
    setLoadingId(imageId);
    setFehler(null);
    try {
      setVollbild(await getScenarioImage(scenarioId, imageId));
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Bild laden fehlgeschlagen.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      {...backdrop}
    >
      <div
        className="my-8 w-full max-w-4xl rounded-xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            {`Weltbilder von ${name || "diesem Szenario"}`}
          </h2>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="shrink-0 rounded-md px-2 py-1 text-muted-foreground transition hover:bg-muted"
            aria-label="Bilder-Ansicht schließen"
          >
            ✕
          </button>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          {images.length === 0
            ? "Noch keine Weltbilder – ein Establishing-Shot der Welt, ohne Figuren."
            : `${images.length} ${images.length === 1 ? "Bild" : "Bilder"} – das primäre wird überall groß angezeigt.`}
        </p>

        {images.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((img) => (
              <div
                key={img.id}
                className={`flex flex-col overflow-hidden rounded-xl border transition ${
                  img.isPrimary
                    ? "border-foreground/60 ring-2 ring-foreground/20"
                    : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => vollbildOeffnen(img.id)}
                  disabled={loadingId !== null}
                  aria-label="Bild in voller Größe anzeigen"
                  className="relative aspect-square w-full cursor-zoom-in bg-muted"
                >
                  {img.thumbnail ? (
                    <Image
                      src={img.thumbnail}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover transition hover:opacity-90"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-3xl opacity-30">
                      🏞️
                    </span>
                  )}
                  {img.isPrimary && (
                    <span className="absolute top-2 left-2 rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                      Primär
                    </span>
                  )}
                  {loadingId === img.id && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
                      Lade …
                    </span>
                  )}
                </button>

                <div className="flex flex-col gap-1.5 p-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(img.createdAt).toLocaleDateString("de-DE")}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      run(() => setPrimaryScenarioImage(scenarioId, img.id))
                    }
                    disabled={busy || img.isPrimary}
                    className="w-full rounded-md border border-border px-2 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-40"
                  >
                    {img.isPrimary ? "Primär ✓" : "Als primär"}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => exportieren(img.id)}
                      disabled={exportingId !== null}
                      title="Dieses Bild in voller Auflösung herunterladen"
                      className="flex-1 rounded-md border border-border px-2 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-40"
                    >
                      {exportingId === img.id ? "Lade …" : "Exportieren"}
                    </button>
                    <button
                      type="button"
                      onClick={() => loeschen(img.id)}
                      disabled={busy}
                      aria-label="Bild löschen"
                      className="rounded-md border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive transition hover:bg-destructive/10 disabled:opacity-40"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Neues Bild ------------------------------------------------------ */}
        <div className="border-t border-border pt-5">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Neues Weltbild
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Stil
                </span>
                <select
                  value={stil}
                  onChange={(e) => setStil(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
                >
                  {IMAGE_STYLES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <label
                className="flex cursor-pointer items-start gap-2 text-sm text-muted-foreground"
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
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  Stichwörter (optional)
                </span>
                <input
                  value={stichwoerter}
                  onChange={(e) => setStichwoerter(e.target.value)}
                  disabled={busy}
                  maxLength={1000}
                  placeholder="z. B. Regen, Dämmerung"
                  title="Zusätzliche Wünsche fürs Bild – Perspektive, Lichtstimmung, Wetter. Wird nicht gespeichert."
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
                />
              </label>

              <button
                type="button"
                onClick={erzeugen}
                disabled={busy}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Einen Moment …" : "✨ Bild erzeugen"}
              </button>

              <label
                className={`block w-full cursor-pointer rounded-md border border-border px-4 py-2 text-center text-sm font-medium transition hover:bg-muted ${
                  busy ? "pointer-events-none opacity-50" : ""
                }`}
              >
                Bild hochladen
                <input
                  ref={dateiWahl}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={hochladen}
                  disabled={busy}
                />
              </label>

              <p className="text-xs text-muted-foreground">
                Neue Bilder werden automatisch das Primärbild.
              </p>
            </div>
          </div>

          {fehler && (
            <p className="mt-3 text-xs text-destructive">
              {fehler}
            </p>
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
