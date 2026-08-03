"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { listScenarios } from "@/lib/client";
import {
  werkformLabel,
  type StoryArc,
  type VariantMeta,
} from "@/lib/schema";
import { primaryImage, type StoredScenario } from "@/lib/serialize";
import { genreLabel } from "@/lib/templates";
import { StoryReaderModal } from "../components/StoryReaderModal";

/**
 * **Bibliothek** – die lesefertigen Geschichten, unabhängig von Charakteren und
 * Szenarien an einem Ort. Das eigentliche Endprodukt der App: Erstellen läuft
 * über Szenarien, **Lesen** hier.
 *
 * Ein „Buch" ist eine **Story-Arc-Variante mit mindestens einem ausformulierten
 * Kapitel** (nicht-leerer `kapitel.text`) – nicht ein Szenario, denn ein Szenario
 * kann mehrere Arcs tragen. Der Buchtitel ist der Arc-Titel (`meta.titel`, sonst
 * „Arc N"), der Kontext der Szenario-Name; das Cover das Primär-Weltbild.
 *
 * Rein **abgeleitet** aus den Szenarien (`listScenarios` liefert die Arcs samt
 * Prosa) – keine eigene Persistenz, kein neues Backend. Ein Klick öffnet den
 * schon vorhandenen Buch-Reader mit dem bereits geladenen Arc.
 */

/** Ein lesefertiges Buch = eine Arc-Variante mit erzeugten Kapiteln. */
type Buch = {
  key: string;
  scenario: StoredScenario;
  arc: StoryArc;
  meta: VariantMeta;
  arcIndex: number;
  titel: string;
  kapitelGesamt: number;
  kapitelFertig: number;
};

const LEERE_META: VariantMeta = {
  titel: "",
  form: "",
  ton: "",
  favorit: false,
  quelle: "",
  modell: "",
  werkform: "",
  cover: "",
  alsBuch: false,
};

const controlClass =
  "rounded-md border border-border bg-card px-3 py-2 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50";

type SortKey = "titel-asc" | "titel-desc" | "kapitel-desc" | "szenario-asc";

const SORT_LABELS: Record<SortKey, string> = {
  "titel-asc": "Titel A–Z",
  "titel-desc": "Titel Z–A",
  "kapitel-desc": "Meiste Kapitel",
  "szenario-asc": "Szenario A–Z",
};

/** Kleinschreibung ohne Diakritika – wie in Galerie und Szenarien-Übersicht. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ß/g, "ss")
    .replace(/['’‘´`]/g, "")
    .toLowerCase();
}

/** Alle Bücher aus den Szenarien ableiten: je Arc-Variante mit Prosa eines. */
function buecherAus(scenarios: StoredScenario[]): Buch[] {
  return scenarios.flatMap((s) =>
    s.storyArcVariants.items
      .map((arc, i): Buch => {
        const alleKapitel = arc.stufen.flatMap((st) => st.kapitel);
        const fertig = alleKapitel.filter((k) => k.text.trim() !== "").length;
        const meta = s.storyArcVariants.meta[i] ?? LEERE_META;
        return {
          key: `${s.id}#${i}`,
          scenario: s,
          arc,
          meta,
          arcIndex: i,
          titel: meta.titel.trim() || `Arc ${i + 1}`,
          kapitelGesamt: alleKapitel.length,
          kapitelFertig: fertig,
        };
      })
      // Nur Bücher, die als Buch freigegeben **und** lesbar sind: Der Arc muss
      // ausdrücklich „Als Buch anzeigen" (`meta.alsBuch`) tragen und mindestens
      // ein ausformuliertes Kapitel haben. Ein frisch abgeleiteter Arc bleibt
      // sonst ein Arbeitsstand und füllt die Bibliothek nicht von selbst.
      .filter((b) => b.meta.alsBuch && b.kapitelFertig > 0),
  );
}

export default function LibraryPage() {
  const [scenarios, setScenarios] = useState<StoredScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("titel-asc");
  const [offen, setOffen] = useState<Buch | null>(null);

  useEffect(() => {
    listScenarios()
      .then(setScenarios)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Fehler beim Laden."),
      )
      .finally(() => setLoading(false));
  }, []);

  const buecher = useMemo(() => buecherAus(scenarios), [scenarios]);

  const sichtbar = useMemo(() => {
    const q = normalize(query.trim());
    const gefiltert = q
      ? buecher.filter((b) =>
          q
            .split(/\s+/)
            .every((teil) =>
              normalize(
                `${b.titel} ${b.scenario.name} ${genreLabel(
                  b.scenario.details.genre,
                )}`,
              ).includes(teil),
            ),
        )
      : buecher;
    const sortiert = [...gefiltert];
    sortiert.sort((a, b) => {
      switch (sort) {
        case "titel-desc":
          return b.titel.localeCompare(a.titel, "de");
        case "kapitel-desc":
          return (
            b.kapitelFertig - a.kapitelFertig ||
            a.titel.localeCompare(b.titel, "de")
          );
        case "szenario-asc":
          return (
            a.scenario.name.localeCompare(b.scenario.name, "de") ||
            a.titel.localeCompare(b.titel, "de")
          );
        default:
          return a.titel.localeCompare(b.titel, "de");
      }
    });
    return sortiert;
  }, [buecher, query, sort]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Bibliothek</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Die lesefertigen Geschichten – jede Story-Arc-Variante mit erzeugten
          Kapiteln als eigenes Buch. Ein Klick öffnet den Leser.
        </p>
      </div>

      {loading && <p className="text-muted-foreground">Lade Bibliothek …</p>}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && buecher.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Noch keine lesefertigen Geschichten. Leite in einem{" "}
          <Link href="/scenarios" className="underline">
            Szenario
          </Link>{" "}
          einen Story Arc ab und erzeuge zu den Kapiteln den Prosatext.
        </div>
      )}

      {buecher.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card p-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sortieren:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className={controlClass}
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
          </label>

          <div className="relative flex min-w-48 flex-1 items-center">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Suchen …"
              aria-label="Bibliothek durchsuchen (Titel, Szenario, Genre)"
              className={`${controlClass} w-full`}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Suche zurücksetzen"
                className="absolute right-2 text-muted-foreground transition hover:text-foreground"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      {buecher.length > 0 && sichtbar.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Kein Buch passt zur Suche.
        </div>
      )}

      {sichtbar.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-7 gap-y-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {sichtbar.map((b) => (
            <li key={b.key}>
              <BuchKarte buch={b} onOeffnen={() => setOffen(b)} />
            </li>
          ))}
        </ul>
      )}

      {offen && (
        <StoryReaderModal
          arc={offen.arc}
          titel={offen.titel}
          onClose={() => setOffen(null)}
        />
      )}
    </div>
  );
}

/**
 * Cover-Themen für Bücher **ohne** Weltbild – ein sattes, gebundenes Aussehen,
 * je Buch stabil (nach Genre gewählt, damit gleiche Welten gleich wirken).
 */
const COVER_THEMES = [
  "from-[#4a3b2a] to-[#291d12]", // Braunleder
  "from-[#3a4a3f] to-[#1c2620]", // Waldgrün
  "from-[#43354f] to-[#231a2c]", // Pflaume
  "from-[#4a2b2b] to-[#291616]", // Bordeaux
  "from-[#2f3a4a] to-[#161f2b]", // Marineblau
  "from-[#4a4227] to-[#282213]", // Olivgold
] as const;

/**
 * Das Cover-Thumbnail eines Buches: `meta.cover = "char:<id>"` → das
 * Porträt-Thumbnail dieses Charakters (aus der Szenario-Zusammenfassung), sonst
 * das Primär-Weltbild. Fällt zurück aufs Weltbild, wenn der Charakter fehlt oder
 * bildlos ist (z. B. gelöscht/nach Reload).
 */
function coverThumbnail(buch: Buch): string | null {
  const cv = buch.meta.cover ?? "";
  if (cv.startsWith("char:")) {
    const id = cv.slice(5);
    const c = buch.scenario.characters?.find((x) => x.id === id);
    if (c?.thumbnail) return c.thumbnail;
  }
  return primaryImage(buch.scenario)?.thumbnail ?? null;
}

function coverThema(schluessel: string): string {
  let h = 0;
  for (let i = 0; i < schluessel.length; i++) {
    h = (h * 31 + schluessel.charCodeAt(i)) >>> 0;
  }
  return COVER_THEMES[h % COVER_THEMES.length];
}

/**
 * Ein Item als **Buch mit Titelseite** (Apple-Books-Anmutung): hochkantes Cover
 * mit angedeutetem Buchrücken und Schatten, der **Titel auf dem Cover**; darunter
 * – wie im Bücherregal – Titel, Szenario und Fortschritt als schlichte Bildunterschrift.
 */
function BuchKarte({
  buch,
  onOeffnen,
}: {
  buch: Buch;
  onOeffnen: () => void;
}) {
  const cover = coverThumbnail(buch);
  const werkform =
    buch.meta.werkform && buch.meta.werkform !== "frei"
      ? werkformLabel(buch.meta.werkform)
      : "";
  const genre = genreLabel(buch.scenario.details.genre);
  const vollstaendig = buch.kapitelFertig === buch.kapitelGesamt;
  const thema = coverThema(buch.key);

  return (
    <button
      type="button"
      onClick={onOeffnen}
      title={`„${buch.titel}" lesen`}
      className="group block w-full text-left"
    >
      {/* Das Buch: hochkantes Cover mit Rücken und Schatten. */}
      <div
        className={`relative aspect-[2/3] w-full overflow-hidden rounded-r-md rounded-l-sm bg-gradient-to-br shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55)] ring-1 ring-black/20 transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_16px_30px_-8px_rgba(0,0,0,0.6)] ${thema}`}
      >
        {/* Weltbild als Cover-Kunst, sonst trägt der gebundene Farbverlauf. */}
        {cover && (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(min-width: 1024px) 190px, (min-width: 640px) 28vw, 45vw"
            className="object-cover opacity-90 transition group-hover:opacity-100"
            unoptimized
          />
        )}

        {/* Nur ein schmaler Verlauf **unten hinter dem Titel** – das Coverbild
            selbst bleibt unverdeckt (kein Schleier über der ganzen Fläche). */}
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Buchrücken: dunkler Streifen links + feiner Lichtkant. */}
        <span className="pointer-events-none absolute inset-y-0 left-0 w-[8%] min-w-[6px] bg-gradient-to-r from-black/45 to-transparent" />
        <span className="pointer-events-none absolute inset-y-0 left-[8%] min-w-px w-px bg-white/15" />

        {/* Zierrahmen – die typografische Anmutung einer Titelseite. */}
        <span className="pointer-events-none absolute inset-2.5 rounded-sm ring-1 ring-white/25" />

        {/* Werkform oben als kleine Kapitälchen-Zeile. */}
        {werkform && (
          <span className="absolute top-4 right-3 left-[14%] truncate text-center text-[9px] font-medium tracking-[0.2em] text-white/60 uppercase">
            {werkform}
          </span>
        )}

        {/* Favorit als kleines Eck-Zeichen. */}
        {buch.meta.favorit && (
          <span className="absolute top-2.5 right-2.5 text-sm drop-shadow" title="Favorit">
            ⭐
          </span>
        )}

        {/* Titel + Zierzeichen im unteren Drittel – die Titelseite. */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center px-3 pb-4 text-center">
          <span aria-hidden className="mb-1.5 text-[0.75rem] leading-none text-[#e9d9a8]/80">
            ❧
          </span>
          <span className="line-clamp-3 font-serif text-[0.8rem] leading-snug font-semibold text-[#fdf6e3] drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            {buch.titel}
          </span>
        </div>
      </div>

      {/* Bildunterschrift wie im Regal: Titel, Szenario, Fortschritt. */}
      <div className="mt-2.5 px-0.5">
        <p className="line-clamp-1 text-sm font-medium">{buch.titel}</p>
        <p className="truncate text-xs text-foreground/55">{buch.scenario.name}</p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-foreground/45">{genre}</span>
          <span
            className={
              vollstaendig
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-foreground/45"
            }
            title={
              vollstaendig
                ? "Alle Kapitel erzeugt"
                : "Teilweise erzeugt – die übrigen Kapitel fehlen noch"
            }
          >
            {buch.kapitelFertig}/{buch.kapitelGesamt} Kap.
          </span>
        </div>
      </div>
    </button>
  );
}
