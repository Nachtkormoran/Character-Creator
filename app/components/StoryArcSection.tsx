"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import {
  ARC_FORMATS,
  ARC_LENGTHS,
  ARC_PHASES,
  KAPITEL_COUNTS,
  KAPITEL_TRENNER,
  MAX_ARC_STUFEN,
  MAX_KAPITEL_PRO_STUFE,
  KAPITEL_LAENGEN,
  splitKapitelSegmente,
  STORY_FORMS,
  STORY_TONES,
  TEXT_PROVIDERS,
  WERKFORMEN,
  variantBadge,
  werkformLabel,
  werkformPresets,
  type ArcFormat,
  type ArcLength,
  type ArcPhase,
  type KapitelCount,
  type KapitelLaenge,
  type StoryArc,
  type StoryForm,
  type StoryTone,
  type TextProvider,
  type VariantMeta,
  type Werkform,
} from "@/lib/schema";
import { AutoTextarea } from "./AutoTextarea";
import { StoryReaderModal } from "./StoryReaderModal";
import {
  BookOpen,
  BookText,
  ChevronDown,
  ChevronUp,
  Copy,
  Images,
  Library,
  ListTree,
  Mountain,
  Pencil,
  Plus,
  Sparkles,
  Star,
  User,
  X,
} from "./ui/icons";

/**
 * Der **Story Arc** eines Szenarios – die dramaturgische Zerlegung des aktiven
 * Handlungsentwurfs in eine geordnete Folge von Stationen, dargestellt als
 * vertikale Zeitleiste von Karten. Jede Station lässt sich vollständig
 * bearbeiten (Phase, Titel, Beschreibung, Figuren), umsortieren, löschen und um
 * **Kapitel** ergänzen; neue Stationen lassen sich einfügen.
 *
 * Bewusst **präsentierend**, wie `ScenarioFields`: Die Komponente kennt kein
 * `fetch`. Sie zeigt den Arc, meldet alle Bearbeitungen über `onChange` und die
 * beiden KI-Wünsche (Arc ableiten, Kapitel je Station) über `onAbleiten` /
 * `onKapitelAbleiten`. Erzeugen, Speichern und Verwerfen liegen in der Seite
 * (`scenarios/[id]`), die den Arc in ihren Bearbeitungs-Zustand einreiht.
 *
 * Die **Farbfolge der Phasen ist Struktur, keine Deko**. Die Klassen stehen als
 * Literale in der Tabelle unten, damit Tailwind sie erzeugt (dynamisch
 * zusammengesetzte Klassen würde der JIT nicht sehen).
 */
const PHASE_STYLE: Record<ArcPhase, { dot: string; chip: string }> = {
  exposition: {
    dot: "bg-[#607089] dark:bg-[#93a3bb]",
    chip: "text-[#607089] dark:text-[#93a3bb] border-[#607089]/30 bg-[#607089]/10 dark:border-[#93a3bb]/30 dark:bg-[#93a3bb]/10",
  },
  steigerung: {
    dot: "bg-[#c2740a] dark:bg-[#f0a531]",
    chip: "text-[#c2740a] dark:text-[#f0a531] border-[#c2740a]/30 bg-[#c2740a]/10 dark:border-[#f0a531]/30 dark:bg-[#f0a531]/10",
  },
  hoehepunkt: {
    dot: "bg-[#d8375f] dark:bg-[#fb7392]",
    chip: "text-[#d8375f] dark:text-[#fb7392] border-[#d8375f]/30 bg-[#d8375f]/10 dark:border-[#fb7392]/30 dark:bg-[#fb7392]/10",
  },
  fall: {
    dot: "bg-[#7256c9] dark:bg-[#ab92f2]",
    chip: "text-[#7256c9] dark:text-[#ab92f2] border-[#7256c9]/30 bg-[#7256c9]/10 dark:border-[#ab92f2]/30 dark:bg-[#ab92f2]/10",
  },
  aufloesung: {
    dot: "bg-[#0f8a63] dark:bg-[#37c795]",
    chip: "text-[#0f8a63] dark:text-[#37c795] border-[#0f8a63]/30 bg-[#0f8a63]/10 dark:border-[#37c795]/30 dark:bg-[#37c795]/10",
  },
};

/** Kleiner quadratischer Icon-Knopf (hoch/runter/entfernen) – gleiche Optik überall. */
const MINI_BTN =
  "inline-flex size-6 items-center justify-center rounded text-muted-foreground transition hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent";

/** Knopf im Feld-/Kopfstil – gleiche Höhe und Rand wie in `ScenarioFields`. */
const CHIP_BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-50";

export function StoryArcSection({
  storyArc,
  onChange,
  onAbleiten,
  busy,
  error,
  params,
  onParamsChange,
  onKapitelAbleiten,
  kapitelBusy,
  kapitelError,
  onKapitelText,
  kapitelTextBusy,
  kapitelTextError,
  disabled,
  handlung,
  quelleLabel,
  arcs,
  arcAktiv,
  arcMeta,
  onArcWaehlen,
  onArcTitelAendern,
  onArcTitelNeu,
  arcTitelBusy,
  onArcFavorit,
  onArcKopieren,
  onArcLoeschen,
  onAlleArcsLoeschen,
  coverCharaktere,
  onArcCover,
  onArcAlsBuch,
  weltbild,
  showModel,
  kapitelModell,
  storyTextModell,
  provider,
  onProviderChange,
}: {
  storyArc: StoryArc;
  onChange: (arc: StoryArc) => void;
  onAbleiten: () => void;
  busy: boolean;
  error: string | null;
  /** Alle Lauf-Parameter der Arc-/Kapitel-Erzeugung – nicht gespeichert. */
  params: {
    werkform: Werkform;
    laenge: ArcLength;
    format: ArcFormat;
    zusatz: string;
    kreativ: boolean;
    weiterspinnen: boolean;
    kapitelAnzahl: KapitelCount;
    kapitelLaenge: KapitelLaenge;
    ton: StoryTone;
    form: StoryForm;
  };
  onParamsChange: (p: {
    werkform: Werkform;
    laenge: ArcLength;
    format: ArcFormat;
    zusatz: string;
    kreativ: boolean;
    weiterspinnen: boolean;
    kapitelAnzahl: KapitelCount;
    kapitelLaenge: KapitelLaenge;
    ton: StoryTone;
    form: StoryForm;
  }) => void;
  /** Kapitel für die Station am Index ableiten. */
  onKapitelAbleiten: (stufeIndex: number) => void;
  /** Welche Station gerade Kapitel erzeugt (für Beschriftung/Sperre). */
  kapitelBusy: number | null;
  /** Fehler der Kapitel-Erzeugung, samt betroffener Station. */
  kapitelError: { index: number; text: string } | null;
  /** Den **Prosatext** eines Kapitels erzeugen (Station-, Kapitel-Index). */
  onKapitelText: (stufeIndex: number, kapitelIndex: number) => void;
  /** Welches Kapitel gerade seinen Prosatext erzeugt. */
  kapitelTextBusy: { stufe: number; kapitel: number } | null;
  /** Fehler der Prosatext-Erzeugung, samt betroffenem Kapitel. */
  kapitelTextError: { stufe: number; kapitel: number; text: string } | null;
  /** Gesperrt, während gespeichert wird. */
  disabled: boolean;
  /** Der aktive Handlungsentwurf – ohne ihn lässt sich nichts ableiten. */
  handlung: string;
  /** Etikett des Entwurfs, aus dem abgeleitet wird (z. B. „Entwurf 2"). */
  quelleLabel: string;
  /**
   * Alle Story Arcs im aktuellen (womöglich ungespeicherten) Stand – die aktive
   * Zelle ist `storyArc`. Für die Reiter-Leiste; sie erscheint ab zwei Arcs.
   */
  arcs: StoryArc[];
  /** Index des aktiven Arcs in `arcs`. */
  arcAktiv: number;
  /** Anzeige-Metadaten je Arc (Titel, Erzählform, Ton), index-gleich zu `arcs`. */
  arcMeta: VariantMeta[];
  /** Auf einen anderen Arc umschalten. */
  onArcWaehlen: (i: number) => void;
  /** Den Titel eines Arcs ändern (✎ am aktiven Reiter). */
  onArcTitelAendern: (i: number) => void;
  /** Einen **neuen** Titel per KI erzeugen (✨ am aktiven Reiter). */
  onArcTitelNeu: (i: number) => void;
  /** Welcher Arc gerade einen neuen Titel erzeugt (Index) – für Sperre/Spinner. */
  arcTitelBusy?: number | null;
  /** Einen Arc als Favorit markieren/entmarken (Stern am Reiter). */
  onArcFavorit: (i: number) => void;
  /** Einen Arc kopieren (eigenständige Kopie, angehängt). */
  onArcKopieren: (i: number) => void;
  /** Einen Arc löschen (nur ab zwei möglich). */
  onArcLoeschen: (i: number) => void;
  /** Alle Arcs auf einmal löschen. */
  onAlleArcsLoeschen: () => void;
  /**
   * Charaktere des Szenarios – für den **Cover-Picker** eines Buches. Als Cover
   * wählbar sind das Weltbild (Standard) oder das Porträt eines dieser Charaktere.
   */
  coverCharaktere: {
    id: string;
    name: string;
    thumbnail: string | null;
    isProtagonist: boolean;
  }[];
  /** Das Cover des Arcs `i` setzen (`""` = Weltbild, `"char:<id>"` = Porträt). */
  onArcCover: (i: number, cover: string) => void;
  /**
   * Den Arc `i` als Buch in der Bibliothek an-/abwählen (`meta.alsBuch`). Erst
   * wenn dies an ist **und** der Arc Prosa hat, erscheint er unter `/library`.
   */
  onArcAlsBuch: (i: number, alsBuch: boolean) => void;
  /** Primär-Weltbild-Thumbnail des Szenarios – Vorschau der „Weltbild"-Kachel im Cover-Picker. */
  weltbild?: string | null;
  /**
   * Einstellung „Verwendetes Modell anzeigen". Bei `true` wird bei Arc,
   * Kapitel-Ableitung und Kapitel-Prosa das erzeugende Modell mit angezeigt.
   */
  showModel?: boolean;
  /** Transiente Modell-Anzeige der Kapitel-Ableitung je Station (Index → Modell). */
  kapitelModell?: Record<number, string>;
  /** Transiente Modell-Anzeige der Kapitel-Prosa, Schlüssel `"stufe-kapitel"`. */
  storyTextModell?: Record<string, string>;
  /**
   * Modell-Anbieter für Arc, Kapitel und Prosa – **pro Aufruf** wählbar. `""` =
   * „Standard laut Einstellungen" (Modell je Story-Erzeugung bzw. das globale
   * Textmodell); ein konkreter Anbieter (`TEXT_PROVIDERS`-Wert) übersteuert nur
   * diese Erzeugungen.
   */
  provider: TextProvider | "";
  onProviderChange: (p: TextProvider | "") => void;
}) {
  const stufen = storyArc.stufen;
  const hatArc = stufen.length > 0;
  const kannAbleiten = handlung.trim().length > 0 && !busy && !disabled;
  const kannHinzufuegen = stufen.length < MAX_ARC_STUFEN;

  // Master-Detail: welche Station gerade **ausgearbeitet** wird. Die Leiste zeigt
  // alle Akte kompakt, rechts steht nur die gewählte – so bleibt die Sektion
  // kurz, egal wie ausgearbeitet der Arc ist. Der Index wird auf die aktuelle
  // Länge geklemmt (nach Löschen/Arc-Wechsel bleibt er gültig).
  const [gewaehlteStufe, setGewaehlteStufe] = useState(0);
  const sel = stufen.length ? Math.min(gewaehlteStufe, stufen.length - 1) : 0;
  /** Fortschritt einer Station: „done" = alle Kapitel mit Prosa, „teil" = Kapitel
   * abgeleitet aber Prosa unvollständig, „offen" = noch keine Kapitel. */
  function stufeStatus(s: StoryArc["stufen"][number]): "done" | "teil" | "offen" {
    const kap = s.kapitel.length;
    if (kap === 0) return "offen";
    const prosa = s.kapitel.filter((k) => k.text.trim() !== "").length;
    return prosa === kap ? "done" : "teil";
  }

  // Buch-Reader: offen/zu, und ob es überhaupt etwas zu lesen gibt (mindestens
  // ein Kapitel mit ausformuliertem Prosatext im aktiven Arc). Der Buchtitel ist
  // der Titel des aktiven Arcs – mit demselben Rückfall wie in der Reiter-Leiste.
  const [readerOffen, setReaderOffen] = useState(false);
  const hatLesbareKapitel = stufen.some((s) =>
    s.kapitel.some((k) => k.text.trim() !== ""),
  );
  const buchTitel = arcMeta[arcAktiv]?.titel?.trim() || `Arc ${arcAktiv + 1}`;

  // Cover-Picker des aktiven Arcs: offen/zu, aktueller Wert und ein Label dafür.
  const [coverOffen, setCoverOffen] = useState(false);
  const aktivesCover = arcMeta[arcAktiv]?.cover ?? "";
  const coverCharakter = aktivesCover.startsWith("char:")
    ? coverCharaktere.find((c) => c.id === aktivesCover.slice(5))
    : undefined;
  const coverLabel = coverCharakter ? coverCharakter.name : "Weltbild";
  const aktivAlsBuch = arcMeta[arcAktiv]?.alsBuch ?? false;

  // Welche Kapitel-Prosatexte ausgeklappt sind, nach „Station.Kapitel"-Schlüssel.
  // Rein darstellend – der Text selbst lebt im Arc, nicht hier.
  const [offeneTexte, setOffeneTexte] = useState<Set<string>>(
    () => new Set(),
  );
  const textKey = (i: number, ki: number) => `${i}.${ki}`;
  const textOffen = (i: number, ki: number) => offeneTexte.has(textKey(i, ki));
  const textUmschalten = (i: number, ki: number) =>
    setOffeneTexte((s) => {
      const n = new Set(s);
      const k = textKey(i, ki);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const textOeffnen = (i: number, ki: number) =>
    setOffeneTexte((s) => new Set(s).add(textKey(i, ki)));

  // --- Stufen-Mutationen (alle über onChange) -----------------------------
  function stufeAendern(i: number, patch: Partial<StoryArc["stufen"][number]>) {
    onChange({
      stufen: stufen.map((s, k) => (k === i ? { ...s, ...patch } : s)),
    });
  }
  function stufeLoeschen(i: number) {
    onChange({ stufen: stufen.filter((_, k) => k !== i) });
  }
  function stufeVerschieben(i: number, richtung: -1 | 1) {
    const j = i + richtung;
    if (j < 0 || j >= stufen.length) return;
    const next = stufen.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ stufen: next });
  }
  // Aus dem Detail heraus verschoben: die Auswahl wandert mit der Station mit,
  // damit das Detail nicht plötzlich eine andere Station zeigt.
  function stufeVerschiebenUndFolgen(richtung: -1 | 1) {
    const j = sel + richtung;
    if (j < 0 || j >= stufen.length) return;
    stufeVerschieben(sel, richtung);
    setGewaehlteStufe(j);
  }
  function stufeHinzufuegen() {
    if (!kannHinzufuegen) return;
    // Neue Station erbt die Phase der letzten (Kontinuität am Ende der Kurve);
    // bei leerem Arc beginnt sie bei der Exposition.
    const phase: ArcPhase = stufen.length
      ? stufen[stufen.length - 1].phase
      : "exposition";
    onChange({
      stufen: [
        ...stufen,
        { titel: "", phase, beschreibung: "", figuren: [], kapitel: [] },
      ],
    });
  }
  function figurEntfernen(i: number, k: number) {
    stufeAendern(i, {
      figuren: stufen[i].figuren.filter((_, x) => x !== k),
    });
  }

  /** DOM-`id` des Beschreibungsfelds der Station `i` (für das Einfügen am Cursor). */
  const stufeFeldId = (i: number) => `arc-stufe-beschr-${i}`;

  /**
   * Eine Kapitelgrenze (`---`) **an der Cursorposition** in die Stationsbeschreibung
   * einfügen. Der Trenner muss auf einer eigenen Zeile stehen, daher werden nur
   * dort Umbrüche ergänzt, wo noch keiner ist. Der Cursor landet hinter dem
   * eingefügten Trenner; eine etwaige Auswahl bleibt unangetastet (Einfügen an
   * ihrem Anfang).
   */
  function kapitelgrenzeEinfuegen(i: number) {
    if (disabled) return;
    const feld = document.getElementById(
      stufeFeldId(i),
    ) as HTMLTextAreaElement | null;
    const text = stufen[i].beschreibung;
    const pos = feld?.selectionStart ?? text.length;
    const davor = text.slice(0, pos);
    const danach = text.slice(pos);
    const nlDavor = davor.length > 0 && !davor.endsWith("\n");
    const nlDanach = danach.length > 0 && !danach.startsWith("\n");
    const einschub = `${nlDavor ? "\n" : ""}${KAPITEL_TRENNER}${nlDanach ? "\n" : ""}`;
    stufeAendern(i, { beschreibung: davor + einschub + danach });
    // Nach dem Re-Render Fokus und Cursor hinter den Trenner setzen.
    const neuePos = davor.length + einschub.length;
    requestAnimationFrame(() => {
      const f = document.getElementById(
        stufeFeldId(i),
      ) as HTMLTextAreaElement | null;
      if (f) {
        f.focus();
        f.setSelectionRange(neuePos, neuePos);
      }
    });
  }

  // --- Kapitel-Mutationen -------------------------------------------------
  function kapitelSetzen(i: number, kapitel: StoryArc["stufen"][number]["kapitel"]) {
    stufeAendern(i, { kapitel });
  }
  function kapitelAendern(
    i: number,
    k: number,
    patch: Partial<StoryArc["stufen"][number]["kapitel"][number]>,
  ) {
    kapitelSetzen(
      i,
      stufen[i].kapitel.map((c, x) => (x === k ? { ...c, ...patch } : c)),
    );
  }
  function kapitelLoeschen(i: number, k: number) {
    kapitelSetzen(
      i,
      stufen[i].kapitel.filter((_, x) => x !== k),
    );
  }
  function kapitelVerschieben(i: number, k: number, richtung: -1 | 1) {
    const arr = stufen[i].kapitel;
    const j = k + richtung;
    if (j < 0 || j >= arr.length) return;
    const next = arr.slice();
    [next[k], next[j]] = [next[j], next[k]];
    kapitelSetzen(i, next);
  }
  function kapitelHinzufuegen(i: number) {
    if (stufen[i].kapitel.length >= MAX_KAPITEL_PRO_STUFE) return;
    kapitelSetzen(i, [...stufen[i].kapitel, { titel: "", inhalt: "", text: "" }]);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Story Arc
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {hatArc
              ? `Dramaturgische Zerlegung – abgeleitet aus ${quelleLabel}.`
              : "Die dramaturgische Zerlegung des Handlungsentwurfs in Stationen."}
          </p>
          {/* Buch-Knöpfe: lesen (nur bei Prosa) und Cover wählen (bei jedem Arc). */}
          {hatArc && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {hatLesbareKapitel && (
                <button
                  type="button"
                  onClick={() => setReaderOffen(true)}
                  title="Die erzeugten Kapitel ablenkungsfrei als Buch lesen"
                  className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
                >
                  <BookOpen size={15} strokeWidth={1.75} aria-hidden="true" />
                  Als Buch lesen
                </button>
              )}
              <button
                type="button"
                onClick={() => setCoverOffen((o) => !o)}
                disabled={disabled || busy}
                title="Titelbild dieses Buches in der Bibliothek wählen (Weltbild oder ein Charakterporträt)"
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
              >
                <Images size={15} strokeWidth={1.75} aria-hidden="true" />
                Cover: {coverLabel}
              </button>
              {/* Ob dieser Arc überhaupt als Buch in der Bibliothek erscheint –
                  Default aus. Ein frisch abgeleiteter Arc ist ein Arbeitsstand. */}
              <label
                title="Diesen Story Arc als Buch in der Bibliothek anzeigen (nur mit mindestens einem ausformulierten Kapitel)"
                className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={aktivAlsBuch}
                  disabled={disabled || busy}
                  onChange={(e) => onArcAlsBuch(arcAktiv, e.target.checked)}
                  className="h-4 w-4 accent-current disabled:opacity-50"
                />
                <Library size={15} strokeWidth={1.75} aria-hidden="true" />
                In Bibliothek
              </label>
            </div>
          )}
        </div>

        {/* Parameter + Ableiten-Knopf. Wirken nur auf die Arc-Erzeugung. Jeder
            Selektor trägt eine sichtbare Beschriftung; das `<label>` umschließt
            das Feld, daher braucht es kein `aria-label` (die Beschriftung ist
            der Name). Die Feinheiten stehen weiter im `title`. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/*
            Werkform – die **führende** Einstellung: belegt beim Wählen Länge,
            Kapitel je Station und Kapitellänge vor (die bleiben danach frei) und
            prägt zusätzlich live den Prosastil (verdichtet ↔ ausladend).
          */}
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Werkform:
            <select
              value={params.werkform}
              onChange={(e) => {
                const w = e.target.value as Werkform;
                const p = werkformPresets(w);
                onParamsChange(
                  p
                    ? {
                        ...params,
                        werkform: w,
                        laenge: p.laenge,
                        kapitelAnzahl: p.kapitelAnzahl,
                        kapitelLaenge: p.kapitelLaenge,
                      }
                    : { ...params, werkform: w },
                );
              }}
              disabled={disabled || busy}
              title="Führende Einstellung: Kurzgeschichte/Novelle/Roman belegt Länge, Kapitel je Station und Kapitellänge vor und prägt den Prosastil (verdichtet ↔ ausladend). Die Zahlen bleiben danach frei justierbar. „— frei —“ = keine Vorgabe."
              className={`${CHIP_BTN} bg-card`}
            >
              {WERKFORMEN.map((w) => (
                <option key={w.value} value={w.value}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Länge:
            <select
              value={params.laenge}
              onChange={(e) =>
                onParamsChange({ ...params, laenge: e.target.value as ArcLength })
              }
              disabled={disabled || busy}
              title="Wie viele Stationen (Akte) der Arc hat – die Dramaturgie, nicht die Gesamtlänge. Von der Werkform vorbelegt, danach frei."
              className={`${CHIP_BTN} bg-card`}
            >
              {ARC_LENGTHS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Format:
            <select
              value={params.format}
              onChange={(e) =>
                onParamsChange({ ...params, format: e.target.value as ArcFormat })
              }
              disabled={disabled || busy}
              title="Erzählabschnitte (Buch) oder spielbare Szenen (Spiel)"
              className={`${CHIP_BTN} bg-card`}
            >
              {ARC_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Erzählform:
            <select
              value={params.form}
              onChange={(e) =>
                onParamsChange({ ...params, form: e.target.value as StoryForm })
              }
              disabled={disabled || busy}
              title="Die Art der Geschichte (Krimi, Liebe, Abenteuer …) – gilt für Arc und Kapitel und prägt deren Aufbau, unabhängig vom Genre der Welt. „Allround“ = gemischt wie bisher."
              className={`${CHIP_BTN} bg-card`}
            >
              {STORY_FORMS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Ton:
            <select
              value={params.ton}
              onChange={(e) =>
                onParamsChange({ ...params, ton: e.target.value as StoryTone })
              }
              disabled={disabled || busy}
              title="Ton und Sprache – gilt für Arc und Kapitel und nimmt den Ton der späteren Geschichte vorweg"
              className={`${CHIP_BTN} bg-card`}
            >
              {STORY_TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Kapitellänge:
            <select
              value={params.kapitelLaenge}
              onChange={(e) =>
                onParamsChange({
                  ...params,
                  kapitelLaenge: e.target.value as KapitelLaenge,
                })
              }
              disabled={disabled || busy}
              title="Wie viel Prosa „Story generieren“ je Kapitel schreibt – entkoppelt vom Kreativ-Haken. Von der Werkform vorbelegt, danach frei."
              className={`${CHIP_BTN} bg-card`}
            >
              {KAPITEL_LAENGEN.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {/*
            Modell-Anbieter **für diesen Arc** – gilt für das Ableiten des Arcs,
            die Kapitelableitung und die Story-Erzeugung. „Standard" folgt der
            Einstellungsseite (Modell je Story-Erzeugung bzw. das globale
            Textmodell); ein konkreter Anbieter übersteuert nur diese Erzeugungen
            und wird nicht gespeichert.
          */}
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Modell:
            <select
              value={provider}
              onChange={(e) =>
                onProviderChange(e.target.value as TextProvider | "")
              }
              disabled={disabled || busy}
              title="Welches Textmodell Story Arc, Kapitel und Story-Prosa erzeugt. „Standard&quot; folgt der Einstellungsseite; die Wahl hier gilt nur für diese Erzeugungen und wird nicht gespeichert."
              className={`${CHIP_BTN} bg-card`}
            >
              <option value="">Standard (Einstellungen)</option>
              {TEXT_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Cover-Picker des aktiven Arcs: Weltbild (Standard) oder ein
          Charakterporträt. Setzt `meta[aktiv].cover` (geht in „Änderungen
          speichern"); wirkt aufs Titelbild in der Bibliothek. */}
      {coverOffen && hatArc && (
        <div className="mt-3 rounded-lg border border-border bg-muted p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Cover für „{buchTitel}“ (Bibliothek)
            </span>
            <button
              type="button"
              onClick={() => setCoverOffen(false)}
              aria-label="Cover-Auswahl schließen"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-card hover:text-foreground"
            >
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Weltbild – der Standard. */}
            <CoverKachel
              ausgewaehlt={aktivesCover === ""}
              onClick={() => {
                onArcCover(arcAktiv, "");
                setCoverOffen(false);
              }}
              label="Weltbild"
            >
              {weltbild ? (
                <Image
                  src={weltbild}
                  alt=""
                  fill
                  sizes="72px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex h-full items-center justify-center text-muted-foreground">
                  <Mountain size={24} strokeWidth={1.5} aria-hidden="true" />
                </span>
              )}
            </CoverKachel>

            {coverCharaktere.map((c) => {
              const wert = `char:${c.id}`;
              return (
                <CoverKachel
                  key={c.id}
                  ausgewaehlt={aktivesCover === wert}
                  onClick={() => {
                    onArcCover(arcAktiv, wert);
                    setCoverOffen(false);
                  }}
                  label={c.name}
                  markierung={c.isProtagonist ? "⭐" : undefined}
                >
                  {c.thumbnail ? (
                    <Image
                      src={c.thumbnail}
                      alt=""
                      fill
                      sizes="72px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-muted-foreground">
                      <User size={24} strokeWidth={1.25} aria-hidden="true" />
                    </span>
                  )}
                </CoverKachel>
              );
            })}
          </div>
          {coverCharaktere.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Noch keine Charaktere im Szenario – als Cover dient das Weltbild.
            </p>
          )}
        </div>
      )}

      {/*
        Reiter-Leiste über der Zeitleiste: zwischen mehreren Story Arcs
        umschalten – genau wie bei den Handlungsentwürfen. Erscheint ab einem
        Arc; „📖 Neu ableiten" oben hängt jeweils einen weiteren an, statt den
        vorigen zu ersetzen. Der aktive Arc steht darunter in der Zeitleiste und
        geht in den Export.
      */}
      {arcs.length >= 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            Story Arcs:
          </span>
          {arcs.map((arc, i) => {
            // Der letzte verbliebene Arc trägt kein ✕ – er lässt sich nicht über
            // die Leiste löschen; dafür ist „Alle löschen" da.
            const loeschbar = arcs.length >= 2;
            // Titel (KI, sonst „Arc N") oben, „Erzählform · Ton" klein darunter –
            // Letzteres nur, wenn es etwas Unterscheidendes hergibt.
            const meta = arcMeta[i] ?? {
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
            const titel = meta.titel.trim() || `Arc ${i + 1}`;
            const badge = variantBadge(meta);
            // Werkform zum Erzeugungszeitpunkt – nur eine **konkrete** Form
            // (Kurzgeschichte/Novelle/Roman) kommt in den Reiter; „frei" (keine
            // Werkform) und Altbestände (leer) bleiben draußen.
            const werkform =
              meta.werkform && meta.werkform !== "frei"
                ? werkformLabel(meta.werkform)
                : "";
            const stationen = `${arc.stufen.length} ${
              arc.stufen.length === 1 ? "Station" : "Stationen"
            }`;
            // Quell-Handlungsentwurf (Schnappschuss vom Ableiten); leer bei
            // Altbeständen. Kommt auf die zweite Zeile des Reiters.
            const quelle = meta.quelle.trim();
            const zeile2 = [
              badge,
              werkform,
              stationen,
              quelle && `aus „${quelle}“`,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <span
                key={i}
                className={`inline-flex items-stretch gap-1 overflow-hidden rounded-lg border text-xs transition ${
                  i === arcAktiv
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onArcWaehlen(i)}
                  disabled={disabled || busy}
                  title={
                    quelle
                      ? `${stationen} · abgeleitet aus „${quelle}“`
                      : stationen
                  }
                  className="flex flex-col items-start gap-0.5 py-1 pr-1 pl-2.5 text-left disabled:opacity-50"
                >
                  <span className="max-w-[15rem] truncate font-medium">
                    {titel}
                  </span>
                  <span
                    className={`max-w-[18rem] truncate text-[10px] leading-tight ${
                      i === arcAktiv ? "text-background/70" : "text-muted-foreground"
                    }`}
                  >
                    {zeile2}
                  </span>
                </button>
                {/*
                  Favorit-Stern – auf **jedem** Reiter, schaltet mit einem Klick
                  um, ohne den aktiven Arc zu wechseln. Wie beim Handlungsentwurf
                  ein Stern, kein Herz.
                */}
                <button
                  type="button"
                  onClick={() => onArcFavorit(i)}
                  disabled={disabled || busy}
                  aria-pressed={meta.favorit}
                  title={
                    meta.favorit
                      ? `Story Arc ${i + 1} ist Favorit – klicken zum Aufheben`
                      : `Story Arc ${i + 1} als Favorit markieren`
                  }
                  aria-label={
                    meta.favorit
                      ? `Favorit-Markierung von Story Arc ${i + 1} aufheben`
                      : `Story Arc ${i + 1} als Favorit markieren`
                  }
                  className={`flex items-center px-1 leading-none transition disabled:opacity-40 ${
                    meta.favorit
                      ? ""
                      : i === arcAktiv
                        ? "text-background/45 hover:text-background/80"
                        : "text-foreground/30 hover:text-amber-500"
                  }`}
                >
                  <Star
                    size={15}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className={
                      meta.favorit ? "fill-amber-400 text-amber-400" : ""
                    }
                  />
                </button>
                {/* Titel ändern (✎) und neu per KI erzeugen (✨) – nur am
                    aktiven Reiter. */}
                {i === arcAktiv && (
                  <>
                    <button
                      type="button"
                      onClick={() => onArcTitelAendern(i)}
                      disabled={disabled || busy || arcTitelBusy !== null}
                      title={`Titel von Story Arc ${i + 1} ändern`}
                      aria-label={`Titel von Story Arc ${i + 1} ändern`}
                      className="flex items-center px-1 leading-none opacity-70 transition hover:opacity-100 disabled:opacity-40"
                    >
                      <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onArcTitelNeu(i)}
                      disabled={
                        disabled ||
                        busy ||
                        arcTitelBusy !== null ||
                        stufen.length === 0
                      }
                      title={`Neuen Titel für Story Arc ${i + 1} per KI erzeugen`}
                      aria-label={`Neuen Titel für Story Arc ${i + 1} per KI erzeugen`}
                      className="flex items-center px-1 leading-none opacity-70 transition hover:opacity-100 disabled:opacity-40"
                    >
                      {arcTitelBusy === i ? (
                        <span className="animate-pulse">…</span>
                      ) : (
                        <Sparkles
                          size={14}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </>
                )}
                {loeschbar && (
                  <button
                    type="button"
                    onClick={() => onArcLoeschen(i)}
                    disabled={disabled || busy}
                    title={`Story Arc ${i + 1} löschen`}
                    aria-label={`Story Arc ${i + 1} löschen`}
                    className={`flex items-center pr-2 pl-0.5 leading-none opacity-70 transition hover:opacity-100 disabled:opacity-40 ${
                      i === arcAktiv
                        ? "hover:text-red-300"
                        : "hover:text-destructive dark:hover:text-red-400"
                    }`}
                  >
                    <X size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              </span>
            );
          })}
          {/*
            Aktiven Arc kopieren – eine eigenständige Kopie (samt Stationen und
            Kapiteln), angehängt und aktiv. Kein KI-Aufruf; sitzt bei den Reitern,
            weil er einen weiteren anlegt.
          */}
          <button
            type="button"
            onClick={() => onArcKopieren(arcAktiv)}
            disabled={disabled || busy}
            title="Den aktiven Story Arc kopieren – als eigenständige neue Variante"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <Copy size={13} strokeWidth={1.75} aria-hidden="true" />
            Kopieren
          </button>
          {/*
            Bei genau einem Arc ist die Leiste keine Umschaltung, sondern ein
            Hinweis: „Neu ableiten" legt einen weiteren an, statt diesen zu
            ersetzen.
          */}
          {arcs.length === 1 && (
            <span className="text-xs text-muted-foreground">
              · „Neu ableiten“ legt einen weiteren an, statt diesen zu
              ersetzen
            </span>
          )}
          {/* Alle auf einmal löschen – erst ab zwei sinnvoll. */}
          {arcs.length >= 2 && (
            <button
              type="button"
              onClick={onAlleArcsLoeschen}
              disabled={disabled || busy}
              title="Alle Story Arcs löschen"
              className="ml-auto rounded-full border border-red-600/30 px-2.5 py-1 text-xs font-medium text-destructive transition hover:bg-red-600/10 disabled:opacity-40 dark:border-red-400/30 dark:hover:bg-red-400/10"
            >
              Alle löschen
            </button>
          )}
        </div>
      )}

      {/*
        Verwendetes Modell des aktiven Arcs – nur bei aktivierter Einstellung
        und wenn bekannt (nicht bei Altbeständen/von Hand angelegten Arcs).
      */}
      {showModel && hatArc && arcMeta[arcAktiv]?.modell?.trim() && (
        <p className="mt-2 text-xs text-muted-foreground">
          Arc erzeugt mit{" "}
          <span className="font-mono">{arcMeta[arcAktiv].modell}</span>
        </p>
      )}

      {/*
        Handlung weiterspinnen – bestimmt den **Grundcharakter** des Arcs und
        steht deshalb zuerst: Der Handlungsentwurf ist eine Ausgangslage mit
        offenem Ausgang. Angehakt entwickelt der Arc daraus eine vollständige
        Geschichte (Zuspitzung, Wendepunkt, Ende), statt sie nur zu gliedern.
        Wirkt nur auf „Ableiten", nicht auf die Kapitel.
      */}
      <label
        className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground"
        title="Der Handlungsentwurf ist eine Ausgangslage mit offenem Ende. Angehakt entwickelt der Arc daraus eine vollständige Geschichte mit Zuspitzung und Ende, statt die offene Lage nur in Stationen zu gliedern. Wirkt nur auf „Ableiten“."
      >
        <input
          type="checkbox"
          checked={params.weiterspinnen}
          onChange={(e) =>
            onParamsChange({ ...params, weiterspinnen: e.target.checked })
          }
          disabled={disabled || busy}
          className="size-4 accent-primary"
        />
        Handlung weiterspinnen – zur vollständigen Geschichte
      </label>

      {/*
        Kreativ-Haken – gilt für **beide** Erzeugungen (Arc und Kapitel): Es
        fließen zufällige erzählerische Impulse ein, die Kapitel-Gerüste werden
        ausführlicher ausgearbeitet, und die Temperatur steigt. Die **Länge** der
        ausgeschriebenen Prosa steuert er **nicht** mehr – das ist die
        Kapitellänge oben (entkoppelt).
      */}
      <label
        className="mt-2 flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground"
        title="Zufällige Impulse und mehr Freiheit: Der Arc fällt lebendiger aus, die Kapitel-Gerüste werden ausführlicher und die Temperatur steigt. Die Länge der ausgeschriebenen Prosa steuert dagegen die „Kapitellänge“ oben."
      >
        <input
          type="checkbox"
          checked={params.kreativ}
          onChange={(e) =>
            onParamsChange({ ...params, kreativ: e.target.checked })
          }
          disabled={disabled}
          className="size-4 accent-primary"
        />
        <span className="flex items-center gap-1.5">
          <Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />
          Kreativ – Impulse und lebendigere Ausarbeitung
        </span>
      </label>

      {/*
        Ob eine Figur in den Arc einfließt, steuert ihr **eigenes Häkchen** an
        der Karte in der Figuren-Sektion des Szenarios – es gilt für
        Handlungsentwurf und Story Arc zugleich. Deshalb sitzt hier keine
        Figuren-Checkbox mehr.
      */}

      {/*
        Zusatzwunsch + „Ableiten"-Knopf **nebeneinander** – wie beim
        Handlungsentwurf, wo der Erzeugen-Knopf neben den Stichwörtern sitzt. Die
        Nähe sagt: Der Knopf steuert die Erzeugung, das Feld liefert die
        Stichwörter dafür. Das Feld wächst in die Breite, der Knopf bricht nicht um.
      */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={params.zusatz}
          onChange={(e) =>
            onParamsChange({ ...params, zusatz: e.target.value })
          }
          disabled={disabled || busy}
          maxLength={1000}
          placeholder="Stichwörter für den Arc – z. B. „ein Verrat trägt den Wendepunkt“, „ohne Gewalt“"
          title="Stichwörter, die der nächste Arc berücksichtigen soll. Werden nicht gespeichert."
          aria-label="Stichwörter für den Story Arc"
          className="min-w-0 flex-1 basis-56 rounded-md border border-border bg-card px-3 py-1.5 text-xs outline-none transition focus:border-primary/50 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onAbleiten}
          disabled={!kannAbleiten}
          title={
            handlung.trim()
              ? "Zerlegt den aktiven Handlungsentwurf in Stationen"
              : "Zuerst einen Handlungsentwurf erzeugen"
          }
          className={`${CHIP_BTN} whitespace-nowrap`}
        >
          {busy ? (
            "Leite ab …"
          ) : (
            <>
              <BookOpen size={14} strokeWidth={1.75} aria-hidden="true" />
              {hatArc ? "Neu ableiten" : "Story Arc ableiten"}
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      )}

      {!hatArc && !busy && (
        <p className="mt-4 text-sm text-muted-foreground">
          {handlung.trim()
            ? "Noch kein Story Arc. „Story Arc ableiten“ zerlegt den Handlungsentwurf oben – oder baue die Stationen von Hand auf."
            : "Sobald ein Handlungsentwurf steht, lässt sich daraus ein Story Arc ableiten. Von Hand geht es auch."}
        </p>
      )}

      {hatArc && (
        <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[16rem_1fr]">
          {/*
            Master: die Stations-Leiste. Alle Akte kompakt mit Status-Punkt –
            der Fortschritt des ganzen Fünfakters auf einen Blick, ohne Scrollen.
          */}
          <nav
            aria-label="Stationen des Story Arcs"
            className="flex flex-col gap-2 md:sticky md:top-4 md:self-start"
          >
            <div className="flex items-baseline justify-between px-1 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
              <span>Stationen</span>
              <span className="tabular-nums">
                {stufen.filter((x) => x.kapitel.length > 0).length} /{" "}
                {stufen.length} mit Kapiteln
              </span>
            </div>
            {stufen.map((s, i) => {
              const st = stufeStatus(s);
              const kap = s.kapitel.length;
              const prosa = s.kapitel.filter((k) => k.text.trim() !== "").length;
              const phaseLabel =
                ARC_PHASES.find((p) => p.value === s.phase)?.label ?? "";
              const dotCls =
                st === "done"
                  ? "bg-emerald-500"
                  : st === "teil"
                    ? "bg-amber-500"
                    : "bg-muted-foreground/40";
              const prog =
                kap === 0
                  ? "noch keine Kapitel"
                  : prosa === kap
                    ? `${kap} Kapitel · Prosa fertig`
                    : `${kap} Kapitel · ${prosa}/${kap} Prosa`;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setGewaehlteStufe(i)}
                  aria-current={i === sel}
                  className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition ${
                    i === sel
                      ? "border-primary bg-card shadow-sm ring-1 ring-primary/60"
                      : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <span
                    className={`mt-1 size-2.5 shrink-0 rounded-full ${dotCls}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[0.62rem] tracking-wide text-muted-foreground uppercase">
                      {`Akt ${i + 1} · ${phaseLabel}`}
                    </span>
                    <span className="block truncate text-sm font-semibold">
                      {s.titel.trim() || `Station ${i + 1}`}
                    </span>
                    <span className="block text-[0.72rem] tabular-nums text-muted-foreground">
                      {prog}
                    </span>
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                stufeHinzufuegen();
                setGewaehlteStufe(stufen.length);
              }}
              disabled={disabled || !kannHinzufuegen}
              title={
                kannHinzufuegen
                  ? "Fügt eine leere Station am Ende an"
                  : `Mehr als ${MAX_ARC_STUFEN} Stationen werden nicht gespeichert`
              }
              className={`${CHIP_BTN} justify-center`}
            >
              <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
              Station
            </button>
            <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 pt-1 text-[0.68rem] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500" /> Prosa fertig
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500" /> Kapitel da
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-muted-foreground/40" /> offen
              </span>
            </div>
          </nav>

          {/* Detail: nur die **gewählte** Station wird voll ausgearbeitet. */}
          <div>
            {stufen.map((s, i) => {
            const stil = PHASE_STYLE[s.phase];
            const kapitelLaeuft = kapitelBusy === i;
            // Kapitelgrenzen (`---`) in der Beschreibung → feste Abschnitte. Ab
            // zwei Abschnitten gilt der Segment-Modus: genau ein Kapitel je
            // Abschnitt, die Kapitelzahl-Wahl greift dann nicht.
            const segmentZahl = splitKapitelSegmente(s.beschreibung).length;
            const hatSegmente = segmentZahl >= 2;
            // Master-Detail: nur die gewählte Station voll rendern.
            if (i !== sel) return null;
            return (
              <div
                key={i}
                className="rounded-lg border border-border bg-muted p-3"
              >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      {/* Phase editierbar – der Punkt an der Linie folgt ihr. */}
                      <span className="relative">
                        <select
                          value={s.phase}
                          onChange={(e) =>
                            stufeAendern(i, {
                              phase: e.target.value as ArcPhase,
                            })
                          }
                          disabled={disabled}
                          aria-label={`Phase der Station ${i + 1}`}
                          className={`cursor-pointer appearance-none rounded-full border py-0.5 pr-5 pl-2 text-[0.65rem] font-semibold tracking-wide uppercase outline-none ${stil.chip}`}
                        >
                          {ARC_PHASES.map((p) => (
                            <option
                              key={p.value}
                              value={p.value}
                              className="bg-background text-foreground normal-case"
                            >
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <span
                          aria-hidden
                          className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-[0.55rem] opacity-60"
                        >
                          ▾
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => stufeVerschiebenUndFolgen(-1)}
                        disabled={disabled || i === 0}
                        aria-label={`Station ${i + 1} nach oben`}
                        title="Nach oben"
                        className={MINI_BTN}
                      >
                        <ChevronUp size={15} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => stufeVerschiebenUndFolgen(1)}
                        disabled={disabled || i === stufen.length - 1}
                        aria-label={`Station ${i + 1} nach unten`}
                        title="Nach unten"
                        className={MINI_BTN}
                      >
                        <ChevronDown size={15} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => stufeLoeschen(i)}
                        disabled={disabled}
                        aria-label={`Station ${i + 1} löschen`}
                        title="Station löschen"
                        className={MINI_BTN}
                      >
                        <X size={15} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <input
                    value={s.titel}
                    onChange={(e) => stufeAendern(i, { titel: e.target.value })}
                    disabled={disabled}
                    aria-label={`Titel der Station ${i + 1}`}
                    placeholder="Titel der Station"
                    maxLength={200}
                    className="mt-2 -mx-2 w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold outline-none transition hover:border-border focus:border-primary/50 disabled:opacity-60"
                  />

                  <AutoTextarea
                    id={stufeFeldId(i)}
                    value={s.beschreibung}
                    onChange={(v) => stufeAendern(i, { beschreibung: v })}
                    ariaLabel={`Beschreibung der Station ${i + 1}`}
                    placeholder="Was in dieser Station geschieht …"
                    className="text-sm text-foreground/80"
                  />

                  {/* Kapitelgrenze am Cursor einfügen. Der `---`-Trenner teilt die
                      Beschreibung in feste Abschnitte, aus denen beim Ableiten je
                      genau ein Kapitel wird. */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <button
                      type="button"
                      onClick={() => kapitelgrenzeEinfuegen(i)}
                      disabled={disabled}
                      title="Eine Kapitelgrenze (---) an der Cursorposition einfügen. Jeder so abgetrennte Abschnitt wird beim Ableiten zu genau einem Kapitel."
                      className={CHIP_BTN}
                    >
                      <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
                      Kapitelgrenze
                    </button>
                    {hatSegmente && (
                      <span className="text-xs text-muted-foreground">
                        ergibt {segmentZahl} Kapitel (feste Grenzen)
                      </span>
                    )}
                  </div>

                  {s.figuren.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.figuren.map((f, k) => (
                        <span
                          key={k}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted py-0.5 pr-1 pl-2 text-xs text-muted-foreground"
                        >
                          ◆ {f}
                          <button
                            type="button"
                            onClick={() => figurEntfernen(i, k)}
                            disabled={disabled}
                            aria-label={`${f} aus Station ${i + 1} entfernen`}
                            title="Figur entfernen"
                            className="inline-flex items-center rounded-full leading-none text-muted-foreground transition hover:text-destructive disabled:opacity-40"
                          >
                            <X size={13} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Kapitel dieser Station – eine Ebene unter dem Akt. */}
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        Kapitel ({s.kapitel.length})
                      </span>
                      <div className="flex items-center gap-1.5">
                        {/*
                          Wie viele Kapitel das Ableiten erzeugt – ein globaler
                          Lauf-Parameter (gilt für alle Stationen), aber hier am
                          Knopf gezeigt, wo er wirkt.
                        */}
                        <select
                          value={params.kapitelAnzahl}
                          onChange={(e) =>
                            onParamsChange({
                              ...params,
                              kapitelAnzahl: e.target.value as KapitelCount,
                            })
                          }
                          // Bei festen Kapitelgrenzen (`---`) entscheidet die
                          // Abschnittszahl – die Anzahl-Wahl wäre wirkungslos.
                          disabled={disabled || kapitelBusy !== null || hatSegmente}
                          aria-label="Anzahl der Kapitel je Ableiten"
                          title={
                            hatSegmente
                              ? "Wirkungslos: Diese Station hat feste Kapitelgrenzen (---) – die Abschnittszahl bestimmt die Kapitelzahl."
                              : "Wie viele Kapitel erzeugt werden – gilt für alle Stationen"
                          }
                          className={CHIP_BTN}
                        >
                          {KAPITEL_COUNTS.map((k) => (
                            <option key={k.value} value={k.value}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => onKapitelAbleiten(i)}
                          disabled={
                            disabled ||
                            kapitelBusy !== null ||
                            !s.beschreibung.trim()
                          }
                          title={
                            !s.beschreibung.trim()
                              ? "Erst die Beschreibung der Station füllen"
                              : hatSegmente
                                ? `Erzeugt genau ${segmentZahl} Kapitel entlang der gesetzten Grenzen`
                                : "Zerlegt diese Station in Kapitel"
                          }
                          className={CHIP_BTN}
                        >
                          {kapitelLaeuft ? (
                            "Leite ab …"
                          ) : (
                            <>
                              <ListTree
                                size={14}
                                strokeWidth={1.75}
                                aria-hidden="true"
                              />
                              {s.kapitel.length
                                ? "Neu ableiten"
                                : "Kapitel ableiten"}
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => kapitelHinzufuegen(i)}
                          disabled={
                            disabled ||
                            s.kapitel.length >= MAX_KAPITEL_PRO_STUFE
                          }
                          title="Leeres Kapitel hinzufügen"
                          className={CHIP_BTN}
                        >
                          + Kapitel
                        </button>
                      </div>
                    </div>

                    {kapitelError?.index === i && (
                      <p className="mt-2 text-xs text-destructive">
                        {kapitelError.text}
                      </p>
                    )}

                    {/* Modell der letzten Kapitel-Ableitung dieser Station (transient). */}
                    {showModel && kapitelModell?.[i]?.trim() && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Kapitel erzeugt mit{" "}
                        <span className="font-mono">{kapitelModell[i]}</span>
                      </p>
                    )}

                    {s.kapitel.length > 0 && (
                      <ol className="mt-2 flex flex-col gap-2">
                        {s.kapitel.map((k, ki) => (
                          <li
                            key={ki}
                            className="rounded-md border border-border bg-card p-2"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="shrink-0 text-xs tabular-nums text-foreground/35">
                                {i + 1}.{ki + 1}
                              </span>
                              <input
                                value={k.titel}
                                onChange={(e) =>
                                  kapitelAendern(i, ki, {
                                    titel: e.target.value,
                                  })
                                }
                                disabled={disabled}
                                aria-label={`Überschrift von Kapitel ${i + 1}.${ki + 1}`}
                                placeholder="Überschrift"
                                maxLength={200}
                                className="-mx-1 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium outline-none transition hover:border-border focus:border-primary/50 disabled:opacity-60"
                              />
                              <button
                                type="button"
                                onClick={() => kapitelVerschieben(i, ki, -1)}
                                disabled={disabled || ki === 0}
                                aria-label={`Kapitel ${i + 1}.${ki + 1} nach oben`}
                                title="Nach oben"
                                className={MINI_BTN}
                              >
                                <ChevronUp size={15} strokeWidth={1.75} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => kapitelVerschieben(i, ki, 1)}
                                disabled={
                                  disabled || ki === s.kapitel.length - 1
                                }
                                aria-label={`Kapitel ${i + 1}.${ki + 1} nach unten`}
                                title="Nach unten"
                                className={MINI_BTN}
                              >
                                <ChevronDown size={15} strokeWidth={1.75} aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => kapitelLoeschen(i, ki)}
                                disabled={disabled}
                                aria-label={`Kapitel ${i + 1}.${ki + 1} löschen`}
                                title="Kapitel löschen"
                                className={MINI_BTN}
                              >
                                <X size={15} strokeWidth={1.75} aria-hidden="true" />
                              </button>
                            </div>
                            <AutoTextarea
                              value={k.inhalt}
                              onChange={(v) => kapitelAendern(i, ki, { inhalt: v })}
                              ariaLabel={`Inhalt von Kapitel ${i + 1}.${ki + 1}`}
                              placeholder="Zwei bis drei Sätze, was in dem Kapitel passiert …"
                              className="text-sm text-foreground/75"
                            />

                            {/*
                              Ausformulierter Prosatext des Kapitels – eine Ebene
                              unter dem Inhalt (der bleibt die Zusammenfassung).
                              Ausklappbar, damit die langen Texte die Zeitleiste
                              nicht überfluten; auf Knopfdruck erzeugt.
                            */}
                            <div className="mt-2 border-t border-border pt-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => textUmschalten(i, ki)}
                                  aria-expanded={textOffen(i, ki)}
                                  title={
                                    textOffen(i, ki)
                                      ? "Story einklappen"
                                      : "Story ausklappen"
                                  }
                                  className="flex items-center gap-1 rounded px-1 py-0.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
                                >
                                  <span className="text-[0.6rem]">
                                    {textOffen(i, ki) ? "▾" : "▸"}
                                  </span>
                                  <BookText size={13} strokeWidth={1.75} aria-hidden="true" />
                                  Story
                                  {k.text.trim() ? ` (${k.text.length})` : ""}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    textOeffnen(i, ki);
                                    onKapitelText(i, ki);
                                  }}
                                  disabled={
                                    disabled ||
                                    kapitelTextBusy !== null ||
                                    (!k.inhalt.trim() && !k.titel.trim())
                                  }
                                  title={
                                    k.inhalt.trim() || k.titel.trim()
                                      ? "Erzeugt den ausformulierten Prosatext dieses Kapitels (Personen, Atmosphäre, Dialog)"
                                      : "Erst Titel oder Inhalt des Kapitels füllen"
                                  }
                                  className={CHIP_BTN}
                                >
                                  {kapitelTextBusy?.stufe === i &&
                                  kapitelTextBusy?.kapitel === ki ? (
                                    "Erzeuge …"
                                  ) : (
                                    <>
                                      <Sparkles
                                        size={14}
                                        strokeWidth={1.75}
                                        aria-hidden="true"
                                      />
                                      {k.text.trim()
                                        ? "Neu erzeugen"
                                        : "Story generieren"}
                                    </>
                                  )}
                                </button>
                              </div>

                              {kapitelTextError?.stufe === i &&
                                kapitelTextError?.kapitel === ki && (
                                  <p className="mt-1 text-xs text-destructive">
                                    {kapitelTextError.text}
                                  </p>
                                )}

                              {/* Modell der zuletzt erzeugten Prosa dieses Kapitels (transient). */}
                              {showModel &&
                                storyTextModell?.[`${i}-${ki}`]?.trim() && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Story erzeugt mit{" "}
                                    <span className="font-mono">
                                      {storyTextModell[`${i}-${ki}`]}
                                    </span>
                                  </p>
                                )}

                              {textOffen(i, ki) && (
                                <AutoTextarea
                                  value={k.text}
                                  onChange={(v) =>
                                    kapitelAendern(i, ki, { text: v })
                                  }
                                  ariaLabel={`Prosatext von Kapitel ${i + 1}.${ki + 1}`}
                                  placeholder="Ausformulierter Kapiteltext – Personen, Atmosphäre, Dialog in wörtlicher Rede. „Story generieren“ erzeugt ihn."
                                  className="mt-1 text-sm text-foreground/80"
                                />
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
            );
          })}
          </div>
        </div>
      )}

      {/* Bei noch leerem Arc: von Hand die erste Station aufbauen (im Master
          steht der Hinzufügen-Knopf, sobald es Stationen gibt). */}
      {!hatArc && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => {
              stufeHinzufuegen();
              setGewaehlteStufe(0);
            }}
            disabled={disabled || !kannHinzufuegen}
            title="Fügt eine leere Station an, um den Arc von Hand aufzubauen"
            className={CHIP_BTN}
          >
            <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
            Station hinzufügen
          </button>
        </div>
      )}

      {readerOffen && (
        <StoryReaderModal
          arc={storyArc}
          titel={buchTitel}
          onClose={() => setReaderOffen(false)}
        />
      )}
    </section>
  );
}

/** Eine wählbare Cover-Kachel im Picker: Vorschau + Label, Ring bei Auswahl. */
function CoverKachel({
  ausgewaehlt,
  onClick,
  label,
  markierung,
  children,
}: {
  ausgewaehlt: boolean;
  onClick: () => void;
  label: string;
  markierung?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-pressed={ausgewaehlt}
      className={`flex w-[72px] flex-col overflow-hidden rounded-md border text-left transition ${
        ausgewaehlt
          ? "border-foreground ring-2 ring-foreground/60"
          : "border-border hover:border-border"
      }`}
    >
      <div className="relative aspect-square w-full bg-muted">
        {children}
        {markierung && (
          <span className="absolute top-0.5 right-0.5 text-xs drop-shadow">
            {markierung}
          </span>
        )}
      </div>
      <span className="truncate px-1.5 py-1 text-[11px] text-muted-foreground">
        {label}
      </span>
    </button>
  );
}
