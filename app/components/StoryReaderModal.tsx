"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { StoryArc } from "@/lib/schema";
import { useBackdropClose } from "./useBackdropClose";

/**
 * **Buch-Reader** für die erzeugten Kapitel eines Story Arcs.
 *
 * Reine Anzeige, ohne Ablenkung: die Kapitel des **aktiven** Arcs als
 * durchgehender Lesetext auf warmem Papier – Überschrift plus ausformulierte
 * Prosa je Kapitel, ohne die vielen Bedien-Elemente der Arc-Sektion. Die Akte
 * (Stationen) bleiben bewusst **unsichtbar**; gezeigt wird eine **flache**
 * Kapitelfolge.
 *
 * „Bereits erzeugt" heißt: nur Kapitel mit nicht-leerem `text`. Der Reader liest
 * den **Live-Stand** aus der Arc-Sektion, zeigt also auch gerade erzeugte, noch
 * nicht gespeicherte Kapitel.
 *
 * **Zwei Lesemodi**, oben dezent umschaltbar:
 * - *Blättern* (Default): seitenweise wie ein klassischer E-Book-Reader. Die Pagination
 *   nutzt CSS-Mehrspaltensatz (`column-width` = Seitenbreite, feste Höhe) – der
 *   Text fließt in nebeneinanderliegende Spalten, von denen genau **eine**
 *   sichtbar ist; „umblättern" verschiebt horizontal um eine Spaltenbreite. So
 *   bricht der Umbruch automatisch neu, wenn sich Fenster oder Schriftgröße
 *   ändern – ohne manuelles Ausmessen der Textmenge.
 * - *Fortlaufend*: das Papierblatt scrollt vertikal.
 *
 * Dazu eine **dezente Schriftgrößen-Steuerung** (A− / A+); alle Textmaße sind in
 * `em` relativ zur Wurzel-Schriftgröße, sodass eine Änderung alles mitzieht.
 *
 * Erste Overlay-Ebene über der Szenario-Detailseite (kein `backdrop-blur`-
 * Vorfahr), daher ein gewöhnlicher Esc-/Backdrop-Handler wie bei
 * `ScenarioImageModal`/`CharacterInputModal`. **Das Papier ist in beiden Themes
 * warm-cremefarben** (Sepia-Look) – der Sinn ist die Buch-Anmutung, nicht die
 * App-Oberfläche; nur der abdunkelnde Hintergrund passt sich an.
 */

/** Wählbare Basis-Schriftgrößen in px (Wurzelmaß des Lesetexts). */
const FONT_LEVELS = [15, 16.5, 18, 20, 22.5];
const DEFAULT_FONT = 1;
/** Spaltenabstand im Blätter-Modus (px); liegt im Umbruch, nicht im Blick. */
const GAP = 40;

/** Warm-cremefarbenes Papier – geteilt von beiden Modi. */
const PAPER =
  "bg-[#f7f0df] text-[#3a3325] shadow-2xl ring-1 ring-black/10";
const PAPER_BG = {
  backgroundImage:
    "radial-gradient(115% 130% at 50% 0%, #faf4e6 0%, #f5ecd8 100%)",
} as const;

export function StoryReaderModal({
  arc,
  titel,
  onClose,
}: {
  arc: StoryArc;
  /** Der Buchtitel – der Titel des aktiven Story Arcs. */
  titel: string;
  onClose: () => void;
}) {
  const [modus, setModus] = useState<"scroll" | "seite">("seite");
  const [fontIdx, setFontIdx] = useState(DEFAULT_FONT);
  const [seite, setSeite] = useState(0);
  const [seiten, setSeiten] = useState(1);
  const [masse, setMasse] = useState({ w: 0, h: 0 });

  const backdrop = useBackdropClose(onClose, { stopPropagation: true });
  const scrollRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Alle Kapitel mit Prosa, flach in Erzählreihenfolge (Akte unsichtbar).
  const kapitel = arc.stufen
    .flatMap((s) => s.kapitel)
    .filter((k) => k.text.trim() !== "");

  const fontPx = FONT_LEVELS[fontIdx];
  const kannKleiner = fontIdx > 0;
  const kannGroesser = fontIdx < FONT_LEVELS.length - 1;

  // Tastatur: Esc schließt immer; im Blätter-Modus blättern Pfeile/Leertaste.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (modus !== "seite") return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setSeite((p) => Math.min(p + 1, seiten - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setSeite((p) => Math.max(p - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, modus, seiten]);

  // Fortlaufend: beim Öffnen an den Buchanfang.
  useEffect(() => {
    if (modus === "scroll") scrollRef.current?.scrollTo?.(0, 0);
  }, [modus]);

  // Blätter-Modus, Schritt 1: Viewport-Maße lesen (Spalten = Seitenmaße).
  useLayoutEffect(() => {
    if (modus !== "seite") return;
    const lesen = () => {
      const vp = viewportRef.current;
      if (!vp) return;
      setMasse({ w: Math.floor(vp.clientWidth), h: Math.floor(vp.clientHeight) });
    };
    lesen();
    const ro = new ResizeObserver(lesen);
    if (viewportRef.current) ro.observe(viewportRef.current);
    window.addEventListener("resize", lesen);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", lesen);
    };
  }, [modus]);

  // Blätter-Modus, Schritt 2: sobald die Spalten stehen (Maße gesetzt, Font
  // angewandt), die Gesamtzahl der Seiten aus der Breite des Spaltensatzes.
  useLayoutEffect(() => {
    if (modus !== "seite" || masse.w === 0) return;
    const ct = contentRef.current;
    if (!ct) return;
    const gesamt = ct.scrollWidth;
    const anzahl = Math.max(1, Math.round((gesamt + GAP) / (masse.w + GAP)));
    setSeiten(anzahl);
    setSeite((p) => Math.min(p, anzahl - 1));
  }, [modus, masse.w, masse.h, fontIdx]);

  function blaettern(ziel: number) {
    setSeite(Math.max(0, Math.min(ziel, seiten - 1)));
  }

  function modusWechseln() {
    setModus((m) => (m === "scroll" ? "seite" : "scroll"));
    setSeite(0);
  }

  // Der Buchinhalt – identisch in beiden Modi, nur anders eingefasst.
  const inhalt =
    kapitel.length === 0 ? (
      <p className="text-center text-[#8a7c5c] italic">
        Für diesen Story Arc wurde noch kein Kapitel ausformuliert.
      </p>
    ) : (
      <>
        {/* Titelei */}
        <header className="mb-10 break-inside-avoid text-center sm:mb-14">
          <h1 className="text-[1.95em] leading-tight font-semibold tracking-wide text-[#2c2618]">
            {titel}
          </h1>
          <div className="mx-auto mt-5 flex items-center justify-center gap-3 text-[#a8946a]">
            <span className="h-px w-12 bg-current" />
            <span aria-hidden className="text-[1.15em]">
              ❧
            </span>
            <span className="h-px w-12 bg-current" />
          </div>
          <p className="mt-4 text-[0.8em] tracking-wide text-[#8a7c5c] italic">
            {kapitel.length === 1 ? "1 Kapitel" : `${kapitel.length} Kapitel`}
          </p>
        </header>

        {kapitel.map((k, i) => (
          <section key={i} className={i > 0 ? "mt-14 sm:mt-16" : ""}>
            {i > 0 && (
              <div
                aria-hidden
                className="mb-12 break-inside-avoid text-center text-[1.15em] text-[#c2b083] select-none sm:mb-14"
              >
                ✦ ✦ ✦
              </div>
            )}

            <h2 className="mb-7 break-inside-avoid break-after-avoid text-center text-[1.5em] font-semibold tracking-wide text-[#2c2618]">
              {k.titel.trim() || `Kapitel ${i + 1}`}
            </h2>

            {absaetze(k.text).map((absatz, j) => (
              <p
                key={j}
                lang="de"
                className={`text-justify leading-[1.75] hyphens-auto ${
                  j > 0 ? "mt-4" : ""
                } ${
                  j === 0
                    ? "first-letter:mr-1 first-letter:float-left first-letter:text-[3em] first-letter:leading-[0.8] first-letter:font-semibold first-letter:text-[#5a4a2a]"
                    : ""
                }`}
              >
                {absatz}
              </p>
            ))}
          </section>
        ))}

        {kapitel.length > 0 && (
          <div
            aria-hidden
            className="mt-14 break-inside-avoid text-center text-[1.15em] text-[#c2b083] select-none sm:mt-16"
          >
            ❦
          </div>
        )}
      </>
    );

  return (
    <div
      {...backdrop}
      ref={scrollRef}
      className={`fixed inset-0 z-70 bg-stone-950/80 backdrop-blur-sm ${
        modus === "scroll"
          ? "overflow-y-auto p-3 sm:p-6"
          : "flex items-center justify-center overflow-hidden p-3 sm:p-6"
      }`}
    >
      {/* Dezente Steuerung oben links: Schriftgröße + Modus. Schwebend über dem
          Hintergrund, damit das Papier ruhig bleibt. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed top-3 left-3 z-10 flex items-center gap-1 rounded-full bg-black/30 px-1.5 py-1 text-stone-100 backdrop-blur-sm sm:top-5 sm:left-5"
      >
        <button
          onClick={() => setFontIdx((i) => Math.max(0, i - 1))}
          disabled={!kannKleiner}
          className="rounded-full px-2 py-1 text-sm transition hover:bg-white/15 disabled:opacity-40"
          aria-label="Schrift kleiner"
          title="Schrift kleiner"
        >
          A<span className="text-xs">−</span>
        </button>
        <button
          onClick={() => setFontIdx((i) => Math.min(FONT_LEVELS.length - 1, i + 1))}
          disabled={!kannGroesser}
          className="rounded-full px-2 py-1 text-base transition hover:bg-white/15 disabled:opacity-40"
          aria-label="Schrift größer"
          title="Schrift größer"
        >
          A<span className="text-xs">+</span>
        </button>
        <span className="mx-0.5 h-4 w-px bg-white/25" />
        <button
          onClick={modusWechseln}
          className="rounded-full px-2.5 py-1 text-sm transition hover:bg-white/15"
          title={
            modus === "scroll"
              ? "Seitenweise blättern wie ein E-Book"
              : "Fortlaufend scrollen"
          }
        >
          {modus === "scroll" ? "📖 Blättern" : "📜 Fortlaufend"}
        </button>
      </div>

      {/* Schließen – schwebend, immer erreichbar. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="fixed top-3 right-3 z-10 rounded-full bg-black/30 px-3 py-1.5 text-sm text-stone-100 backdrop-blur-sm transition hover:bg-black/50 sm:top-5 sm:right-5"
        aria-label="Schließen"
        title="Schließen (Esc)"
      >
        ✕ Schließen
      </button>

      {modus === "scroll" ? (
        <article
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: fontPx, ...PAPER_BG }}
          className={`mx-auto my-6 max-w-3xl rounded-sm px-7 py-12 font-serif sm:my-10 sm:px-16 sm:py-16 ${PAPER}`}
        >
          {inhalt}
        </article>
      ) : (
        <>
          <div
            onClick={(e) => e.stopPropagation()}
            style={PAPER_BG}
            className={`flex h-[calc(100dvh-4.5rem)] max-h-[52rem] w-full max-w-3xl flex-col rounded-sm px-7 py-10 font-serif sm:px-16 sm:py-12 ${PAPER}`}
          >
            {/* Clipping-Viewport: zeigt genau eine Spalte (= eine Seite). */}
            <div ref={viewportRef} className="relative flex-1 overflow-hidden">
              <div
                ref={contentRef}
                style={{
                  fontSize: fontPx,
                  height: masse.h || "100%",
                  width: masse.w || "100%",
                  columnWidth: masse.w ? `${masse.w}px` : undefined,
                  columnGap: `${GAP}px`,
                  columnFill: "auto",
                  transform: `translateX(-${seite * (masse.w + GAP)}px)`,
                  transition: "transform 350ms cubic-bezier(0.22, 0.61, 0.36, 1)",
                }}
              >
                {inhalt}
              </div>
            </div>

            {/* Seitenzähler unten auf dem Papier. */}
            <div className="mt-3 shrink-0 text-center text-[0.8rem] tracking-wide text-[#a8946a]">
              {seite + 1} / {seiten}
            </div>
          </div>

          {/* Blätter-Pfeile an den Rändern. */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              blaettern(seite - 1);
            }}
            disabled={seite === 0}
            aria-label="Zurückblättern"
            className="fixed top-1/2 left-1 z-10 -translate-y-1/2 rounded-full bg-black/25 px-3 py-4 text-xl text-stone-100 backdrop-blur-sm transition hover:bg-black/45 disabled:pointer-events-none disabled:opacity-25 sm:left-4"
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              blaettern(seite + 1);
            }}
            disabled={seite >= seiten - 1}
            aria-label="Weiterblättern"
            className="fixed top-1/2 right-1 z-10 -translate-y-1/2 rounded-full bg-black/25 px-3 py-4 text-xl text-stone-100 backdrop-blur-sm transition hover:bg-black/45 disabled:pointer-events-none disabled:opacity-25 sm:right-4"
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Prosatext in Absätze zerlegen. Die erzeugte Prosa trennt Absätze mal durch
 * Leerzeilen, mal durch einfache Umbrüche – beides ergibt hier je einen Absatz.
 * Leere Zeilen fallen weg.
 */
function absaetze(text: string): string[] {
  return text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}
