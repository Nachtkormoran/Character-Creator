"use client";

import {
  SCENARIO_HINTS,
  SCENARIO_LABELS,
  SCENARIO_MAXLENGTHS,
  SCENARIO_MULTILINE,
  type ScenarioDetails,
} from "@/lib/schema";
import { GENRE_TEMPLATES } from "@/lib/templates";
import { randomPlace } from "@/lib/scenarioPlaces";
import { randomTime } from "@/lib/scenarioTimes";
import { randomRules } from "@/lib/scenarioRules";
import { randomFigure, randomFigures } from "@/lib/scenarioFigures";
import {
  joinFigurenDetail,
  splitFigurenDetail,
  type FigurEintrag,
} from "@/lib/figuren";
import { useEffect, useRef, useState } from "react";
import { useAutoGrow } from "./useAutoGrow";
import { AutoTextarea } from "./AutoTextarea";

/**
 * Welche Felder einen Würfel haben und woher er zieht.
 *
 * Alle drei bekommen das **aktuell gewählte Genre** – deshalb gehört der
 * Würfel hierher und nicht in die Seiten: nur diese Komponente weiß, was im
 * Genre-Feld steht. Ist keins gewählt, fällt jede Funktion auf „Gegenwart"
 * zurück (so wie `randomBackground` es seit jeher tut).
 */
const WUERFEL: Partial<
  Record<keyof ScenarioDetails, (genre?: string, ergaenzen?: boolean) => string>
> = {
  ort: randomPlace,
  zeit: randomTime,
  regeln: randomRules,
  figuren: randomFigure,
};

/**
 * Wie ein Würfelwurf ins Feld kommt: **anhängen statt ersetzen**, sobald dort
 * etwas steht.
 *
 * Vorher warf jeder Klick weg, was im Feld stand. Das war richtig, solange ein
 * Wurf ein vollständiger Ort war – und wurde falsch, als das Feld anfing,
 * mehrere Ebenen aufzunehmen: Wer „Berlin" eingetippt hat und Vorschläge für
 * Schauplätze will, darf sein Berlin nicht verlieren. Die Zieh-Funktionen
 * liefern deshalb bei `ergaenzen` einen **Baustein** statt eines vollen Satzes
 * (Begründung je Funktion in `scenarioPlaces.ts` / `scenarioTimes.ts`).
 *
 * Verbunden wird verschieden: Ort und Zeit sind untereinander lesbare Zeilen,
 * die Regeln bleiben ein Fließtext aus Sätzen – so, wie die Felder es jeweils
 * schon halten.
 */
function anhaengen(
  key: keyof ScenarioDetails,
  vorhanden: string,
  neu: string,
): string {
  const alt = vorhanden.trimEnd();
  if (!alt) return neu;
  return key === "regeln" ? `${alt} ${neu}` : `${alt}\n${neu}`;
}

/**
 * Mindesthöhe der mehrzeiligen Felder in Zeilen. Nur die **Untergrenze** –
 * nach oben wachsen sie mit ihrem Inhalt (s. `AutoGrowTextarea`).
 *
 * Ort und Regeln sind ein bis drei Sätze, Beschreibung und Handlungsentwurf
 * ganze Absätze; ein leeres Feld soll ungefähr so hoch sein, wie das Ergebnis
 * ausfällt, damit die Maske beim Erzeugen nicht springt.
 */
const MINDESTZEILEN: Partial<Record<keyof ScenarioDetails, number>> = {
  ort: 4,
  zeit: 3,
  regeln: 3,
  beschreibung: 8,
  figuren: 4,
  handlung: 8,
};

/**
 * Mehrzeiliges Feld, das mit seinem Inhalt mitwächst.
 *
 * Vorher standen hier feste `rows={6}`: Der erzeugte Beschreibungstext eines
 * Szenarios ist gut 1200 Zeichen lang und damit rund dreimal so hoch – man
 * konnte ihn nur durch ein Guckloch lesen und musste innen scrollen, während
 * die Seite außen ebenfalls scrollte. Beim Handlungsentwurf ist es dasselbe.
 *
 * Eine eigene kleine Komponente, weil der Hook eine Ref je Feld braucht und
 * die Felder in einer `map` entstehen – Hooks in einer Schleife gibt es nicht.
 */
function AutoGrowTextarea({
  id,
  value,
  onChange,
  disabled,
  rows,
  maxLength,
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  rows: number;
  maxLength: number;
  className: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, value);

  return (
    <textarea
      id={id}
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      rows={rows}
      maxLength={maxLength}
      // `resize-none`, nicht mehr `resize-y`: Das Feld passt sich ohnehin an,
      // und von Hand gezogene Höhe würde beim nächsten Tastendruck wieder
      // überschrieben – ein Griff, der sichtbar nichts hält, ist schlechter
      // als keiner.
      className={`${className} resize-none overflow-hidden`}
    />
  );
}

/**
 * Das Figuren-Feld als **Kartenliste** statt eines einzigen Textfeldes – jede
 * Figur ein eigener, editierbarer Abschnitt mit Aktiv-Häkchen und Löschknopf,
 * wie die Ansatzpunkte in der Charakter-Detailansicht. Unten bleibt es **ein
 * String** (`details.figuren`, je Figur eine Zeile, inaktive mit `⊘ `-Präfix);
 * zerlegt/zusammengesetzt wird über `lib/figuren.ts`, damit die Prompts
 * unverändert reinen Fließtext bekommen.
 *
 * Eigener lokaler Zustand `list`, nicht bei jedem Rendern aus `value` neu
 * abgeleitet: Sonst verschwände eine gerade angelegte **leere** Karte sofort
 * wieder (`joinFigurenDetail` filtert Leeres). Ein Ref merkt sich den zuletzt
 * nach oben gemeldeten Wert; ändert sich `value` von **außen** (Würfel,
 * KI-Ergänzen, „Verwerfen"), wird neu zerlegt – dieselbe Mechanik wie bei den
 * Ansatzpunkten, nur dass das Feld hier Teil des geteilten `details`-Objekts ist.
 *
 * Das **Häkchen je Figur** entscheidet, ob sie in Handlungsentwurf und Story Arc
 * einfließt (Default an – eine notierte Figur wird genutzt, außer man hakt sie
 * ab). Es ist Teil der gespeicherten Zeile, reist also über „Änderungen
 * speichern", Export und Import mit.
 *
 * Der Knopf **„✨ Charakter"** je Karte erscheint nur, wenn die aufrufende Seite
 * `onFigurCharakter` reicht (die Detailseite, die eine `scenarioId` hat) – im
 * Anlege-Formular gibt es noch kein Szenario, dem man einen Charakter zuordnen
 * könnte.
 */
function FigurenListe({
  value,
  onChange,
  disabled,
  onFigurCharakter,
  figurBusy = null,
  figurFehler = null,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  /** Aus der Figur einen Charakter fürs Szenario anlegen. Nur die Detailseite. */
  onFigurCharakter?: (figurText: string) => void;
  /** Welche Figur gerade ihre Angaben ausliest (KI-Aufruf) – sperrt die Knöpfe. */
  figurBusy?: string | null;
  /** Fehler beim Ableiten, samt betroffener Figur. */
  figurFehler?: { figur: string; text: string } | null;
}) {
  const [list, setList] = useState<FigurEintrag[]>(() =>
    splitFigurenDetail(value),
  );
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setList(splitFigurenDetail(value));
      lastEmitted.current = value;
    }
  }, [value]);

  const emit = (next: FigurEintrag[]) => {
    setList(next);
    const joined = joinFigurenDetail(next);
    lastEmitted.current = joined;
    onChange(joined);
  };

  return (
    <div className="flex flex-col gap-2">
      {list.length === 0 ? (
        <p className="rounded-md border border-dashed border-black/15 px-3 py-6 text-center text-sm text-foreground/50 dark:border-white/15">
          Noch keine Figuren – würfeln, per KI ergänzen oder von Hand hinzufügen.
          Jede Figur wird ein eigener Abschnitt.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((figur, i) => (
            <li
              // Index als Key wie bei den Ansatzpunkten: kein stabiler
              // Schlüssel vorhanden, und die Liste ändert sich nur am Ende
              // (Anhängen) oder durch Löschen.
              key={i}
              className={`flex items-start gap-2 rounded-md border px-3 py-1 transition ${
                figur.aktiv
                  ? "border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.03]"
                  : "border-dashed border-black/10 bg-transparent opacity-60 dark:border-white/10"
              }`}
            >
              {/*
                Aktiv-Häkchen: entscheidet, ob die Figur in Handlungsentwurf und
                Story Arc einfließt. Steht vorne, weil es die Zeile einordnet
                (wie das ✕ sie beendet). Die Nummer sitzt daneben.
              */}
              <input
                type="checkbox"
                checked={figur.aktiv}
                onChange={(e) =>
                  emit(
                    list.map((x, j) =>
                      j === i ? { ...x, aktiv: e.target.checked } : x,
                    ),
                  )
                }
                disabled={disabled}
                title={
                  figur.aktiv
                    ? "Aktiv – fließt in Handlungsentwurf und Story Arc ein. Abhaken, um sie auszuschließen."
                    : "Inaktiv – wird bei Handlungsentwurf und Story Arc übergangen."
                }
                aria-label={`Figur ${i + 1} bei Handlungsentwurf und Story Arc berücksichtigen`}
                className="mt-1.5 size-4 shrink-0 accent-foreground"
              />
              <span className="mt-1 w-4 shrink-0 text-right text-xs text-foreground/40 tabular-nums">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <AutoTextarea
                  value={figur.text}
                  onChange={(v) =>
                    emit(list.map((x, j) => (j === i ? { ...x, text: v } : x)))
                  }
                  ariaLabel={`Figur ${i + 1}`}
                  className="text-sm"
                />
                {figurFehler && figurFehler.figur === figur.text && (
                  <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                    {figurFehler.text}
                  </p>
                )}
              </div>
              {onFigurCharakter && (
                <button
                  type="button"
                  onClick={() => onFigurCharakter(figur.text)}
                  disabled={disabled || figurBusy !== null || !figur.text.trim()}
                  title="Aus dieser Figur einen Charakter für das Szenario anlegen"
                  className="mt-0.5 shrink-0 rounded-md border border-black/15 px-2 py-0.5 text-xs font-medium whitespace-nowrap transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
                >
                  {figurBusy === figur.text ? "Liest …" : "✨ Charakter"}
                </button>
              )}
              <button
                type="button"
                onClick={() => emit(list.filter((_, j) => j !== i))}
                disabled={disabled}
                title="Diese Figur entfernen"
                aria-label={`Figur ${i + 1} entfernen`}
                className="mt-0.5 shrink-0 rounded-md border border-transparent px-2 py-0.5 text-sm text-foreground/40 transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <button
          type="button"
          onClick={() => emit([...list, { text: "", aktiv: true }])}
          disabled={disabled}
          title="Eine leere Figur zum Selbstschreiben anlegen"
          className="rounded-md border border-black/15 px-2.5 py-1 text-xs font-medium text-foreground/70 transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
        >
          ➕ Figur hinzufügen
        </button>
      </div>
    </div>
  );
}

/**
 * Beschriftung des Stichwort-Feldes je Feld.
 *
 * Nur wo die aufrufende Seite einen Wunsch entgegennimmt, erscheint eins –
 * dieselbe Regel wie bei `generatable`: welche Felder was können, entscheidet
 * die Seite, nicht diese Komponente.
 *
 * Kurz gehalten, weil das Feld **in der Kopfzeile neben dem Erzeugen-Knopf**
 * steht und dort nur begrenzt Platz hat; das ausführliche „wofür" trägt der
 * `title` (s. u.), der ohnehin mehr Raum hat als jeder Platzhalter.
 */
const ZUSATZ_PLATZHALTER: Partial<Record<keyof ScenarioDetails, string>> = {
  ort: "Stichwörter – am Wasser, geteilte Stadt …",
  zeit: "Stichwörter – kurz vor dem Umbruch …",
  regeln: "Stichwörter – wer schweigt, wer zahlt …",
  beschreibung: "Stichwörter – Regen, misstrauisch …",
  figuren: "Stichwörter – eine Verräterin, ein Kind …",
  handlung: "Stichwörter – Streit am Hafen, kein Toter …",
};

/**
 * Felder, deren KI-Knopf **ergänzt statt ersetzt**: Was dort steht, geht als
 * Vorgabe in den Prompt und kommt im Ergebnis wieder vor. Steuert nur die
 * Beschriftung – die Sache selbst entscheidet die aufrufende Seite, die weiß,
 * welche Route sie ruft.
 */
const ERGAENZT: ReadonlySet<keyof ScenarioDetails> = new Set([
  "ort",
  "zeit",
  "regeln",
  "figuren",
]);

/** Was der KI-Knopf je Feld tut – als Titel am Knopf. */
const GENERATE_HINTS: Partial<Record<keyof ScenarioDetails, string>> = {
  ort: "Ergänzt den Ort passend zu Genre, Zeit und Regeln – was schon dasteht, bleibt stehen",
  zeit: "Ergänzt die Zeit passend zu Genre, Ort und Regeln – was schon dasteht, bleibt stehen",
  regeln:
    "Ergänzt die Regeln passend zu Genre, Ort und Zeit – was schon dasteht, bleibt stehen",
  beschreibung: "Erzeugt die Beschreibung aus Genre, Ort, Zeit und Regeln",
  figuren:
    "Ergänzt etwa drei Figuren passend zu Genre, Ort, Zeit, Regeln und Beschreibung – was schon dasteht, bleibt stehen und prägt die neuen",
  handlung:
    "Erzeugt einen Handlungsentwurf aus den Festlegungen und den zugeordneten Charakteren samt ihren Ansatzpunkten",
};

/**
 * Die Eingabefelder eines Szenarios – geteilt zwischen Anlege-Formular und
 * Detailansicht, damit ein neues Feld an **einer** Stelle sichtbar wird.
 *
 * Gerendert wird über `SCENARIO_LABELS`, nicht über die Schlüssel des Objekts:
 * ein Szenario aus einem älteren Stand kennt ein später ergänztes Feld nicht,
 * und über die Labels zu laufen zeigt es leer an, statt es zu unterschlagen.
 * Damit kostet ein neues Feld genau zwei Zeilen im Schema – hier ist nichts
 * nachzutragen.
 *
 * Nur das Genre ist ein Sonderfall: es kommt aus derselben Liste wie die
 * Vorlagen im Erstellen-Formular (`GENRE_TEMPLATES`), damit beide Seiten
 * dieselben Genres kennen. Sonst stünde im Szenario „Steampunk" und im
 * Charakter-Formular etwas, das nicht dazu passt.
 */
export function ScenarioFields({
  details,
  onChange,
  disabled = false,
  fields,
  generatable,
  onGenerate,
  generatingField = null,
  zusatz,
  onZusatzChange,
  hideLabel = false,
  onFigurCharakter,
  figurBusy = null,
  figurFehler = null,
}: {
  details: ScenarioDetails;
  onChange: (details: ScenarioDetails) => void;
  disabled?: boolean;
  /**
   * Welche Felder in welcher Reihenfolge gerendert werden. Ohne Angabe **alle**
   * (das Anlege-Formular zeigt das ganze Szenario auf einmal). Die
   * Detailansicht ruft die Komponente dagegen **mehrfach** mit je einer
   * Teilmenge auf – Beschreibung neben dem Bild, dann Genre/Ort/Zeit/Regeln,
   * dann der Handlungsentwurf. So bleibt die Feld-Logik (Erzeugen, Würfel,
   * Stichwörter, Zähler) an genau einer Stelle, statt je Aufrufer neu gebaut zu
   * werden. Die gemeinsame `generatingField`-Prop hält die Instanzen synchron –
   * ein laufender Lauf sperrt die Knöpfe in allen.
   */
  fields?: Array<keyof ScenarioDetails>;
  /**
   * Welche Felder einen KI-Knopf bekommen. Bewusst von der aufrufenden Seite
   * bestimmt und nicht hier festgelegt: das Anlege-Formular kann noch keinen
   * Handlungsentwurf erzeugen (das Szenario hat weder Id noch Charaktere), die
   * Detailansicht schon. Fehlt ein Feld hier, erscheint kein Knopf.
   */
  generatable?: ReadonlySet<keyof ScenarioDetails>;
  /**
   * Erzeugt den Inhalt eines Feldes per KI. Die Anfrage macht die aufrufende
   * Seite – diese Komponente bleibt darstellend und kennt kein `fetch`.
   */
  onGenerate?: (key: keyof ScenarioDetails, anzahl?: number) => void;
  /** Welches Feld gerade erzeugt wird (für Beschriftung und Sperre). */
  generatingField?: keyof ScenarioDetails | null;
  /**
   * Inhalt der Zusatzwunsch-Felder, je Feld. Nur wo hier ein Eintrag steht,
   * erscheint eins – auch dann nur zusammen mit einem KI-Knopf, denn der
   * Wunsch richtet sich an die Erzeugung und hätte ohne sie keinen Empfänger.
   *
   * Gehalten wird der Wert **außen**: Er gehört nicht zum Szenario, sondern
   * beschreibt, wie man es gerade befragen will – wie „Bindung" und
   * „Richtung" bei den Ansatzpunkten. Er wird deshalb auch nicht gespeichert.
   */
  zusatz?: Partial<Record<keyof ScenarioDetails, string>>;
  onZusatzChange?: (key: keyof ScenarioDetails, value: string) => void;
  /**
   * Die sichtbare Feld-Beschriftung ausblenden – wenn die aufrufende Seite die
   * Überschrift schon als Sektions-`<h2>` trägt (z. B. der Handlungsentwurf).
   * Das Label bleibt für Screenreader über `sr-only` und die `htmlFor`-Bindung
   * erhalten; nur die doppelte sichtbare Beschriftung entfällt.
   */
  hideLabel?: boolean;
  /**
   * Nur fürs Figuren-Feld: aus einer einzelnen Figur einen Charakter fürs
   * Szenario anlegen. Reicht die aufrufende Seite es nicht (Anlege-Formular ohne
   * `scenarioId`), tragen die Figur-Karten keinen „Charakter"-Knopf.
   */
  onFigurCharakter?: (figurText: string) => void;
  /** Welche Figur gerade ihre Angaben ausliest (KI) – für Sperre/Spinner. */
  figurBusy?: string | null;
  /** Fehler beim Ableiten einer Figur, samt betroffener Figur. */
  figurFehler?: { figur: string; text: string } | null;
}) {
  const set = (key: keyof ScenarioDetails, value: string) =>
    onChange({ ...details, [key]: value });

  /**
   * Wie viele Figuren „🎲 Würfeln/Ergänzen" und „✨ Erzeugen/Ergänzen" am
   * Figuren-Feld hinzufügen. Gilt für **beide** – Würfel (lokal) und KI (Route).
   * Nur beim Figuren-Feld sichtbar; nicht gespeichert.
   */
  const [figurenAnzahl, setFigurenAnzahl] = useState(3);

  const controlClass =
    "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40";

  // Die **Inhalts-Textfelder** (Ort, Zeit, Regeln, Beschreibung,
  // Handlungsentwurf) tragen keinen eigenen weißen Kasten, sondern nehmen die
  // Farbe ihres Umfelds an (`bg-transparent`) – so treten die Texte in den
  // Vordergrund statt der Eingabekästen, wie die randlose Beschreibung in der
  // Charakter-Detailansicht. Die **Anweisungsfelder** (Stichwörter) und das
  // Genre-Auswahlfeld bleiben dagegen weiß: Sie sind Bedienelemente, keine
  // Inhalte, und sollen sich abheben.
  const contentClass =
    "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:focus:border-white/40";

  /** Knöpfe und Stichwort-Feld in der Kopfzeile – gleiche Höhe, gleicher Rand. */
  const kopfzeilenClass =
    "rounded-md border border-black/15 px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 dark:border-white/15";

  // Ohne `fields` alle Felder in Schema-Reihenfolge; mit `fields` genau die
  // genannten, in genau dieser Reihenfolge.
  const feldListe =
    fields ?? (Object.keys(SCENARIO_LABELS) as Array<keyof ScenarioDetails>);

  return (
    <div className="flex flex-col gap-4">
      {feldListe.map((key) => {
          // Explizite Verknüpfung statt umschließendem `<label>`: In der
          // Kopfzeile steht neben der Beschriftung ein **zweites** Eingabefeld
          // (die Stichwörter). Umschlösse das Label beide, wäre für
          // Screenreader unklar, welches es benennt – und ein Klick auf die
          // Beschriftung landete womöglich im falschen.
          const feldId = `szenario-${key}`;
          const zeigtZusatz =
            !!zusatz &&
            !!onZusatzChange &&
            key in ZUSATZ_PLATZHALTER &&
            !!generatable?.has(key);

          return (
            <div key={key} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor={feldId}
                  className={hideLabel ? "sr-only" : "text-sm font-medium"}
                >
                  {SCENARIO_LABELS[key]}
                </label>

                <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                  {/*
                  Die Stichwörter stehen **direkt neben dem Erzeugen-Knopf**,
                  nicht unter dem Textfeld: Sie richten sich an die Erzeugung,
                  nicht an den Inhalt. Unter dem Feld las man sie als weitere
                  Angabe zum Szenario und den Zusammenhang zum Knopf gar nicht.

                  Sie gehören **nicht** zum Szenario und werden nicht
                  gespeichert – deshalb das eigene `aria-label` statt einer
                  sichtbaren zweiten Beschriftung, die eine Festlegung
                  vortäuschte.
                */}
                  {zeigtZusatz && (
                    <input
                      value={zusatz![key] ?? ""}
                      onChange={(e) => onZusatzChange!(key, e.target.value)}
                      disabled={disabled || generatingField !== null}
                      // Deckungsgleich mit dem Limit in der Route – ein
                      // längerer Text ginge sonst erst beim Erzeugen verloren.
                      maxLength={1000}
                      placeholder={ZUSATZ_PLATZHALTER[key]}
                      title={`Stichwörter, die in „${SCENARIO_LABELS[key]}" einfließen sollen. Sie werden nicht gespeichert.`}
                      aria-label={`Stichwörter für ${SCENARIO_LABELS[key]}`}
                      // `min-w-0` + `basis-56`: wächst in die freie Breite,
                      // darf aber schrumpfen – sonst drückt es die Knöpfe in
                      // einer schmalen Spalte aus der Zeile.
                      className={`${kopfzeilenClass} min-w-0 flex-1 basis-56 bg-white font-normal outline-none focus:border-black/40 dark:bg-white/5 dark:focus:border-white/40`}
                    />
                  )}

                  {/*
                    Anzahl-Selektor – nur am Figuren-Feld. Gilt für **beide**
                    Knöpfe daneben: den lokalen Würfel und die KI-Erzeugung.
                  */}
                  {key === "figuren" && (
                    <label
                      className={`${kopfzeilenClass} flex items-center gap-1.5 bg-white font-normal dark:bg-white/5`}
                      title="Wie viele Figuren „Würfeln/Ergänzen“ und „Erzeugen/Ergänzen“ hinzufügen – gilt für Würfel und KI."
                    >
                      <span className="text-foreground/60">Anzahl</span>
                      <select
                        value={figurenAnzahl}
                        onChange={(e) =>
                          setFigurenAnzahl(Number(e.target.value))
                        }
                        disabled={disabled || generatingField !== null}
                        aria-label="Anzahl der hinzuzufügenden Figuren"
                        className="bg-transparent outline-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {WUERFEL[key] && (
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          key,
                          anhaengen(
                            key,
                            details[key],
                            // Figuren: genau die im Selektor gewählte Anzahl;
                            // die übrigen Felder wie bisher (ein Baustein).
                            key === "figuren"
                              ? randomFigures(details.genre, figurenAnzahl)
                              : WUERFEL[key]!(
                                  details.genre,
                                  details[key].trim() !== "",
                                ),
                          ),
                        )
                      }
                      disabled={disabled}
                      title={
                        (details[key].trim()
                          ? "Hängt einen weiteren Vorschlag an – löscht nichts. "
                          : "Zufälliger Vorschlag. ") +
                        (details.genre
                          ? "Passend zum gewählten Genre."
                          : "Ohne gewähltes Genre aus der Gegenwart.")
                      }
                      className={`${kopfzeilenClass} hover:bg-black/[0.04] dark:hover:bg-white/[0.06]`}
                    >
                      {details[key].trim() ? "🎲 Ergänzen" : "🎲 Würfeln"}
                    </button>
                  )}
                  {generatable?.has(key) && onGenerate && (
                    <button
                      type="button"
                      onClick={() =>
                        onGenerate(
                          key,
                          key === "figuren" ? figurenAnzahl : undefined,
                        )
                      }
                      // Während irgendein Feld erzeugt wird, sind alle Knöpfe
                      // gesperrt: die Erzeugung liest die übrigen Felder mit,
                      // und zwei gleichzeitige Läufe säßen auf verschiedenen
                      // Ständen.
                      disabled={disabled || generatingField !== null}
                      title={GENERATE_HINTS[key]}
                      className={`${kopfzeilenClass} whitespace-nowrap hover:bg-black/[0.04] dark:hover:bg-white/[0.06]`}
                    >
                      {/*
                        Drei Beschriftungen, weil der Knopf drei verschiedene
                        Dinge tut. Bei Ort, Zeit und Regeln **ergänzt** er und
                        verliert nichts; bei den Textfeldern ersetzt er. Ein
                        gemeinsames „Neu erzeugen" hätte am Ortsfeld gedroht,
                        etwas wegzunehmen, was dort bleibt.
                      */}
                      {generatingField === key
                        ? "Schreibt …"
                        : !details[key].trim()
                          ? "✨ Erzeugen"
                          : ERGAENZT.has(key)
                            ? "✨ Ergänzen"
                            : "✨ Neu erzeugen"}
                    </button>
                  )}
                </div>
              </div>

              {key === "genre" ? (
                <select
                  id={feldId}
                  value={details.genre}
                  onChange={(e) => set("genre", e.target.value)}
                  disabled={disabled}
                  className={controlClass}
                >
                  {/* Leer ist gültig – ein Szenario muss sich nicht festlegen. */}
                  <option value="">— keins —</option>
                  {GENRE_TEMPLATES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.emoji} {g.label}
                    </option>
                  ))}
                </select>
              ) : key === "figuren" ? (
                <FigurenListe
                  value={details.figuren}
                  onChange={(v) => set("figuren", v)}
                  disabled={disabled}
                  onFigurCharakter={onFigurCharakter}
                  figurBusy={figurBusy}
                  figurFehler={figurFehler}
                />
              ) : SCENARIO_MULTILINE.has(key) ? (
                <AutoGrowTextarea
                  id={feldId}
                  value={details[key]}
                  onChange={(v) => set(key, v)}
                  disabled={disabled}
                  rows={MINDESTZEILEN[key] ?? 6}
                  maxLength={SCENARIO_MAXLENGTHS[key]}
                  className={contentClass}
                />
              ) : (
                <input
                  id={feldId}
                  value={details[key]}
                  onChange={(e) => set(key, e.target.value)}
                  disabled={disabled}
                  maxLength={SCENARIO_MAXLENGTHS[key]}
                  className={controlClass}
                />
              )}

              {/*
                Hinweis und Zähler in einer Zeile: links „wofür", rechts „wie
                lang". Das Genre ist ein Auswahlfeld mit fester Wortliste – ein
                Zeichenzähler wäre dort sinnlos. Der Zähler nennt die tatsächliche
                **und** die maximale Länge, weil die Ergänzen-Funktion die Grenze
                erreichen kann und man dann sehen soll, wie nah man ihr ist; er
                färbt sich bernsteinfarben, sobald es eng wird.
              */}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-xs text-foreground/50">
                  {SCENARIO_HINTS[key]}
                </span>
                {key !== "genre" && (
                  <span
                    className={`shrink-0 text-xs tabular-nums ${
                      details[key].length >= SCENARIO_MAXLENGTHS[key] * 0.9
                        ? "text-amber-600 dark:text-amber-500"
                        : "text-foreground/40"
                    }`}
                    aria-label={`${details[key].length} von ${SCENARIO_MAXLENGTHS[key]} Zeichen`}
                  >
                    {details[key].length} / {SCENARIO_MAXLENGTHS[key]}
                  </span>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
