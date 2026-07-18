"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  addCharacterImage,
  deleteCharacterImage,
  generateImage,
  getImage,
  setPrimaryImage,
} from "@/lib/client";
import { fileToDataUrl } from "@/lib/image";
import {
  DEFAULT_IMAGE_STYLE,
  IMAGE_STYLES,
  type GeneratedCharacter,
} from "@/lib/schema";
import type { StoredCharacter } from "@/lib/serialize";
import { ImageLightbox } from "./ImageLightbox";
import { ReferenceImagePicker } from "./ReferenceImagePicker";

/**
 * Bilder-Ansicht eines Charakters.
 *
 * Bewusst eine eigene Ebene **über** der Detailansicht: alles, was mit Bildern
 * zu tun hat, liegt hier an einem Ort, und die Detailansicht bleibt beim
 * Schließen unverändert stehen. Sie zeigt nur noch das Primärbild.
 */
export function CharacterImagesModal({
  character: c,
  /** Der bearbeitete Stand aus der Detailansicht – Grundlage für den Prompt. */
  edited,
  onChange,
  onClose,
}: {
  character: StoredCharacter;
  edited: GeneratedCharacter;
  onChange: (updated: StoredCharacter) => void;
  onClose: () => void;
}) {
  const [imageStyle, setImageStyle] = useState<string>(
    c.input.imageStyle || DEFAULT_IMAGE_STYLE,
  );
  const [includeTraits, setIncludeTraits] = useState(true);
  const [includeTextDetails, setIncludeTextDetails] = useState(false);
  const [extraPrompt, setExtraPrompt] = useState("");
  // Vorlage gilt nur für diese Sitzung und wird nicht mitgespeichert.
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Id des Bildes, dessen Original gerade fürs Vollbild geladen wird. */
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [lightbox, setLightboxState] = useState<string | null>(null);
  /** Auswahl einer Vorlage unter den eigenen Bildern des Charakters. */
  const [ownPicker, setOwnPickerState] = useState(false);
  /** Id des Bildes, dessen Original gerade als Vorlage geladen wird. */
  const [ownLoadingId, setOwnLoadingId] = useState<string | null>(null);

  // Spiegeln den Zustand für den Esc-Handler unten mit – Begründung dort.
  const lightboxRef = useRef(false);
  const setLightbox = useCallback((value: string | null) => {
    lightboxRef.current = value !== null;
    setLightboxState(value);
  }, []);
  const ownPickerRef = useRef(false);
  const setOwnPicker = useCallback((value: boolean) => {
    ownPickerRef.current = value;
    setOwnPickerState(value);
  }, []);

  /**
   * Esc schließt die oberste offene Ebene: Vollbild, sonst Vorlagen-Auswahl,
   * sonst die Bilder-Ansicht selbst. Sonst verschwänden mehrere Ebenen auf
   * einen Tastendruck.
   *
   * Der Listener hängt **einmalig und in der Capture-Phase** und fragt die
   * Zustände über Refs ab. Beides ist nötig:
   *
   * - Würde er von den Zuständen abhängen und neu registriert, käme er zu
   *   früh zurück: das Vollbild schließt sich in seinem eigenen Handler, React
   *   hängt diesen Listener daraufhin noch *während derselben* Ausbreitung
   *   wieder ein, und er bekäme denselben Tastendruck ab.
   * - Capture läuft vor dem Handler des Vollbilds (window-capture vor
   *   document-bubble), sieht also verlässlich den Zustand *vor* dem Ereignis.
   *
   * Die Vorlagen-Auswahl hat deshalb bewusst **keinen eigenen** Listener,
   * sondern wird hier mitbehandelt – ein zweiter liefe in genau die Falle.
   */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || lightboxRef.current) return;
      if (ownPickerRef.current) setOwnPicker(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose, setOwnPicker]);

  async function run(action: () => Promise<StoredCharacter>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBusy(false);
    }
  }

  const generate = () =>
    run(async () => {
      const { imageData } = await generateImage(edited, imageStyle, {
        includeTraits,
        includeTextDetails,
        extraPrompt,
        referenceImages: referenceImage ? [referenceImage] : [],
      });
      return addCharacterImage(c.id, imageData);
    });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erlaubt erneutes Wählen derselben Datei
    if (!file) return;
    run(async () => addCharacterImage(c.id, await fileToDataUrl(file)));
  }

  function handleDelete(imageId: string) {
    if (!confirm("Dieses Bild wirklich löschen?")) return;
    run(() => deleteCharacterImage(c.id, imageId));
  }

  /**
   * Ein eigenes Bild als Vorlage übernehmen.
   *
   * Bewusst das **Original** über `getImage`, nicht das Thumbnail aus der
   * Kachel: das ist eine verlustbehaftete 640-px-WebP-Fassung, und das Modell
   * liest die Vorlage aus – Kompressionsartefakte deutet es als gewollte
   * Bildmerkmale (dieselbe Überlegung wie in `fileToReferenceDataUrl`).
   */
  async function chooseAsReference(imageId: string) {
    setOwnLoadingId(imageId);
    setError(null);
    try {
      setReferenceImage(await getImage(c.id, imageId));
      setOwnPicker(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bild laden fehlgeschlagen.");
    } finally {
      setOwnLoadingId(null);
    }
  }

  /** Original nachladen und im Vollbild zeigen. */
  async function openFull(imageId: string) {
    setLoadingId(imageId);
    setError(null);
    try {
      setLightbox(await getImage(c.id, imageId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bild laden fehlgeschlagen.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-70 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      // stopPropagation ist hier entscheidend: diese Ansicht wird innerhalb des
      // Detail-Modals gerendert, dessen Backdrop bei jedem Klick schließt. Ohne
      // das würde ein Klick zum Schließen der Bilder-Ansicht die Detailansicht
      // dahinter mitschließen.
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="my-8 w-full max-w-4xl rounded-xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            {`Bilder von ${edited.name || "diesem Charakter"}`}
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md px-2 py-1 text-foreground/60 transition hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Bilder-Ansicht schließen"
          >
            ✕
          </button>
        </div>
        <p className="mb-6 text-sm text-foreground/60">
          {c.images.length === 0
            ? "Noch keine Bilder."
            : `${c.images.length} ${c.images.length === 1 ? "Bild" : "Bilder"} – das primäre wird überall groß angezeigt.`}
        </p>

        {c.images.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {c.images.map((img) => (
              <div
                key={img.id}
                className={`flex flex-col overflow-hidden rounded-xl border transition ${
                  img.isPrimary
                    ? "border-foreground/60 ring-2 ring-foreground/20"
                    : "border-black/10 dark:border-white/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => openFull(img.id)}
                  disabled={loadingId !== null}
                  aria-label="Bild in voller Größe anzeigen"
                  className="relative aspect-square w-full cursor-zoom-in bg-black/[0.03] dark:bg-white/[0.03]"
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
                      🧑
                    </span>
                  )}
                  {img.isPrimary && (
                    <span className="absolute top-2 left-2 rounded-md bg-foreground px-2 py-0.5 text-xs font-medium text-background">
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
                  <span className="text-xs text-foreground/50">
                    {new Date(img.createdAt).toLocaleDateString("de-DE")}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => run(() => setPrimaryImage(c.id, img.id))}
                      disabled={busy || img.isPrimary}
                      className="flex-1 rounded-md border border-black/15 px-2 py-1 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/[0.06]"
                    >
                      {img.isPrimary ? "Primär ✓" : "Als primär"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(img.id)}
                      disabled={busy}
                      aria-label="Bild löschen"
                      className="rounded-md border border-red-500/40 px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-40 dark:text-red-400"
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
        <div className="border-t border-black/10 pt-5 dark:border-white/10">
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-foreground/60 uppercase">
            Neues Bild
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground/60">
                  Bild-Stil
                </span>
                <select
                  value={imageStyle}
                  onChange={(e) => setImageStyle(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
                >
                  {IMAGE_STYLES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <ReferenceImagePicker
                value={referenceImage}
                onChange={setReferenceImage}
                disabled={busy}
                // Nur anbieten, wenn es überhaupt etwas zu wählen gibt.
                onChooseOwn={
                  c.images.length > 0 ? () => setOwnPicker(true) : undefined
                }
              />

              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeTraits}
                    onChange={(e) => setIncludeTraits(e.target.checked)}
                    disabled={busy}
                    className="mt-0.5"
                  />
                  <span>
                    Merkmalstabelle einbeziehen (inkl. Persönlichkeit)
                    {referenceImage && includeTraits && (
                      <span className="mt-0.5 block text-xs text-foreground/50">
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
                    onChange={(e) => setIncludeTextDetails(e.target.checked)}
                    disabled={busy}
                    className="mt-0.5"
                  />
                  <span>Visuelle Details aus Fließtext miteinbeziehen</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground/60">
                  Zusätzliche Bild-Details (optional)
                </span>
                <textarea
                  value={extraPrompt}
                  onChange={(e) => setExtraPrompt(e.target.value)}
                  disabled={busy}
                  rows={4}
                  maxLength={1000}
                  placeholder="Zusätzlich fürs Bild berücksichtigen – z. B. Attribute, die nicht in der Tabelle oder Beschreibung stehen (Kleidung, Pose, Requisiten, Hintergrund …)"
                  className="w-full resize-y rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
                />
              </label>

              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "Einen Moment …" : "Bild erzeugen"}
              </button>

              <label
                className={`block w-full cursor-pointer rounded-md border border-black/15 px-4 py-2 text-center text-sm font-medium transition hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06] ${
                  busy ? "pointer-events-none opacity-50" : ""
                }`}
              >
                Bild hochladen
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={busy}
                />
              </label>

              <p className="text-xs text-foreground/50">
                Neue Bilder werden automatisch das Primärbild.
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </div>

      {/* Vorlagen-Auswahl unter den eigenen Bildern ---------------------- */}
      {ownPicker && (
        <div
          className="fixed inset-0 z-75 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          // Wie beim Backdrop der Bilder-Ansicht: ohne stopPropagation risse ein
          // Klick hier die Ebenen darunter mit.
          onClick={(e) => {
            e.stopPropagation();
            setOwnPicker(false);
          }}
        >
          <div
            className="my-8 w-full max-w-2xl rounded-xl border border-black/10 bg-background p-6 shadow-xl dark:border-white/15"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-start justify-between gap-4">
              <h3 className="text-lg font-semibold tracking-tight">
                Bild als Vorlage wählen
              </h3>
              <button
                type="button"
                onClick={() => setOwnPicker(false)}
                className="shrink-0 rounded-md px-2 py-1 text-foreground/60 transition hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Auswahl schließen"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 text-sm text-foreground/60">
              Das gewählte Bild fließt als Stil- und Motivvorlage in die nächste
              Erzeugung ein.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {c.images.map((img) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => chooseAsReference(img.id)}
                  disabled={ownLoadingId !== null}
                  className="relative aspect-square w-full overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] transition hover:border-foreground/50 disabled:opacity-60 dark:border-white/10 dark:bg-white/[0.03]"
                >
                  {img.thumbnail ? (
                    <Image
                      src={img.thumbnail}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-3xl opacity-30">
                      🧑
                    </span>
                  )}
                  {img.isPrimary && (
                    <span className="absolute top-1.5 left-1.5 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background">
                      Primär
                    </span>
                  )}
                  {ownLoadingId === img.id && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white">
                      Lade …
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <ImageLightbox
          src={lightbox}
          alt={edited.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
