"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buildScenarioFile,
  deleteCharacter,
  deleteScenario,
  findFigurePersons,
  findPlotPersons,
  generateScenarioDescription,
  generateScenarioField,
  generateScenarioFigures,
  generateScenarioName,
  generateScenarioPlot,
  generateStoryArc,
  generateStoryTitle,
  generateChapterText,
  generateStoryArcChapters,
  getScenario,
  getSettings,
  listScenarios,
  updateCharacterContent,
  updateCharacterGenre,
  updateCharacterProtagonist,
  updateCharacterScenario,
  updateScenario,
} from "@/lib/client";
import { downloadBlob, safeFileName } from "@/lib/download";
import { scenarioFileName } from "@/lib/scenarioFile";
import { ladeRunParams, speichereRunParams } from "@/lib/scenarioRunParams";
import { GENRE_TEMPLATES } from "@/lib/templates";
import {
  DEFAULT_ARC_FORMAT,
  DEFAULT_ARC_LENGTH,
  DEFAULT_KAPITEL_COUNT,
  DEFAULT_KAPITEL_LAENGE,
  DEFAULT_STORY_FORM,
  DEFAULT_STORY_TONE,
  DEFAULT_WERKFORM,
  MAX_NEUE_PLOT_PERSONEN,
  MAX_PLOT_VARIANTS,
  MAX_STORY_ARCS,
  SCENARIO_LABELS,
  STORY_FORMS,
  STORY_TONES,
  TEXT_PROVIDERS,
  normalizeScenarioDetails,
  variantBadge,
  type ArcFormat,
  type ArcLength,
  type KapitelCount,
  type KapitelLaenge,
  type StoryForm,
  type StoryTone,
  type TextProvider,
  type Werkform,
  type GeneratedCharacter,
  type PlotPerson,
  type PlotVariants,
  type ScenarioDetails,
  type StoryArc,
  type StoryArcVariants,
  type VariantMeta,
} from "@/lib/schema";
import { stashPlotPerson } from "@/lib/personHandoff";
import {
  aktiveEintraege,
  aktiveFiguren,
  joinFigurenDetail,
  splitFigurenDetail,
} from "@/lib/figuren";
import {
  primaryImage,
  type StoredCharacter,
  type StoredImage,
  type StoredScenario,
} from "@/lib/serialize";
import { AddCharacterToScenarioModal } from "../../components/AddCharacterToScenarioModal";
import { CharacterDetailModal } from "../../components/CharacterDetailModal";
import { GenreSyncModal } from "../../components/GenreSyncModal";
import { PlotPersonModal } from "../../components/PlotPersonModal";
import { ScenarioFields } from "../../components/ScenarioFields";
import { ScenarioImageModal } from "../../components/ScenarioImageModal";
import { StoryArcSection } from "../../components/StoryArcSection";

/** Leere Metadaten – für neue leere/von Hand angelegte Varianten und als Rückfall. */
const LEER_META: VariantMeta = {
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

/**
 * Bringt eine Metadaten-Liste auf genau `laenge` Einträge (fehlende leer,
 * überzählige weg) – hält `meta` mit der Variantenliste deckungsgleich, egal
 * was der Zustand gerade hält.
 */
function ausgerichtet(meta: VariantMeta[], laenge: number): VariantMeta[] {
  return Array.from({ length: laenge }, (_, i) => meta[i] ?? LEER_META);
}

export default function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [name, setName] = useState("");
  // KI-Namensvorschlag aus den Welt-Feldern (Beschreibung/Ort/Zeit/Regeln).
  // Der Name geht in den Bearbeitungs-Zustand; gespeichert wird über „Änderungen
  // speichern" wie jede andere Namensänderung. Nicht gespeichert: nur Busy/Fehler.
  const [nameBusy, setNameBusy] = useState(false);
  const [nameFehler, setNameFehler] = useState<string | null>(null);
  const [details, setDetails] = useState<ScenarioDetails>(
    normalizeScenarioDetails({}),
  );
  /**
   * Alle Handlungsentwürfe und der Index des aktiven. Die aktive Variante ist
   * **zugleich** `details.handlung` – das Textfeld editiert sie dort live;
   * `varianten` hält alle (auch die aktive, in stabiler Reihenfolge). Beide
   * werden erst in `aktuelleVarianten()` zusammengeführt, damit nicht jeder
   * Tastendruck in die Liste gespiegelt werden muss.
   */
  const [varianten, setVarianten] = useState<string[]>([]);
  const [aktiv, setAktiv] = useState(0);
  /**
   * Anzeige-Metadaten je Entwurf (KI-Titel, Erzählform, Ton), index-gleich zur
   * vollen Variantenliste (`aktuelleVarianten()`). Getrennt gehalten wie die
   * Ansatzpunkte neben `edited`: Erzählform/Ton sind sonst reine Lauf-Parameter,
   * hier werden sie **zum Erzeugungszeitpunkt** an der Variante festgehalten.
   * `ausgerichtet(...)` hält die Länge deckungsgleich, falls der Zustand einmal
   * auseinanderläuft.
   */
  const [variantenMeta, setVariantenMeta] = useState<VariantMeta[]>([]);
  /**
   * Der Story Arc – die dramaturgische Zerlegung des aktiven Handlungsentwurfs.
   * Wie die Varianten lebt er im Bearbeitungs-Zustand: „Änderungen speichern"
   * legt ihn ab, „Verwerfen" holt den gespeicherten zurück. `stufen: []` ist
   * der ruhende Zustand (noch keiner abgeleitet).
   */
  const [storyArc, setStoryArc] = useState<StoryArc>({ stufen: [] });
  /**
   * Alle Story Arcs und der aktive Index – genau wie `varianten`/`aktiv` bei den
   * Handlungsentwürfen. Der aktive Arc ist zugleich `storyArc` (dort editiert
   * ihn die Zeitleiste live); `arcVarianten` hält die übrigen. Zusammengeführt
   * wird erst in `aktuelleArcs()`.
   */
  const [arcVarianten, setArcVarianten] = useState<StoryArc[]>([]);
  const [arcAktiv, setArcAktiv] = useState(0);
  /** Anzeige-Metadaten je Arc (Titel, Erzählform, Ton) – wie `variantenMeta`. */
  const [arcMeta, setArcMeta] = useState<VariantMeta[]>([]);
  const [arcBusy, setArcBusy] = useState(false);
  const [arcFehler, setArcFehler] = useState<string | null>(null);
  // Welcher Arc gerade einen neuen Titel per KI erzeugt (Index) – für Sperre
  // und Spinner am ✨-Knopf des Reiters.
  const [arcTitelBusy, setArcTitelBusy] = useState<number | null>(null);
  /**
   * Länge, Format und Zusatzwunsch für die Arc-Erzeugung – wie beim
   * Handlungsentwurf **nicht gespeichert**: Sie beschreiben einen Lauf, nicht
   * den Arc.
   */
  const [arcParams, setArcParams] = useState<{
    /**
     * **Werkform** (Kurzgeschichte/Novelle/Roman/frei) – die führende Einstellung.
     * Belegt beim Wählen `laenge`/`kapitelAnzahl`/`kapitelLaenge` vor (in der UI)
     * und prägt live den Prosastil der Kapitel. `frei` = keine Vorgabe.
     */
    werkform: Werkform;
    laenge: ArcLength;
    format: ArcFormat;
    zusatz: string;
    /** Zufällige Impulse + höhere Temperatur, für Arc **und** Kapitel. */
    kreativ: boolean;
    /** Aus der offenen Ausgangslage eine vollständige Geschichte entwickeln. */
    weiterspinnen: boolean;
    /** Wie viele Kapitel ein „Kapitel ableiten" erzeugt. */
    kapitelAnzahl: KapitelCount;
    /** **Kapitellänge** – wie viel Prosa je Kapitel (entkoppelt von „kreativ"). */
    kapitelLaenge: KapitelLaenge;
    /** Ton und Sprache – für Arc **und** Kapitel. */
    ton: StoryTone;
    /** Erzählform (Krimi, Liebe, …) – für Arc **und** Kapitel. */
    form: StoryForm;
  }>({
    werkform: DEFAULT_WERKFORM,
    laenge: DEFAULT_ARC_LENGTH,
    format: DEFAULT_ARC_FORMAT,
    zusatz: "",
    kreativ: false,
    weiterspinnen: false,
    kapitelAnzahl: DEFAULT_KAPITEL_COUNT,
    kapitelLaenge: DEFAULT_KAPITEL_LAENGE,
    ton: DEFAULT_STORY_TONE,
    form: DEFAULT_STORY_FORM,
  });
  /** Welche Station gerade Kapitel erzeugt, und ein etwaiger Fehler dazu. */
  const [kapitelBusy, setKapitelBusy] = useState<number | null>(null);
  const [kapitelFehler, setKapitelFehler] = useState<{
    index: number;
    text: string;
  } | null>(null);
  /**
   * Welches Kapitel gerade seinen **Prosatext** erzeugt (Station + Kapitel), und
   * ein etwaiger Fehler dazu. Getrennt vom Kapitel-Ableiten oben, weil beides
   * unabhängig läuft.
   */
  const [kapitelTextBusy, setKapitelTextBusy] = useState<{
    stufe: number;
    kapitel: number;
  } | null>(null);
  const [kapitelTextFehler, setKapitelTextFehler] = useState<{
    stufe: number;
    kapitel: number;
    text: string;
  } | null>(null);
  /**
   * Einstellung „Verwendetes Modell anzeigen" (aus den App-Einstellungen). Steuert
   * nur die Anzeige, nicht die Erzeugung. Default aus, bis die Einstellung geladen ist.
   */
  const [showModel, setShowModel] = useState(false);
  /**
   * Modell-Anbieter je Erzeugung – **pro Aufruf** wählbar (Selektor). Der
   * leere String `""` bedeutet **„Standard laut Einstellungen"**: dann greift
   * die Wahl auf der Einstellungsseite (Modell je Story-Erzeugung, sonst das
   * globale Textmodell). Ein konkreter Anbieter übersteuert das nur für diesen
   * Lauf. `handlungProvider` steuert den Handlungsentwurf, `arcProvider` den
   * Story Arc **samt** Kapitelableitung und Story-Erzeugung. Nicht gespeichert.
   */
  const [handlungProvider, setHandlungProvider] = useState<TextProvider | "">(
    "",
  );
  const [arcProvider, setArcProvider] = useState<TextProvider | "">("");
  /**
   * **Transiente** Modell-Anzeige für die Kapitel-Ableitung je Station (Index →
   * Modellname). Anders als bei Entwurf/Arc nicht in den Metadaten persistiert –
   * die Station kennt keine `meta`-Liste; hier genügt der Hinweis für die Sitzung.
   */
  const [kapitelModell, setKapitelModell] = useState<Record<number, string>>({});
  /** Transiente Modell-Anzeige für die Kapitel-Prosa, Schlüssel `"stufe-kapitel"`. */
  const [storyTextModell, setStoryTextModell] = useState<Record<string, string>>(
    {},
  );
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
  /**
   * Rückfrage nach einer Genre-Änderung: Soll das neue Genre auch auf die
   * zugeordneten Figuren übertragen werden? `betroffen` sind die Figuren mit
   * abweichendem Genre (Snapshot zum Änderungszeitpunkt). Null = keine Rückfrage.
   */
  const [genreSync, setGenreSync] = useState<{
    genre: string;
    betroffen: StoredCharacter[];
  } | null>(null);
  const [genreSyncBusy, setGenreSyncBusy] = useState(false);
  const [genreSyncFehler, setGenreSyncFehler] = useState<string | null>(null);
  /**
   * Der angeklickte Charakter – öffnet dasselbe Detail-Modal wie in der
   * Galerie (`CharacterDetailModal`, dort herausgelöst), aber **hier in der
   * Szenario-Seite**: Schließen führt zurück ins Szenario, nicht in die Galerie.
   */
  const [selectedChar, setSelectedChar] = useState<StoredCharacter | null>(null);
  /**
   * Alle Szenarien – nur für das Zuordnungs-Menü und die Szenario-Ableitung im
   * Detail-Modal. Die Detailseite selbst braucht sie sonst nicht (sie kennt ihr
   * eigenes Szenario aus `getScenario`).
   */
  const [allScenarios, setAllScenarios] = useState<StoredScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Der zuletzt gespeicherte Stand, als JSON. Daran hängt der „Ungespeicherte
   * Änderungen"-Balken – dasselbe Muster wie in der Charakter-Detailansicht.
   */
  const [saved, setSaved] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * Export. `mitCharakteren` steht auf **an**: Ein Szenario weiterzugeben und
   * seine Besetzung dabei wegzulassen ist der seltenere Fall – und der
   * teurere Weg (Bild-Originale, einige Dutzend MB) ist derselbe, den man
   * sonst von Hand über je einen Charakter-Export nachbauen müsste.
   */
  const [mitCharakteren, setMitCharakteren] = useState(true);
  /**
   * Bilder (Weltbild + Charakter-Bilder) mit exportieren. Default **an** – ohne
   * Häkchen entsteht eine schlanke Datei nur aus Texten/Festlegungen.
   */
  const [mitBildern, setMitBildern] = useState(true);
  const [exportiert, setExportiert] = useState(false);
  const [exportFehler, setExportFehler] = useState<string | null>(null);
  const [generatingField, setGeneratingField] = useState<
    keyof ScenarioDetails | null
  >(null);

  /**
   * Zusätzliche Wünsche für die Erzeugung, je Feld.
   *
   * **Wird nicht gespeichert** – wie „Bindung" und „Richtung" bei den
   * Ansatzpunkten beschreibt der Wunsch nichts am Szenario, sondern wie man es
   * gerade befragen will. Beim nächsten Öffnen der Seite ist das Feld leer,
   * und das ist richtig so: Der Entwurf steht dann längst da.
   *
   * Er bleibt aber **nach** dem Erzeugen stehen, statt geleert zu werden – der
   * häufigste Fall ist, dass man den Entwurf nicht mag und mit demselben
   * Wunsch plus einer Ergänzung noch einmal drückt.
   */
  const [zusatz, setZusatz] = useState<
    Partial<Record<keyof ScenarioDetails, string>>
  >({});

  /**
   * Ob der nächste Handlungsentwurf den **aktuellen** als Grundlage nimmt
   * (Checkbox „aktuellen Handlungsentwurf verwenden"). Dann geht `details.handlung`
   * als `basis` mit, und die Stichwörter steuern zusätzlich, wohin sich die
   * neue Fassung verschiebt. Wie der Zusatzwunsch **nicht gespeichert** – die
   * Wahl beschreibt einen Lauf, nicht das Szenario.
   */
  const [handlungAlsBasis, setHandlungAlsBasis] = useState(false);

  /**
   * Ob der nächste Handlungsentwurf eine **vollständige Geschichte** skizziert
   * (Checkbox „Handlung weiterspinnen") statt einer offenen Ausgangslage. Gilt
   * unabhängig von der Basis-Option – frisch wie auf Basis eines vorhandenen
   * Entwurfs. Nicht gespeichert (beschreibt einen Lauf).
   */
  const [handlungWeiterspinnen, setHandlungWeiterspinnen] = useState(false);

  /**
   * Ton und Sprache des Handlungsentwurfs (eigen neben dem Story-Arc-Ton, damit
   * man Entwurf und Arc unabhängig einstellen kann). Nicht gespeichert.
   */
  const [handlungTon, setHandlungTon] = useState<StoryTone>(DEFAULT_STORY_TONE);

  /**
   * **Erzählform** des Handlungsentwurfs (Krimi, Liebe, Abenteuer …) – die dritte
   * Achse neben Genre (Welt) und Ton (wie): sie prägt Konflikt und Aufbau. Eigen
   * neben dem Story-Arc-Wert, damit Entwurf und Arc unabhängig einstellbar sind.
   * Nicht gespeichert (beschreibt einen Lauf).
   */
  const [handlungForm, setHandlungForm] = useState<StoryForm>(DEFAULT_STORY_FORM);

  /**
   * Wie viele **neue benannte Personen** der nächste Entwurf zusätzlich einführt
   * (0 = keine, wie bisher). Dazu optionale Namens-/Rollen-Vorgaben. Beides gilt
   * für „Neu erzeugen" – frisch wie auf Basis eines vorhandenen Entwurfs – und
   * wird **nicht gespeichert** (beschreibt einen Lauf, wie Ton und Weiterspinnen).
   */
  const [handlungNeuePersonen, setHandlungNeuePersonen] = useState(0);
  const [handlungNeuePersonenWunsch, setHandlungNeuePersonenWunsch] =
    useState("");

  /**
   * Ob eine Figur in Handlungsentwurf/Story Arc einfließt, entscheidet ihr
   * **eigenes Häkchen** an der Karte (`FigurenListe`) – gespeichert im String
   * `details.figuren` (inaktive mit `⊘ `-Präfix, s. `lib/figuren.ts`).
   * `aktiveFiguren(details.figuren)` liefert daraus den reinen Text der aktiven
   * Figuren, den die Erzeugung bekommt; sind keine aktiv, ist er `""` und der
   * Prompt zeichengenau der ohne Figuren-Notizen. Eine Seiten-Variable braucht
   * es dafür nicht mehr.
   */

  /**
   * Aus einer einzelnen Figur einen Charakter ableiten (Knopf je Figur-Karte).
   * `figurBusy` hält die gerade ausgelesene Figur (sperrt die Knöpfe),
   * `figurFehler` einen Fehler dazu, `figurKandidat` die ausgelesene Person samt
   * ihrer Figur – sie öffnet denselben `PlotPersonModal` wie die Plot-Suche.
   */
  const [figurBusy, setFigurBusy] = useState<string | null>(null);
  const [figurFehler, setFigurFehler] = useState<{
    figur: string;
    text: string;
  } | null>(null);
  const [figurKandidat, setFigurKandidat] = useState<{
    person: PlotPerson;
    figur: string;
  } | null>(null);

  // -------------------------------------------------------------------------
  // Weltbild des Szenarios
  // -------------------------------------------------------------------------

  /**
   * Die **gespeicherten** Weltbilder (ohne Originale). Wie beim Charakter kann
   * ein Szenario mehrere Bilder haben; das Primärbild zeigt die Detailseite an,
   * die gesamte Bedienung liegt in `ScenarioImageModal`. Das Modal meldet das
   * geänderte Szenario über `onChange` zurück, damit die Liste hier aktuell bleibt.
   */
  const [bilder, setBilder] = useState<StoredImage[]>([]);
  const [bildModalOffen, setBildModalOffen] = useState(false);

  /** Ob das „Charakter hinzufügen"-Modal (bestehende Figur zuordnen) offen ist. */
  const [addOffen, setAddOffen] = useState(false);
  /** Welche Figur gerade ihre Protagonisten-Markierung umschaltet (sperrt sie). */
  const [protagonistBusy, setProtagonistBusy] = useState<string | null>(null);

  /**
   * Hier ist alles erzeugbar: Ort, Zeit und Regeln lassen sich ergänzen, die
   * beiden Textfelder erzeugen. Der Handlungsentwurf kann nur hier stehen – er
   * braucht ein gespeichertes Szenario mit Besetzung.
   */
  const ERZEUGBAR: ReadonlySet<keyof ScenarioDetails> = new Set([
    "ort",
    "zeit",
    "regeln",
    "beschreibung",
    "figuren",
    "handlung",
  ]);

  /**
   * Die volle Variantenliste mit der aktiven Zelle auf dem **live editierten**
   * Text: `details.handlung` ist die Wahrheit über die aktive Variante,
   * `varianten` hält die übrigen. Zusammengeführt wird erst hier – so kostet das
   * Tippen im Feld keine Spiegelung in die Liste. Hat ein Szenario noch gar
   * keine gespeicherte Liste, wird ein von Hand getippter Entwurf zu Variante 1.
   */
  function aktuelleVarianten(): string[] {
    if (varianten.length === 0)
      return details.handlung.trim() ? [details.handlung] : [];
    return varianten.map((v, i) => (i === aktiv ? details.handlung : v));
  }

  /** Auf einen anderen Entwurf umschalten – der bisherige wird zuvor gesichert. */
  function varianteWaehlen(i: number) {
    if (generatingField || saving) return;
    const items = aktuelleVarianten();
    if (i < 0 || i >= items.length || i === aktiv) return;
    setVarianten(items);
    setAktiv(i);
    setDetails((d) => ({ ...d, handlung: items[i] }));
  }

  /**
   * Den Titel eines Entwurfs ändern (✎ am Reiter). Der Titel gehört zu den
   * Metadaten und wird wie alles über „Änderungen speichern" abgelegt; leer
   * lassen holt den Rückfall „Entwurf N" zurück. `prompt` bewusst schlicht – wie
   * das `confirm` beim Löschen.
   */
  function titelAendern(i: number) {
    if (generatingField || saving) return;
    const items = aktuelleVarianten();
    if (i < 0 || i >= items.length) return;
    const meta = ausgerichtet(variantenMeta, items.length);
    const neu = window.prompt(`Titel für Entwurf ${i + 1}:`, meta[i].titel);
    if (neu === null) return;
    setVariantenMeta(
      meta.map((m, k) =>
        k === i ? { ...m, titel: neu.trim().slice(0, 120) } : m,
      ),
    );
  }

  /**
   * Einen Entwurf als **Favorit** markieren/entmarken (Stern am Reiter). Wie der
   * Titel Teil der Metadaten – geht über „Änderungen speichern" (dirty).
   */
  function favoritUmschalten(i: number) {
    if (generatingField || saving) return;
    const items = aktuelleVarianten();
    if (i < 0 || i >= items.length) return;
    const meta = ausgerichtet(variantenMeta, items.length);
    setVariantenMeta(
      meta.map((m, k) => (k === i ? { ...m, favorit: !m.favorit } : m)),
    );
  }

  /**
   * Einen bestehenden Handlungsentwurf **kopieren** – analog zu `arcKopieren`:
   * eine eigenständige Kopie des Entwurfs am Index `i`, angehängt und aktiv
   * geschaltet. Der Titel bekommt „(Kopie)", Erzählform/Ton/Modell reisen mit, die
   * Favorit-Markierung nicht. Ein Entwurf ist ein String – anders als der Arc
   * braucht es keine tiefe Kopie. Kein KI-Aufruf; nur im Bearbeitungs-Zustand und
   * gegen `MAX_PLOT_VARIANTS` geprüft.
   */
  function varianteKopieren(i: number) {
    if (generatingField || saving) return;
    const items = aktuelleVarianten();
    if (i < 0 || i >= items.length) return;
    if (items.length >= MAX_PLOT_VARIANTS) {
      setSaveError(
        `Mehr als ${MAX_PLOT_VARIANTS} Entwürfe werden nicht gespeichert. Lösche einen, um Platz zu schaffen.`,
      );
      return;
    }
    const meta = ausgerichtet(variantenMeta, items.length);
    const q = meta[i];
    const kopieMeta: VariantMeta = {
      ...q,
      titel: q.titel.trim() ? `${q.titel.trim()} (Kopie)` : "",
      favorit: false,
    };
    setVarianten([...items, items[i]]);
    setAktiv(items.length);
    setDetails((d) => ({ ...d, handlung: items[i] }));
    setVariantenMeta([...meta, kopieMeta]);
  }

  /**
   * Einen Entwurf löschen. Anders als beim einzelnen Ansatzpunkt fragt es hier
   * nach – ein Handlungsentwurf ist ein großer, teuer erzeugter Text. Der letzte
   * verbliebene lässt sich nicht über die Leiste löschen (dann verschwände die
   * Umschaltung ganz); dafür ist das Feld selbst da.
   */
  function varianteLoeschen(i: number) {
    if (generatingField || saving) return;
    const items = aktuelleVarianten();
    if (items.length <= 1) return;
    if (!confirm(`Entwurf ${i + 1} löschen?`)) return;
    const rest = items.filter((_, k) => k !== i);
    const na =
      i === aktiv ? Math.min(i, rest.length - 1) : i < aktiv ? aktiv - 1 : aktiv;
    setVarianten(rest);
    setAktiv(na);
    setDetails((d) => ({ ...d, handlung: rest[na] }));
    setVariantenMeta(ausgerichtet(variantenMeta, items.length).filter((_, k) => k !== i));
  }

  /**
   * Alle Entwürfe auf einmal löschen. Anders als `varianteLoeschen` bleibt hier
   * **keiner** stehen: das Feld wird geleert, die Leiste verschwindet. Rückfrage
   * mit Zahl, weil hier mehrere teuer erzeugte Texte auf einmal gehen. Wie das
   * einzelne Löschen nur im Bearbeitungs-Zustand – „Verwerfen" holt die
   * gespeicherten Entwürfe zurück, „Änderungen speichern" macht die Leerung
   * dauerhaft.
   */
  function alleVariantenLoeschen() {
    if (generatingField || saving) return;
    const anzahl = aktuelleVarianten().length;
    if (anzahl === 0) return;
    if (!confirm(`Alle ${anzahl} Entwürfe löschen?`)) return;
    setVarianten([]);
    setAktiv(0);
    setDetails((d) => ({ ...d, handlung: "" }));
    setVariantenMeta([]);
  }

  /**
   * Einen **leeren** Entwurf anhängen und auf ihn umschalten – der Gegenpol zu
   * „✨ Neu erzeugen": kein KI-Aufruf, sondern ein leeres Feld zum
   * Selbstschreiben (wie „➕ Station hinzufügen" beim Story Arc). Nur im
   * Bearbeitungs-Zustand; „Verwerfen" nimmt ihn wieder zurück.
   */
  function leerenEntwurfHinzufuegen() {
    if (generatingField || saving) return;
    const items = aktuelleVarianten();
    if (items.length >= MAX_PLOT_VARIANTS) {
      setSaveError(
        `Mehr als ${MAX_PLOT_VARIANTS} Entwürfe werden nicht gespeichert. Lösche einen, um Platz zu schaffen.`,
      );
      return;
    }
    const neu = [...items, ""];
    setVarianten(neu);
    setAktiv(neu.length - 1);
    setDetails((d) => ({ ...d, handlung: "" }));
    setVariantenMeta([...ausgerichtet(variantenMeta, items.length), LEER_META]);
  }

  // --- Story-Arc-Varianten (analog zu den Handlungsentwürfen) --------------

  /**
   * Die volle Arc-Liste mit der aktiven Zelle auf dem **live bearbeiteten** Arc
   * (`storyArc`): dieser ist die Wahrheit über die aktive Variante, `arcVarianten`
   * hält die übrigen. Zusammengeführt erst hier – so kostet keine Bearbeitung
   * eine Spiegelung in die Liste. Ohne gespeicherte Liste wird ein von Hand
   * aufgebauter Arc zu Arc 1.
   */
  function aktuelleArcs(): StoryArc[] {
    if (arcVarianten.length === 0)
      return storyArc.stufen.length > 0 ? [storyArc] : [];
    return arcVarianten.map((v, i) => (i === arcAktiv ? storyArc : v));
  }

  /** Auf einen anderen Arc umschalten – der bisherige wird zuvor gesichert. */
  function arcWaehlen(i: number) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length || i === arcAktiv) return;
    setArcVarianten(items);
    setArcAktiv(i);
    setStoryArc(items[i]);
  }

  /** Den Titel eines Story Arcs ändern (✎ am Reiter) – analog zu `titelAendern`. */
  function arcTitelAendern(i: number) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length) return;
    const meta = ausgerichtet(arcMeta, items.length);
    const neu = window.prompt(`Titel für Story Arc ${i + 1}:`, meta[i].titel);
    if (neu === null) return;
    setArcMeta(
      meta.map((m, k) =>
        k === i ? { ...m, titel: neu.trim().slice(0, 120) } : m,
      ),
    );
  }

  /**
   * Einen **neuen Titel per KI** für einen Story Arc erzeugen (✨ am Reiter) –
   * dieselbe Zusammenfassung der Stationen wie beim Ableiten (`generateStoryTitle`
   * mit `art: "arc"`). Ersetzt den bisherigen Titel in `meta[i]`; das geht wie
   * die manuelle Änderung in `dirty` ein und wird über „Änderungen speichern"
   * abgelegt. Persistiert selbst nichts.
   */
  async function arcTitelNeu(i: number) {
    if (arcBusy || saving || arcTitelBusy !== null) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length) return;
    const arcText = items[i].stufen
      .map((s) => [s.titel, s.beschreibung].filter(Boolean).join(": "))
      .join("\n")
      // Die Route deckelt den Text bei 8000 Zeichen; für einen Titel genügt eine
      // Zusammenfassung, also vorsorglich kappen.
      .slice(0, 8000);
    if (!arcText.trim()) return;
    setArcTitelBusy(i);
    setArcFehler(null);
    try {
      const titel = await generateStoryTitle(arcText, "arc");
      const neu = titel.trim().slice(0, 120);
      if (neu) {
        const meta = ausgerichtet(arcMeta, items.length);
        setArcMeta(meta.map((m, k) => (k === i ? { ...m, titel: neu } : m)));
      }
    } catch (e) {
      setArcFehler(e instanceof Error ? e.message : "Titel fehlgeschlagen.");
    } finally {
      setArcTitelBusy(null);
    }
  }

  /** Einen Story Arc als **Favorit** markieren/entmarken – analog zu `favoritUmschalten`. */
  function arcFavoritUmschalten(i: number) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length) return;
    const meta = ausgerichtet(arcMeta, items.length);
    setArcMeta(meta.map((m, k) => (k === i ? { ...m, favorit: !m.favorit } : m)));
  }

  /**
   * Das **Cover** eines Story Arcs setzen (`""` = Weltbild, `"char:<id>"` =
   * Charakterporträt). Steuert das Titelbild in der Bibliothek; geht wie Titel/
   * Favorit in `dirty` ein und wird über „Änderungen speichern" abgelegt.
   */
  function arcCoverSetzen(i: number, cover: string) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length) return;
    const meta = ausgerichtet(arcMeta, items.length);
    setArcMeta(meta.map((m, k) => (k === i ? { ...m, cover } : m)));
  }

  /**
   * Den Story Arc `i` als **Buch in der Bibliothek** an-/abwählen
   * (`meta.alsBuch`, Default aus). Wie Cover/Titel/Favorit ein Metadaten-Belang:
   * geht in `dirty` ein und wird über „Änderungen speichern" abgelegt.
   */
  function arcAlsBuchSetzen(i: number, alsBuch: boolean) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length) return;
    const meta = ausgerichtet(arcMeta, items.length);
    setArcMeta(meta.map((m, k) => (k === i ? { ...m, alsBuch } : m)));
  }

  /** Charaktere in der Form, die der Cover-Picker braucht (Name, Porträt, Protagonist). */
  const coverCharaktere = characters.map((c) => ({
    id: c.id,
    name: c.character.name,
    thumbnail: primaryImage(c)?.thumbnail ?? null,
    isProtagonist: c.isProtagonist,
  }));

  /**
   * Einen bestehenden Story Arc **kopieren** – eine eigenständige Kopie des
   * Arcs am Index `i` (tiefe Kopie samt Stationen und Kapiteln), angehängt und
   * aktiv geschaltet. Der Titel bekommt „(Kopie)", Form/Ton/Quelle reisen mit,
   * die Favorit-Markierung nicht. Kein KI-Aufruf; nur im Bearbeitungs-Zustand.
   */
  function arcKopieren(i: number) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (i < 0 || i >= items.length) return;
    if (items.length >= MAX_STORY_ARCS) {
      setArcFehler(
        `Mehr als ${MAX_STORY_ARCS} Story Arcs werden nicht gespeichert. Lösche einen, um Platz zu schaffen.`,
      );
      return;
    }
    // Tiefe Kopie, damit das Bearbeiten der Kopie das Original nicht anrührt.
    const kopie = JSON.parse(JSON.stringify(items[i])) as StoryArc;
    const meta = ausgerichtet(arcMeta, items.length);
    const q = meta[i];
    const kopieMeta: VariantMeta = {
      ...q,
      titel: q.titel.trim() ? `${q.titel.trim()} (Kopie)` : "",
      favorit: false,
      // Die Kopie ist ein frischer Arbeitsstand – nicht automatisch ein Buch.
      alsBuch: false,
    };
    setArcVarianten([...items, kopie]);
    setArcAktiv(items.length);
    setStoryArc(kopie);
    setArcMeta([...meta, kopieMeta]);
  }

  /**
   * Einen Arc löschen. Wie beim Handlungsentwurf mit Rückfrage – ein Arc ist
   * eine große, teuer erzeugte Struktur. Der letzte verbliebene lässt sich nicht
   * über die Leiste löschen; dafür ist „Alle löschen" da.
   */
  function arcLoeschen(i: number) {
    if (arcBusy || saving) return;
    const items = aktuelleArcs();
    if (items.length <= 1) return;
    if (!confirm(`Story Arc ${i + 1} löschen?`)) return;
    const rest = items.filter((_, k) => k !== i);
    const na =
      i === arcAktiv
        ? Math.min(i, rest.length - 1)
        : i < arcAktiv
          ? arcAktiv - 1
          : arcAktiv;
    setArcVarianten(rest);
    setArcAktiv(na);
    setStoryArc(rest[na]);
    setArcMeta(ausgerichtet(arcMeta, items.length).filter((_, k) => k !== i));
  }

  /**
   * Alle Arcs auf einmal löschen – zurück zum ruhenden Zustand `{ stufen: [] }`.
   * Rückfrage mit Zahl. Nur im Bearbeitungs-Zustand; „Verwerfen" holt die
   * gespeicherten Arcs zurück.
   */
  function alleArcsLoeschen() {
    if (arcBusy || saving) return;
    const anzahl = aktuelleArcs().length;
    if (anzahl === 0) return;
    if (!confirm(`Alle ${anzahl} Story Arcs löschen?`)) return;
    setArcVarianten([]);
    setArcAktiv(0);
    setStoryArc({ stufen: [] });
    setArcMeta([]);
  }

  /**
   * Ein Textfeld per KI erzeugen. Das Ergebnis landet als **ungespeicherte
   * Änderung** im Formular – wie überall sonst muss „Verwerfen" den alten Text
   * zurückbringen können. Die Rückfrage schützt von Hand Geschriebenes.
   *
   * Die Festlegungen gehen im **aktuellen, womöglich ungespeicherten** Stand
   * mit: wer gerade die Regeln umgeschrieben hat, meint die neuen. Die
   * Charaktere für den Handlungsentwurf lädt dagegen die Route selbst – die
   * gespeicherte Zuordnung ist dort die einzige, die es gibt.
   */
  async function handleGenerate(key: keyof ScenarioDetails, anzahl?: number) {
    if (generatingField) return;
    // Ort, Zeit und Regeln werden **ergänzt**, der Handlungsentwurf **angehängt**
    // (als neue Variante) – in allen dreien kann nichts verlorengehen, also
    // fragt nichts nach. Nur die Beschreibung wird ersetzt; von Hand
    // Geschriebenes wäre dort sonst still weg.
    const ersetzt = key === "beschreibung";
    if (
      ersetzt &&
      details[key].trim() &&
      !confirm(`${SCENARIO_LABELS[key]} wird ersetzt. Fortfahren?`)
    )
      return;
    setGeneratingField(key);
    setSaveError(null);
    try {
      if (key === "ort" || key === "zeit" || key === "regeln") {
        // Ergänzen statt ersetzen: Was im Feld steht, geht als Vorgabe mit und
        // kommt im Ergebnis wieder vor. Deshalb hier auch keine Rückfrage –
        // es kann nichts verlorengehen.
        const { wert } = await generateScenarioField(
          key,
          name.trim(),
          details,
          zusatz[key] ?? "",
        );
        setDetails((d) => ({ ...d, [key]: wert }));
      } else if (key === "figuren") {
        // Wie Ort/Zeit/Regeln **ergänzt**: Vorhandenes bleibt stehen und prägt
        // die neuen Figuren; die Route gibt das ganze Feld zurück (Vorhandenes
        // + etwa drei neue). Deshalb keine Rückfrage.
        const { wert } = await generateScenarioFigures(
          name.trim(),
          details,
          zusatz.figuren ?? "",
          anzahl,
        );
        setDetails((d) => ({ ...d, figuren: wert }));
      } else if (key === "handlung") {
        // Jeder Lauf hängt einen **neuen** Entwurf an und schaltet auf ihn um –
        // der vorige bleibt als Variante erhalten.
        if (aktuelleVarianten().length >= MAX_PLOT_VARIANTS) {
          setSaveError(
            `Mehr als ${MAX_PLOT_VARIANTS} Entwürfe werden nicht gespeichert. Lösche einen, um Platz zu schaffen.`,
          );
          return;
        }
        // Ist die Checkbox an, geht der **aktive** Entwurf als Grundlage mit –
        // im live editierten Stand, wie überall. Sonst leer (Entwurf aus Welt
        // und Figuren wie bisher).
        const basis =
          handlungAlsBasis && details.handlung.trim() ? details.handlung : "";
        const { handlung, model } = await generateScenarioPlot(
          id,
          name.trim(),
          // Nur **aktive** Figuren und **aktive** Handlungselemente (reiner Text
          // ohne Markup) fließen ein; sind keine aktiv, ist das jeweilige Feld
          // leer und der Prompt zeichengenau der von vorher.
          {
            ...details,
            figuren: aktiveFiguren(details.figuren),
            handlungselemente: aktiveEintraege(details.handlungselemente),
          },
          zusatz.handlung ?? "",
          basis,
          handlungWeiterspinnen,
          handlungTon,
          handlungNeuePersonen,
          handlungNeuePersonenWunsch,
          handlungForm,
          handlungProvider,
        );
        // Kurzer Titel für die Reiter-Leiste. Scheitert der Aufruf, bleibt er
        // leer – der Reiter zeigt dann „Entwurf N", der Entwurf entsteht trotzdem.
        let titel = "";
        try {
          titel = await generateStoryTitle(handlung, "entwurf");
        } catch {
          // Titel ist Beiwerk.
        }
        const alt = aktuelleVarianten();
        setVarianten([...alt, handlung]);
        setAktiv(alt.length);
        setDetails((d) => ({ ...d, handlung }));
        setVariantenMeta([
          ...ausgerichtet(variantenMeta, alt.length),
          {
            titel,
            form: handlungForm,
            ton: handlungTon,
            favorit: false,
            quelle: "",
            modell: model,
            // Handlungsentwürfe kennen keine Werkform – leer.
            werkform: "",
            // Cover ist ein Buch-/Arc-Belang; Handlungsentwürfe tragen keins.
            cover: "",
            // „Als Buch" ist ein Arc-Belang; Handlungsentwürfe tragen es nicht.
            alsBuch: false,
          },
        ]);
      } else {
        const { beschreibung } = await generateScenarioDescription(
          name.trim(),
          details,
          zusatz.beschreibung ?? "",
        );
        setDetails((d) => ({ ...d, beschreibung }));
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setGeneratingField(null);
    }
  }

  /**
   * **Den aktiven Handlungsentwurf fortsetzen** – anders als „✨ Neu erzeugen"
   * kein neuer Reiter, sondern der vorhandene Text im Feld wächst weiter. Die
   * Route bekommt den aktuellen Text als `basis` und liefert **nur die
   * Fortsetzung**; die wird an `details.handlung` angehängt (die live-Wahrheit
   * der aktiven Variante). Geht damit in `dirty` – gespeichert wird über
   * „Änderungen speichern". Nutzt dieselben Lauf-Parameter wie „Neu erzeugen"
   * (Ton, Erzählform, Weiterspinnen, neue Personen, Modell, Stichwörter).
   */
  async function handlungFortsetzen() {
    if (generatingField || saving) return;
    if (!details.handlung.trim()) return;
    setGeneratingField("handlung");
    setSaveError(null);
    try {
      const { handlung: fortsetzung } = await generateScenarioPlot(
        id,
        name.trim(),
        {
          ...details,
          figuren: aktiveFiguren(details.figuren),
          handlungselemente: aktiveEintraege(details.handlungselemente),
        },
        zusatz.handlung ?? "",
        details.handlung, // basis = der fortzusetzende Text
        handlungWeiterspinnen,
        handlungTon,
        handlungNeuePersonen,
        handlungNeuePersonenWunsch,
        handlungForm,
        handlungProvider,
        true, // fortsetzen
      );
      const neu = fortsetzung.trim();
      if (neu) {
        setDetails((d) => ({
          ...d,
          handlung: `${d.handlung.trimEnd()}\n\n${neu}`,
        }));
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setGeneratingField(null);
    }
  }

  // Anzeige-Einstellung laden (ob das verwendete Modell mit angezeigt wird).
  // Scheitert der Aufruf, bleibt es beim Default aus.
  useEffect(() => {
    getSettings()
      .then((s) => {
        setShowModel(s.showModel);
        // Die Selektoren bleiben auf „Standard" (""), damit die auf der
        // Einstellungsseite gewählten Modelle je Story-Erzeugung greifen.
      })
      .catch(() => {});
  }, []);

  // --- Zuletzt gewählte Lauf-Parameter je Szenario (localStorage) -----------
  // Handlungsentwurf (Form/Ton) und Story Arc (`arcParams` ohne `zusatz`) merken
  // sich pro Szenario. Bewusst clientseitig und getrennt von „Änderungen
  // speichern": es sind Lauf-Parameter, kein Szenario-Inhalt (s.
  // `scenarioRunParams.ts`). Geladen werden sie unten im getScenario-`.then`
  // (dort ist setState ohnehin üblich); `runParamsGeladen` schaltet den
  // Schreib-Effekt erst danach scharf, damit er die geladenen Werte nicht mit
  // Defaults überschreibt.
  const runParamsGeladen = useRef(false);

  useEffect(() => {
    runParamsGeladen.current = false; // beim (Neu-)Laden erst nach dem .then scharf
    getScenario(id)
      .then(({ scenario, characters }) => {
        setName(scenario.name);
        setDetails(scenario.details);
        setVarianten(scenario.plotVariants.items);
        setAktiv(scenario.plotVariants.aktiv);
        setVariantenMeta(scenario.plotVariants.meta);
        setStoryArc(scenario.storyArc);
        setArcVarianten(scenario.storyArcVariants.items);
        setArcAktiv(scenario.storyArcVariants.aktiv);
        setArcMeta(scenario.storyArcVariants.meta);
        setCharacters(characters);
        setBilder(scenario.images);
        setSaved(
          JSON.stringify({
            name: scenario.name,
            details: scenario.details,
            plot: scenario.plotVariants,
            arc: scenario.storyArcVariants,
          }),
        );
        // Gemerkte Lauf-Parameter dieses Szenarios anwenden, dann den
        // Schreib-Effekt scharf schalten.
        const g = ladeRunParams(id);
        setHandlungForm(g.handlung.form);
        setHandlungTon(g.handlung.ton);
        setArcParams((p) => ({ ...p, ...g.arc }));
        runParamsGeladen.current = true;
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler."))
      .finally(() => setLoading(false));
  }, [id]);

  // Merken (bei Änderung). Erst nach dem Laden, und ohne den `zusatz` (der
  // beschreibt einen einzelnen Lauf, keine dauerhafte Vorliebe).
  useEffect(() => {
    if (!runParamsGeladen.current) return;
    speichereRunParams(id, {
      handlung: { form: handlungForm, ton: handlungTon },
      arc: {
        werkform: arcParams.werkform,
        laenge: arcParams.laenge,
        format: arcParams.format,
        kapitelAnzahl: arcParams.kapitelAnzahl,
        kapitelLaenge: arcParams.kapitelLaenge,
        ton: arcParams.ton,
        form: arcParams.form,
        kreativ: arcParams.kreativ,
        weiterspinnen: arcParams.weiterspinnen,
      },
    });
  }, [id, handlungForm, handlungTon, arcParams]);

  // Alle Szenarien fürs Zuordnungs-Menü des Detail-Modals. Getrennt vom
  // Haupt-Load, weil es unabhängig und nicht kritisch ist – schlägt es fehl,
  // bleibt die Liste leer (das Menü zeigt dann nur „kein Szenario").
  useEffect(() => {
    listScenarios()
      .then(setAllScenarios)
      .catch(() => {});
  }, []);

  // ---------------------------------------------------------------------------
  // Angehängten Charakter bearbeiten (dasselbe Detail-Modal wie in der Galerie)
  // ---------------------------------------------------------------------------

  async function charLoeschen(cid: string) {
    await deleteCharacter(cid);
    setCharacters((cs) => cs.filter((c) => c.id !== cid));
    setSelectedChar(null);
  }

  async function charInhaltSpeichern(
    cid: string,
    character: GeneratedCharacter,
    storyHooks: string,
    genre: string,
  ) {
    const updated = await updateCharacterContent(
      cid,
      character,
      storyHooks,
      genre,
    );
    setCharacters((cs) => cs.map((c) => (c.id === cid ? updated : c)));
    setSelectedChar(updated);
  }

  // Bild-Operationen im Modal liefern den vollständigen aktualisierten Charakter
  // zurück – hier in Liste und Auswahl übernehmen.
  function charAktualisiert(updated: StoredCharacter) {
    setCharacters((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedChar(updated);
  }

  /**
   * Genre-Änderung an den Festlegungen abfangen: Wird das Genre auf ein
   * **anderes, nicht-leeres** Genre gesetzt und tragen zugeordnete Figuren ein
   * abweichendes Genre, öffnet sich die Rückfrage `GenreSyncModal`. Der
   * Feld-Wert selbst wird immer übernommen (`setDetails`) – die Übertragung auf
   * die Figuren ist davon unabhängig und nur auf Bestätigung. Ein Wechsel auf
   * „— keins —" fragt nicht (den Figuren ein leeres Genre aufzudrücken hieße,
   * sie auf „Gegenwart" zurückzustufen).
   */
  function festlegungenAendern(next: ScenarioDetails) {
    if (
      next.genre &&
      next.genre !== details.genre &&
      characters.some((c) => c.input.genre !== next.genre)
    ) {
      const betroffen = characters.filter((c) => c.input.genre !== next.genre);
      setGenreSyncFehler(null);
      setGenreSync({ genre: next.genre, betroffen });
    }
    setDetails(next);
  }

  /**
   * Das neue Genre auf die betroffenen Figuren übertragen (Teil-PATCH je Figur,
   * nur das Genre). Sofort persistiert – unabhängig vom „Änderungen speichern"
   * der Festlegungen, wie die übrigen Figuren-Operationen dieser Seite.
   */
  async function genreUebertragen() {
    if (!genreSync || genreSyncBusy) return;
    setGenreSyncBusy(true);
    setGenreSyncFehler(null);
    try {
      const aktualisiert = await Promise.all(
        genreSync.betroffen.map((c) => updateCharacterGenre(c.id, genreSync.genre)),
      );
      const beiId = new Map(aktualisiert.map((c) => [c.id, c]));
      setCharacters((cs) => cs.map((c) => beiId.get(c.id) ?? c));
      setSelectedChar((sel) => (sel ? beiId.get(sel.id) ?? sel : sel));
      setGenreSync(null);
    } catch (e) {
      setGenreSyncFehler(e instanceof Error ? e.message : "Übertragen fehlgeschlagen.");
    } finally {
      setGenreSyncBusy(false);
    }
  }

  /**
   * Namen aus den Welt-Feldern (Beschreibung/Ort/Zeit/Regeln) per KI erzeugen.
   * Der Vorschlag geht ins Namensfeld (Bearbeitungs-Zustand → `dirty`); die
   * Route persistiert nichts, gespeichert wird über „Änderungen speichern".
   */
  async function nameErzeugen() {
    if (nameBusy) return;
    setNameBusy(true);
    setNameFehler(null);
    try {
      const vorschlag = await generateScenarioName(details);
      if (vorschlag) setName(vorschlag);
    } catch (e) {
      setNameFehler(e instanceof Error ? e.message : "Name fehlgeschlagen.");
    } finally {
      setNameBusy(false);
    }
  }

  /**
   * Zuordnung ändern. Wird der Charakter einem **anderen** Szenario (oder
   * keinem) zugewiesen, gehört er nicht mehr hierher – dann fällt seine Kachel
   * weg und das Modal schließt. Bleibt er bei diesem Szenario, wird er nur
   * aktualisiert.
   */
  async function charZuordnen(cid: string, scenarioId: string | null) {
    const updated = await updateCharacterScenario(cid, scenarioId);
    if (updated.scenarioId === id) {
      setCharacters((cs) => cs.map((c) => (c.id === cid ? updated : c)));
      setSelectedChar(updated);
    } else {
      setCharacters((cs) => cs.filter((c) => c.id !== cid));
      setSelectedChar(null);
    }
  }

  /**
   * Ein über „Charakter hinzufügen" zugeordneter oder kopierter Charakter –
   * in die Kachelliste einreihen. Dedupe nach Id, falls er (z. B. nach einem
   * Reload im Modal) schon dabei wäre.
   */
  function charHinzugefuegt(neu: StoredCharacter) {
    setCharacters((cs) =>
      cs.some((c) => c.id === neu.id) ? cs : [...cs, neu],
    );
  }

  /**
   * Eine Figur als Protagonist markieren/entmarken. Wie die Zuordnung sofort
   * persistiert (eigener PATCH, kann nichts halb geändert sein). Ist das
   * Detail-Modal für dieselbe Figur offen, zieht seine Auswahl mit.
   */
  async function protagonistUmschalten(c: StoredCharacter) {
    if (protagonistBusy) return;
    setProtagonistBusy(c.id);
    try {
      const updated = await updateCharacterProtagonist(c.id, !c.isProtagonist);
      setCharacters((cs) => cs.map((x) => (x.id === c.id ? updated : x)));
      setSelectedChar((sel) => (sel && sel.id === c.id ? updated : sel));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setProtagonistBusy(null);
    }
  }

  // Der aktuelle Stand als Vergleichswert für den „Ungespeichert"-Balken. Die
  // Handlungsvarianten gehören dazu: Umschalten und Anhängen sind Änderungen,
  // die gespeichert werden wollen.
  const dirty =
    saved !== "" &&
    JSON.stringify({
      name,
      details,
      // `meta` muss mit – sonst wiche der Vergleich schon an der fehlenden
      // Metadaten-Liste ab (die `saved` enthält). Ein neuer Titel oder eine
      // gelöschte Variante markiert damit korrekt „ungespeichert".
      plot: {
        items: aktuelleVarianten(),
        aktiv,
        meta: ausgerichtet(variantenMeta, aktuelleVarianten().length),
      },
      arc: {
        items: aktuelleArcs(),
        aktiv: arcAktiv,
        meta: ausgerichtet(arcMeta, aktuelleArcs().length),
      },
    }) !== saved;
  const nameValid = name.trim().length > 0;
  // Das anzuzeigende Weltbild – das Primärbild (wie beim Charakter abgeleitet).
  const weltbildVorschau = primaryImage({ images: bilder })?.thumbnail ?? null;
  // Für die Reiter-Leiste: die Entwürfe im aktuellen (womöglich ungespeicherten)
  // Stand. Die Leiste erscheint erst ab zwei – bei einem gibt es nichts zu
  // wählen, und der Handlungsentwurf steht ohnehin im Feld darunter.
  const variantenAnzeige = aktuelleVarianten();

  // -------------------------------------------------------------------------
  // Personen aus dem Handlungsentwurf
  // -------------------------------------------------------------------------

  /**
   * Das Suchergebnis **zusammen mit dem Text, zu dem es gehört**.
   *
   * Ändert sich der Entwurf, ist das Ergebnis hinfällig – es verweist auf
   * Sätze, die so nicht mehr dastehen. Statt es in einem Effekt zurückzusetzen
   * (was einen Moment lang die falsche Liste zeigt und das Zurücksetzen an
   * jeder Änderungsstelle erzwingt), wird die Gültigkeit **abgeleitet**: Ein
   * Ergebnis zählt nur, solange sein Text noch der aktuelle ist.
   */
  const [ergebnis, setErgebnis] = useState<{
    handlung: string;
    personen: PlotPerson[] | null;
    fehler: string | null;
  } | null>(null);
  const [suchend, setSuchend] = useState(false);
  /** Die Person, für die gerade die Rückfrage offen ist. */
  const [gewaehlt, setGewaehlt] = useState<PlotPerson | null>(null);

  const aktuell =
    ergebnis && ergebnis.handlung === details.handlung ? ergebnis : null;
  /** `null` heißt „noch nicht gesucht", `[]` heißt „gesucht, nichts gefunden". */
  const personen = aktuell?.personen ?? null;
  const suchFehler = aktuell?.fehler ?? null;

  async function personenSuchen() {
    const handlung = details.handlung;
    if (suchend || !handlung.trim()) return;
    setSuchend(true);
    setErgebnis(null);
    try {
      const { personen } = await findPlotPersons(id, handlung);
      setErgebnis({ handlung, personen, fehler: null });
    } catch (e) {
      setErgebnis({
        handlung,
        personen: null,
        fehler: e instanceof Error ? e.message : "Fehler.",
      });
    } finally {
      setSuchend(false);
    }
  }

  /**
   * Die Person ans Erstellen-Formular übergeben. Der Umweg über
   * `sessionStorage` statt über die Adresse ist in `personHandoff.ts`
   * begründet; `?scenario=` bleibt daneben stehen, weil es die Zuordnung und
   * die Weltvorbelegung auslöst – beides gilt hier genauso.
   *
   * Von **beiden** Suchen genutzt (Handlungsentwurf und Figuren-Feld) – die
   * Übergabe ist gleich, nur die Quelle des Vorschlags unterscheidet sich.
   */
  function personAnlegen(person: PlotPerson) {
    stashPlotPerson(person);
    router.push(`/?scenario=${id}`);
  }

  /**
   * Aus **einer** Figur einen Charakter ableiten – der Knopf je Figur-Karte.
   * Er löst dieselbe Extraktion aus wie die frühere „Personen im Figuren-Feld
   * suchen", nur auf genau diese eine Notiz statt auf das ganze Feld: Die Route
   * liest daraus Name, Rolle und die weiteren Angaben und schlägt eine Person
   * vor, die dann `PlotPersonModal` zur Bestätigung zeigt (`figurKandidat`).
   *
   * Findet die Route nichts Neues (etwa weil es die Figur schon als Charakter
   * gibt), erscheint der Hinweis an der Karte statt eines leeren Dialogs.
   */
  async function figurCharakterExtrahieren(figur: string) {
    if (figurBusy) return;
    const text = figur.trim();
    if (!text) return;
    setFigurBusy(figur);
    setFigurFehler(null);
    try {
      const { personen } = await findFigurePersons(id, text);
      if (personen.length === 0) {
        setFigurFehler({
          figur,
          text: "Kein neuer Charakter ableitbar – vielleicht gibt es die Figur schon.",
        });
      } else {
        setFigurKandidat({ person: personen[0], figur });
      }
    } catch (e) {
      setFigurFehler({
        figur,
        text: e instanceof Error ? e.message : "Fehler.",
      });
    } finally {
      setFigurBusy(null);
    }
  }

  /**
   * Die aus einer Figur abgeleitete Person ans Erstellen-Formular übergeben –
   * und **die Figur aus der Liste nehmen**: Sie wird zum Charakter, die Notiz ist
   * damit erledigt. Damit die Entfernung den Seitenwechsel überlebt (die
   * Navigation zum Formular verwirft ungespeicherte Änderungen), wird der
   * bearbeitete Stand mit der entfernten Figur zuvor **gespeichert** – das nimmt
   * dem „erst speichern"-Hinweis zugleich seinen Grund. Schlägt das Speichern
   * fehl, bleibt man auf der Seite (mit Fehlermeldung) statt den Charakter ohne
   * gesicherte Entfernung anzulegen.
   */
  async function figurCharakterAnlegen() {
    if (!figurKandidat) return;
    const { person, figur } = figurKandidat;
    // Über die **normalisierte** Form vergleichen: Die Karte kann einen internen
    // Umbruch tragen, den `details.figuren` längst zu einem Leerzeichen eingeebnet
    // hat – ein roher `!==`-Vergleich träfe die Figur dann nicht. Die Aktiv-Wahl
    // der übrigen Figuren bleibt dabei erhalten (`splitFigurenDetail`).
    const ziel = figur.replace(/\s*\n\s*/g, " ").trim();
    const rest = splitFigurenDetail(details.figuren).filter(
      (f) => f.text !== ziel,
    );
    const neueDetails = { ...details, figuren: joinFigurenDetail(rest) };
    setDetails(neueDetails);
    setFigurKandidat(null);
    if (nameValid) {
      const ok = await speichern(neueDetails);
      if (!ok) return;
    }
    stashPlotPerson(person);
    router.push(`/?scenario=${id}`);
  }

  /**
   * Den Story Arc aus dem **aktiven** Handlungsentwurf ableiten. Das Ergebnis
   * landet als ungespeicherte Änderung im Bearbeitungs-Zustand – wie überall
   * muss „Verwerfen" den vorherigen Arc zurückbringen können. Der Entwurf geht
   * im aktuellen, womöglich ungespeicherten Stand mit (`details.handlung`); die
   * Figuren lädt die Route selbst über die gespeicherte Zuordnung.
   *
   * Wie beim Handlungsentwurf **hängt** jedes Ableiten einen weiteren Arc an,
   * statt den vorigen zu ersetzen – der häufigste Fall ist, dass ein Arc den
   * Aufbau besser trifft und ein anderer das Ende, und man will beide
   * nebeneinander halten. Die Reiter-Leiste schaltet um. Keine Rückfrage: der
   * Knopf ersetzt nichts mehr, „Verwerfen" bleibt der Rückweg.
   */
  async function storyArcAbleiten() {
    if (arcBusy || !details.handlung.trim()) return;
    if (aktuelleArcs().length >= MAX_STORY_ARCS) {
      setArcFehler(
        `Mehr als ${MAX_STORY_ARCS} Story Arcs werden nicht gespeichert. Lösche einen, um Platz zu schaffen.`,
      );
      return;
    }
    setArcBusy(true);
    setArcFehler(null);
    try {
      const { storyArc: neu, model } = await generateStoryArc(id, details.handlung, {
        laenge: arcParams.laenge,
        format: arcParams.format,
        zusatz: arcParams.zusatz,
        kreativ: arcParams.kreativ,
        weiterspinnen: arcParams.weiterspinnen,
        ton: arcParams.ton,
        form: arcParams.form,
        // Nur die **aktiven** Figuren (reiner Text); sind keine aktiv, leer.
        figuren: aktiveFiguren(details.figuren),
        textProvider: arcProvider,
      });
      // Titel für die Reiter-Leiste – aus einer Zusammenfassung der Stationen
      // (Titel + Beschreibung). Scheitert er, bleibt er leer („Arc N").
      const arcText = neu.stufen
        .map((s) => [s.titel, s.beschreibung].filter(Boolean).join(": "))
        .join("\n");
      let titel = "";
      try {
        titel = await generateStoryTitle(arcText, "arc");
      } catch {
        // Titel ist Beiwerk.
      }
      // Label des Handlungsentwurfs, aus dem dieser Arc abgeleitet wird – als
      // Schnappschuss an der Arc-Variante festgehalten (Reiter zeigen ihn an).
      const quelle =
        variantenMeta[aktiv]?.titel?.trim() || `Entwurf ${aktiv + 1}`;
      const alt = aktuelleArcs();
      setArcVarianten([...alt, neu]);
      setArcAktiv(alt.length);
      setStoryArc(neu);
      setArcMeta([
        ...ausgerichtet(arcMeta, alt.length),
        {
          titel,
          form: arcParams.form,
          ton: arcParams.ton,
          favorit: false,
          quelle,
          modell: model,
          // Werkform zum Erzeugungszeitpunkt an der Arc-Variante festhalten.
          werkform: arcParams.werkform,
          // Cover wählt man später in der Story-Arc-Sektion; Default = Weltbild.
          cover: "",
          // Frisch abgeleitet ist ein Arbeitsstand: erst per Häkchen ein Buch.
          alsBuch: false,
        },
      ]);
    } catch (e) {
      setArcFehler(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setArcBusy(false);
    }
  }

  /**
   * Kapitel für eine Station ableiten (zwei bis drei). Die Station geht im
   * **aktuell bearbeiteten** Stand mit; das Ergebnis ersetzt ihre Kapitel als
   * ungespeicherte Änderung – „Verwerfen" bringt die alten zurück. Ein
   * funktionales Update, damit parallele Bearbeitungen nicht verlorengehen.
   */
  async function kapitelAbleiten(stufeIndex: number) {
    if (kapitelBusy !== null) return;
    const stufe = storyArc.stufen[stufeIndex];
    if (!stufe || !stufe.beschreibung.trim()) return;
    setKapitelBusy(stufeIndex);
    setKapitelFehler(null);
    try {
      const { kapitel, model } = await generateStoryArcChapters(
        {
          titel: stufe.titel,
          beschreibung: stufe.beschreibung,
          figuren: stufe.figuren,
        },
        {
          kreativ: arcParams.kreativ,
          anzahl: arcParams.kapitelAnzahl,
          ton: arcParams.ton,
          form: arcParams.form,
          textProvider: arcProvider,
        },
      );
      setKapitelModell((m) => ({ ...m, [stufeIndex]: model }));
      // Die Route liefert nur Titel und Inhalt; der Prosatext (`text`) entsteht
      // erst später auf Knopfdruck – hier leer auffüllen, damit das Kapitel dem
      // Typ genügt und die Ausklapp-Ansicht kein `undefined` bekommt.
      setStoryArc((arc) => ({
        stufen: arc.stufen.map((s, k) =>
          k === stufeIndex
            ? { ...s, kapitel: kapitel.map((c) => ({ ...c, text: c.text ?? "" })) }
            : s,
        ),
      }));
    } catch (e) {
      setKapitelFehler({
        index: stufeIndex,
        text: e instanceof Error ? e.message : "Fehler.",
      });
    } finally {
      setKapitelBusy(null);
    }
  }

  /**
   * Den **Prosatext** eines Kapitels erzeugen (Personen + Tätigkeiten,
   * Atmosphäre, Dialog). Station und Kapitel gehen im aktuell bearbeiteten Stand
   * mit; die Figuren lädt die Route selbst über die Zuordnung. Das Ergebnis
   * ersetzt `kapitel.text` als ungespeicherte Änderung – „Verwerfen" bringt den
   * alten zurück. Funktionales Update gegen verlorene Parallel-Bearbeitungen.
   */
  async function kapitelTextGenerieren(stufeIndex: number, kapitelIndex: number) {
    if (kapitelTextBusy) return;
    const stufe = storyArc.stufen[stufeIndex];
    const kapitel = stufe?.kapitel[kapitelIndex];
    if (!kapitel || (!kapitel.inhalt.trim() && !kapitel.titel.trim())) return;
    setKapitelTextBusy({ stufe: stufeIndex, kapitel: kapitelIndex });
    setKapitelTextFehler(null);
    try {
      const { text, model } = await generateChapterText(
        id,
        details,
        {
          titel: stufe.titel,
          beschreibung: stufe.beschreibung,
          figuren: stufe.figuren,
        },
        // Die **ganze** Kapitelliste der Station plus der Index – so schreibt die
        // Route nur dieses eine Kapitel aus, nicht die ganze Station.
        stufe.kapitel.map((c) => ({ titel: c.titel, inhalt: c.inhalt })),
        kapitelIndex,
        {
          ton: arcParams.ton,
          kreativ: arcParams.kreativ,
          form: arcParams.form,
          kapitelLaenge: arcParams.kapitelLaenge,
          werkform: arcParams.werkform,
          textProvider: arcProvider,
        },
      );
      setStoryTextModell((m) => ({
        ...m,
        [`${stufeIndex}-${kapitelIndex}`]: model,
      }));
      setStoryArc((arc) => ({
        stufen: arc.stufen.map((s, si) =>
          si === stufeIndex
            ? {
                ...s,
                kapitel: s.kapitel.map((c, ki) =>
                  ki === kapitelIndex ? { ...c, text } : c,
                ),
              }
            : s,
        ),
      }));
    } catch (e) {
      setKapitelTextFehler({
        stufe: stufeIndex,
        kapitel: kapitelIndex,
        text: e instanceof Error ? e.message : "Fehler.",
      });
    } finally {
      setKapitelTextBusy(null);
    }
  }

  /**
   * Den bearbeiteten Stand persistieren und die „gespeichert"-Grundlinie neu
   * setzen. `overrideDetails` erlaubt es, mit einem bereits berechneten
   * `details` zu speichern, ohne auf das (asynchrone) `setState` zu warten –
   * genutzt beim Ableiten eines Charakters aus einer Figur, wo die Entfernung
   * der Figur den Seitenwechsel überleben muss. Gibt zurück, ob es geklappt hat.
   */
  async function speichern(overrideDetails?: ScenarioDetails): Promise<boolean> {
    if (!nameValid || saving) return false;
    const zuSpeichern = overrideDetails ?? details;
    setSaving(true);
    setSaveError(null);
    try {
      const aktualisiert = await updateScenario(id, {
        name: name.trim(),
        details: zuSpeichern,
        plotVariants: {
          items: aktuelleVarianten(),
          aktiv,
          meta: ausgerichtet(variantenMeta, aktuelleVarianten().length),
        },
        storyArcVariants: {
          items: aktuelleArcs(),
          aktiv: arcAktiv,
          meta: ausgerichtet(arcMeta, aktuelleArcs().length),
        },
      });
      setName(aktualisiert.name);
      setDetails(aktualisiert.details);
      setVarianten(aktualisiert.plotVariants.items);
      setAktiv(aktualisiert.plotVariants.aktiv);
      setVariantenMeta(aktualisiert.plotVariants.meta);
      setStoryArc(aktualisiert.storyArc);
      setArcVarianten(aktualisiert.storyArcVariants.items);
      setArcAktiv(aktualisiert.storyArcVariants.aktiv);
      setArcMeta(aktualisiert.storyArcVariants.meta);
      setSaved(
        JSON.stringify({
          name: aktualisiert.name,
          details: aktualisiert.details,
          plot: aktualisiert.plotVariants,
          arc: aktualisiert.storyArcVariants,
        }),
      );
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Fehler.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!dirty) return;
    await speichern();
  }

  /**
   * Das Szenario als Datei sichern – wahlweise mit seiner Besetzung.
   *
   * Wie beim Charakter-Export **ohne eigene Route**: Festlegungen und Texte
   * liegen längst im Client, nur die Bild-Originale holt `buildScenarioFile`
   * einzeln nach (die Listen-Antworten führen sie aus Größengründen nicht mit).
   *
   * Exportiert wird der **bearbeitete** Stand, so wie er auf dem Bildschirm
   * steht – dieselbe Regel wie bei „Text neu erzeugen", der Ableitung und dem
   * Handlungsentwurf: Wer gerade die Regeln umgeschrieben hat und dann
   * exportiert, meint die neuen. Speichern und Exportieren sind zwei
   * verschiedene Handlungen, und die Datei ist keine Kopie der Datenbank,
   * sondern dessen, was man vor sich hat.
   *
   * Die Charaktere sind davon nicht betroffen: Sie lassen sich auf dieser Seite
   * gar nicht bearbeiten, es gibt also nur einen Stand.
   */
  async function exportieren() {
    setExportiert(true);
    setExportFehler(null);
    try {
      const datei = await buildScenarioFile(
        {
          name: name.trim(),
          details,
          // Der **bearbeitete** Stand, wie bei den Festlegungen: alle Entwürfe
          // und alle Story Arcs samt aktivem Index und Metadaten (Titel/Form/Ton).
          plotVariants: {
            items: aktuelleVarianten(),
            aktiv,
            meta: ausgerichtet(variantenMeta, aktuelleVarianten().length),
          },
          storyArc,
          storyArcVariants: {
            items: aktuelleArcs(),
            aktiv: arcAktiv,
            meta: ausgerichtet(arcMeta, aktuelleArcs().length),
          },
        },
        mitCharakteren ? characters : [],
        // Die Weltbilder sind unabhängig vom bearbeiteten Stand (eigene Route,
        // sofort gespeichert) – `buildScenarioFile` holt je Bild das Original.
        { scenarioId: id, images: bilder },
        // Ohne Häkchen „mit Bildern" bleibt Weltbild + Charakter-Bilder weg.
        !mitBildern,
      );
      const blob = new Blob([JSON.stringify(datei, null, 2)], {
        type: "application/json",
      });
      downloadBlob(blob, scenarioFileName(safeFileName(name.trim())));
    } catch (e) {
      setExportFehler(
        e instanceof Error ? e.message : "Export fehlgeschlagen.",
      );
    } finally {
      setExportiert(false);
    }
  }

  async function entfernen() {
    if (
      !confirm(
        `Szenario „${name}" löschen? Die ${characters.length} zugeordneten Charaktere bleiben erhalten und sind danach ohne Szenario.`,
      )
    )
      return;
    try {
      await deleteScenario(id);
      router.push("/scenarios");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    }
  }

  if (loading) return <p className="text-muted-foreground">Lade Szenario …</p>;
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
        <Link href="/scenarios" className="text-sm underline">
          ← Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/scenarios"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← Szenarien
        </Link>
        <div className="mt-1 -mx-2 flex items-center gap-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Name des Szenarios"
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-3xl font-semibold tracking-tight outline-none transition hover:border-border focus:border-primary/50"
          />
          {/*
            KI-Name aus Beschreibung/Ort/Zeit/Regeln. Ersetzt das Feld (geht in
            den Bearbeitungs-Zustand, „Verwerfen" holt den alten Namen zurück).
            Gesperrt, solange keins der vier Felder etwas hergibt.
          */}
          <button
            type="button"
            onClick={nameErzeugen}
            disabled={
              saving ||
              nameBusy ||
              !(
                details.beschreibung.trim() ||
                details.ort.trim() ||
                details.zeit.trim() ||
                details.regeln.trim()
              )
            }
            title="Namen aus Beschreibung, Ort, Zeit und Regeln erzeugen"
            aria-label="Namen per KI erzeugen"
            className="shrink-0 rounded-md border border-border px-2.5 py-1.5 text-lg transition hover:bg-muted disabled:opacity-40"
          >
            {nameBusy ? "…" : "✨"}
          </button>
        </div>
        {nameFehler && (
          <p className="mt-1 text-xs text-destructive">
            {nameFehler}
          </p>
        )}
      </div>

      {dirty && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <span className="text-sm text-amber-800 dark:text-amber-300">
            Ungespeicherte Änderungen
          </span>
          <button
            onClick={save}
            disabled={saving || !nameValid}
            className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Speichere …" : "Änderungen speichern"}
          </button>
          <button
            onClick={() => {
              const s = JSON.parse(saved) as {
                name: string;
                details: ScenarioDetails;
                plot: PlotVariants;
                arc: StoryArcVariants;
              };
              setName(s.name);
              setDetails(s.details);
              setVarianten(s.plot.items);
              setAktiv(s.plot.aktiv);
              setVariantenMeta(s.plot.meta);
              setArcVarianten(s.arc.items);
              setArcAktiv(s.arc.aktiv);
              setArcMeta(s.arc.meta);
              setStoryArc(s.arc.items[s.arc.aktiv] ?? { stufen: [] });
            }}
            disabled={saving}
            className="text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            Verwerfen
          </button>
          {saveError && (
            <span className="w-full text-xs text-destructive">
              {saveError}
            </span>
          )}
        </div>
      )}

      {/*
        Kopfblock wie in der Charakter-Detailansicht: links der Fließtext (dort
        die Person, hier die Welt), rechts das Bild mit seiner Steuerung
        darunter. `order-*` zeigt das Bild auf schmalen Schirmen zuerst – wie
        beim Charakter.
      */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
          {/* Links: die Beschreibung – der Fließtext über die Welt. */}
          <div className="order-2 md:order-1">
            <ScenarioFields
              details={details}
              onChange={setDetails}
              disabled={saving}
              fields={["beschreibung"]}
              generatable={ERZEUGBAR}
              onGenerate={handleGenerate}
              generatingField={generatingField}
              zusatz={zusatz}
              onZusatzChange={(key, value) =>
                setZusatz((z) => ({ ...z, [key]: value }))
              }
            />
          </div>

          {/*
            Rechts nur noch das Weltbild und ein Knopf, der die Bild-Ansicht
            öffnet – die gesamte Bedienung liegt in `ScenarioImageModal`. Das
            hält die Detailansicht ruhig: neben der Weltbeschreibung steht ein
            Bild, kein Bedienfeld.
          */}
          <div className="order-1 flex flex-col gap-3 md:order-2">
            <span className="text-sm font-medium">
              {bilder.length > 1 ? `Weltbilder (${bilder.length})` : "Weltbild"}
            </span>

            <button
              type="button"
              onClick={() => setBildModalOffen(true)}
              title={
                bilder.length > 0 ? "Weltbilder verwalten" : "Weltbild hinzufügen"
              }
              className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted transition hover:border-border"
            >
              {weltbildVorschau ? (
                <Image
                  src={weltbildVorschau}
                  alt={`Weltbild von ${name}`}
                  fill
                  sizes="240px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl opacity-25">
                  🏞️
                </div>
              )}
              {bilder.length > 1 && (
                <span className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                  +{bilder.length - 1}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setBildModalOffen(true)}
              className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
            >
              {bilder.length > 0
                ? "🖼️ Weltbilder verwalten"
                : "🏞️ Weltbild hinzufügen"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Festlegungen
        </h2>
        <ScenarioFields
          details={details}
          onChange={festlegungenAendern}
          disabled={saving}
          fields={["genre", "ort", "zeit", "regeln"]}
          generatable={ERZEUGBAR}
          onGenerate={handleGenerate}
          generatingField={generatingField}
          zusatz={zusatz}
          onZusatzChange={(key, value) =>
            setZusatz((z) => ({ ...z, [key]: value }))
          }
        />
      </section>

      {/*
        Die **Besetzung** in einer Karte: oben die schon angelegten
        **Charaktere** samt den Knöpfen zum Zuordnen und Erstellen, darunter die
        **Figuren**-Notizen zu wichtigen Personen, aus denen erst Charaktere
        werden sollen (ein Saatbeet). Beides gehört zusammen – aus den Charakteren
        und den aktiven Figuren entstehen Handlungsentwurf und Story Arc. Früher
        standen die Charaktere ganz unten; hier stehen sie bei den Figuren, aus
        denen sie hervorgehen.
      */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Charaktere ({characters.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {/*
              Bestehenden Charakter zuordnen: zeigt nur Figuren, die noch nicht
              hier sind. Gehört eine schon zu einem anderen Szenario, wird auf
              Wunsch eine Kopie angelegt. Ein Knopf und kein Link – es öffnet ein
              Modal, keine Navigation.
            */}
            <button
              type="button"
              onClick={() => setAddOffen(true)}
              title="Einen bereits vorhandenen Charakter diesem Szenario zuordnen"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
            >
              + Vorhandenen hinzufügen
            </button>
            {/*
              Führt aufs Erstellen-Formular, mit dem Szenario im Parameter: es
              belegt Genre, Setting und Weltkontext vor und ist als Zuordnung
              ausgewählt. Bewusst ein Link und kein Knopf – es ist eine
              Navigation, und man soll ihn in einem neuen Tab öffnen können.
            */}
            <Link
              href={`/?scenario=${id}`}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
            >
              + Neuen erstellen
            </Link>
          </div>
        </div>
        {characters.length > 0 && (
          <p className="mb-3 text-xs text-muted-foreground">
            Mit dem ⭐ markierst du <strong>Protagonisten</strong> – der
            Handlungsentwurf dreht sich dann um sie, die übrigen sind
            Nebenfiguren. Ohne Markierung bleibt alles wie bisher.
          </p>
        )}
        {dirty && (
          <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">
            Ungespeicherte Änderungen werden nicht übernommen – erst speichern,
            dann den Charakter anlegen.
          </p>
        )}
        {characters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Diesem Szenario ist noch niemand zugeordnet. Füge über die Knöpfe
            oben einen vorhandenen Charakter hinzu, erstelle einen neuen – oder
            lege unten aus einer Figur einen an.
          </div>
        ) : (
          // Rund halb so große Kacheln wie in der Galerie: doppelt so viele
          // Spalten, engere Abstände. Weil eine kleine Kachel keinen Platz für
          // zwei Zeilen Beschreibung hat, steht hier nur der Name – die
          // Kurzbeschreibung wandert in den `title` (Tooltip beim Überfahren).
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
            {characters.map((c) => {
              const preview = primaryImage(c)?.thumbnail;
              // Wrapper, damit der Stern ein **Geschwister** des Kachel-Knopfes
              // ist – verschachtelte Buttons sind ungültiges HTML.
              return (
                <div key={c.id} className="relative">
                  <button
                    type="button"
                    onClick={() => setSelectedChar(c)}
                    title={c.character.kurzbeschreibung}
                    className={`flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border bg-card text-left transition hover:shadow-md ${
                      c.isProtagonist
                        ? "border-amber-400 ring-1 ring-amber-400/60 dark:border-amber-400/70"
                        : "border-border"
                    }`}
                  >
                    <div className="relative aspect-square w-full bg-muted">
                      {preview ? (
                        <Image
                          src={preview}
                          alt={c.character.name}
                          fill
                          sizes="(max-width: 640px) 50vw, 16vw"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-2xl opacity-30">
                          🧑
                        </div>
                      )}
                    </div>
                    <span className="block truncate p-1.5 text-xs font-medium">
                      {c.character.name}
                    </span>
                  </button>
                  {/*
                    Protagonisten-Stern, oben rechts über dem Bild. Eigener
                    Button (nicht im Kachel-Knopf), mit gut lesbarem Chip über
                    dem Thumbnail. Sofort persistiert.
                  */}
                  <button
                    type="button"
                    onClick={() => protagonistUmschalten(c)}
                    disabled={protagonistBusy === c.id}
                    aria-pressed={c.isProtagonist}
                    aria-label={
                      c.isProtagonist
                        ? `${c.character.name} als Protagonist aufheben`
                        : `${c.character.name} als Protagonist markieren`
                    }
                    title={
                      c.isProtagonist
                        ? "Protagonist – klicken zum Aufheben"
                        : "Als Protagonist markieren (der Handlungsentwurf dreht sich dann um die Protagonisten)"
                    }
                    className={`absolute right-1 top-1 rounded-full bg-black/45 px-1.5 py-0.5 text-sm leading-none backdrop-blur-sm transition hover:bg-black/60 disabled:opacity-50 ${
                      c.isProtagonist
                        ? "text-amber-300"
                        : "text-white/75 hover:text-amber-200"
                    }`}
                  >
                    {c.isProtagonist ? "⭐" : "☆"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/*
          Die **Figuren**-Notizen unter den fertigen Charakteren, in derselben
          Karte: wichtige Personen, aus denen noch Charaktere werden sollen.
          „✨ Charakter" an einer Figur legt sie an; das Häkchen je Figur
          entscheidet, ob sie in Handlungsentwurf und Story Arc einfließt (Default
          an). Kein Erzeugen-Knopf für das Feld selbst (nicht in ERZEUGBAR) –
          gefüllt wird von Hand, per Würfel/KI-Ergänzen oder vom „Zufälligen
          Szenario".
        */}
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="mb-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Figuren
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Notizen zu wichtigen Personen, aus denen noch kein Charakter angelegt
            ist. „✨ Charakter“ macht aus einer Figur einen Charakter für dieses
            Szenario.
          </p>
          <ScenarioFields
            details={details}
            onChange={setDetails}
            disabled={saving}
            fields={["figuren"]}
            generatable={ERZEUGBAR}
            onGenerate={handleGenerate}
            generatingField={generatingField}
            zusatz={zusatz}
            onZusatzChange={(key, value) =>
              setZusatz((z) => ({ ...z, [key]: value }))
            }
            onFigurCharakter={figurCharakterExtrahieren}
            figurBusy={figurBusy}
            figurFehler={figurFehler}
          />

          {details.figuren.trim() && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              Das Häkchen je Figur entscheidet, ob sie in Handlungsentwurf und
              Story Arc einfließt. Abgehakte Figuren bleiben in der Liste, werden
              dort aber übergangen.
            </p>
          )}
        </div>
      </section>

      {/*
        Eine Karte, zwei Teile in dieser Reihenfolge: **oben die
        Handlungselemente** (die persistenten Vorgaben – eine Kartenliste wie die
        Figuren), **darunter der Handlungsentwurf** selbst, der aus ihnen (und den
        Charakteren) entsteht. Beide tragen eine eigene `<h2>`; die Feld-Labels
        darunter sind per `hideLabel` ausgeblendet (für Screenreader bleiben sie
        erhalten), sonst stünde die Überschrift doppelt da.
      */}
      <section className="rounded-xl border border-border bg-card p-5">
        {/*
          Handlungselemente – die persistenten Vorgaben für die Erzeugung: was der
          nächste „✨ Neu erzeugen“-Lauf aufgreift. Aktive Elemente (Häkchen)
          fließen ein; die einmalige Stichwörter-Zeile im Entwurf-Kopf wirkt
          zusätzlich. Ein zufällig erzeugtes Szenario füllt die Liste mit.
        */}
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Handlungselemente
        </h2>
        <ScenarioFields
          details={details}
          onChange={setDetails}
          disabled={saving}
          fields={["handlungselemente"]}
          generatingField={generatingField}
          hideLabel
        />

        <h2 className="mt-6 mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Handlungsentwurf
        </h2>
        {/*
          Reiter-Leiste über dem Feld: zwischen mehreren Handlungsentwürfen
          umschalten. Erscheint erst ab zwei Entwürfen – „✨ Neu erzeugen" im
          Feld-Kopf hängt jeweils einen weiteren an, statt den vorigen zu
          ersetzen. Die **aktive** Variante steht im Feld darunter und geht in
          Personensuche und Export.
        */}
        {variantenAnzeige.length >= 1 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted-foreground">
              Entwürfe:
            </span>
            {variantenAnzeige.map((text, i) => {
              // Der letzte verbliebene Entwurf trägt kein ✕ – er lässt sich nicht
              // über die Leiste löschen, und ohne Löschknopf braucht die Kachel
              // rechts wieder ihren vollen Rand.
              const loeschbar = variantenAnzeige.length >= 2;
              // Titel (KI, sonst „Entwurf N") oben, „Erzählform · Ton" klein
              // darunter – Letzteres nur, wenn es etwas Unterscheidendes hergibt
              // (leer/neutral wird weggelassen, s. `variantBadge`).
              const meta = variantenMeta[i] ?? LEER_META;
              const titel = meta.titel.trim() || `Entwurf ${i + 1}`;
              const badge = variantBadge(meta);
              return (
                <span
                  key={i}
                  className={`inline-flex items-stretch gap-1 overflow-hidden rounded-lg border text-xs transition ${
                    i === aktiv
                      ? "border-foreground bg-primary text-primary-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => varianteWaehlen(i)}
                    disabled={saving || generatingField !== null}
                    title={text.trim().slice(0, 200) || "(leerer Entwurf)"}
                    className="flex flex-col items-start gap-0.5 py-1 pr-1 pl-2.5 text-left disabled:opacity-50"
                  >
                    <span className="max-w-[15rem] truncate font-medium">
                      {titel}
                    </span>
                    {badge && (
                      <span
                        className={`text-[10px] leading-tight ${
                          i === aktiv
                            ? "text-background/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                  {/*
                    Favorit-Stern – auf **jedem** Reiter: markiert und schaltet mit
                    einem Klick um, ohne die aktive Variante zu wechseln. Bewusst
                    ein Stern, kein Herz. ⭐ (Emoji, farbig) = Favorit, ☆ (gedämpft)
                    = nicht.
                  */}
                  <button
                    type="button"
                    onClick={() => favoritUmschalten(i)}
                    disabled={saving || generatingField !== null}
                    aria-pressed={meta.favorit}
                    title={
                      meta.favorit
                        ? `Entwurf ${i + 1} ist Favorit – klicken zum Aufheben`
                        : `Entwurf ${i + 1} als Favorit markieren`
                    }
                    aria-label={
                      meta.favorit
                        ? `Favorit-Markierung von Entwurf ${i + 1} aufheben`
                        : `Entwurf ${i + 1} als Favorit markieren`
                    }
                    className={`flex items-center px-1 leading-none transition disabled:opacity-40 ${
                      meta.favorit
                        ? ""
                        : i === aktiv
                          ? "text-background/45 hover:text-background/80"
                          : "text-foreground/30 hover:text-amber-500"
                    }`}
                  >
                    {meta.favorit ? "⭐" : "☆"}
                  </button>
                  {/* Titel ändern – nur am aktiven Reiter, um die Leiste ruhig zu halten. */}
                  {i === aktiv && (
                    <button
                      type="button"
                      onClick={() => titelAendern(i)}
                      disabled={saving || generatingField !== null}
                      title={`Titel von Entwurf ${i + 1} ändern`}
                      aria-label={`Titel von Entwurf ${i + 1} ändern`}
                      className="flex items-center px-1 leading-none opacity-70 transition hover:opacity-100 disabled:opacity-40"
                    >
                      ✎
                    </button>
                  )}
                  {loeschbar && (
                    <button
                      type="button"
                      onClick={() => varianteLoeschen(i)}
                      disabled={saving || generatingField !== null}
                      title={`Entwurf ${i + 1} löschen`}
                      aria-label={`Entwurf ${i + 1} löschen`}
                      className={`flex items-center pr-2 pl-0.5 leading-none opacity-70 transition hover:opacity-100 disabled:opacity-40 ${
                        i === aktiv
                          ? "hover:text-red-300"
                          : "hover:text-destructive dark:hover:text-red-400"
                      }`}
                    >
                      ✕
                    </button>
                  )}
                </span>
              );
            })}
            {/*
              Aktiven Entwurf kopieren – als eigenständige neue Variante (wie
              „⧉ Kopieren" beim Story Arc). Kein KI-Aufruf; hängt einen Reiter an.
            */}
            <button
              type="button"
              onClick={() => varianteKopieren(aktiv)}
              disabled={saving || generatingField !== null}
              title="Den aktiven Handlungsentwurf kopieren – als eigenständige neue Variante"
              className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              ⧉ Kopieren
            </button>
            {/*
              Leeren Entwurf anhängen – der Gegenpol zu „✨ Neu erzeugen": kein
              KI-Aufruf, ein leeres Feld zum Selbstschreiben. Sitzt bei den
              Reitern, weil er einen weiteren Reiter anlegt.
            */}
            <button
              type="button"
              onClick={leerenEntwurfHinzufuegen}
              disabled={saving || generatingField !== null}
              title="Einen leeren Handlungsentwurf zum Selbstschreiben anlegen"
              className="rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-40"
            >
              ➕ Leerer Entwurf
            </button>
            {/*
              Bei genau einem Entwurf ist die Leiste keine Umschaltung, sondern
              ein Hinweis: Sie macht sichtbar, dass „Neu erzeugen" einen weiteren
              anlegt, statt diesen zu ersetzen. Ohne das käme niemand mit nur
              einem Entwurf auf die Idee, dass mehrere nebeneinander möglich sind.
            */}
            {variantenAnzeige.length === 1 && (
              <span className="text-xs text-muted-foreground">
                · „✨ Neu erzeugen“ legt einen weiteren an, statt diesen zu
                ersetzen
              </span>
            )}
            {/*
              Alle auf einmal löschen – erst ab zwei Entwürfen sinnvoll (bei
              einem tut es das Feld selbst). Rechts abgesetzt, damit es nicht
              mit den einzelnen ✕ verwechselt wird.
            */}
            {variantenAnzeige.length >= 2 && (
              <button
                type="button"
                onClick={alleVariantenLoeschen}
                disabled={saving || generatingField !== null}
                title="Alle Handlungsentwürfe löschen"
                className="ml-auto rounded-full border border-red-600/30 px-2.5 py-1 text-xs font-medium text-destructive transition hover:bg-red-600/10 disabled:opacity-40 dark:border-red-400/30 dark:hover:bg-red-400/10"
              >
                Alle löschen
              </button>
            )}
          </div>
        )}
        {/*
          Verwendetes Modell des aktiven Entwurfs – nur bei aktivierter
          Einstellung und wenn es (nicht bei Altbeständen) bekannt ist.
        */}
        {showModel && variantenMeta[aktiv]?.modell?.trim() && (
          <p className="mb-3 text-xs text-muted-foreground">
            Erzeugt mit{" "}
            <span className="font-mono">{variantenMeta[aktiv].modell}</span>
          </p>
        )}
        <div className="mb-3 flex flex-col gap-2">
          {/*
            Erzählform und Ton des Handlungsentwurfs – eigene Werte neben denen
            des Story Arcs, damit Entwurf und Arc unabhängig einstellbar sind.
            Erzählform = welche Art Geschichte (Krimi, Liebe …), Ton = wie
            erzählt. Zwei getrennte Achsen, beide unabhängig vom Genre der Welt.
          */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <span>Erzählform:</span>
              <select
                value={handlungForm}
                onChange={(e) => setHandlungForm(e.target.value as StoryForm)}
                disabled={saving || generatingField !== null}
                title="Die Art der Geschichte (Krimi, Liebe, Abenteuer …) – prägt Konflikt und Aufbau des Entwurfs, unabhängig vom Genre der Welt. „Allround“ = gemischt wie bisher."
                className="rounded-md border border-border bg-card px-2 py-1 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
              >
                {STORY_FORMS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <span>Ton:</span>
              <select
                value={handlungTon}
                onChange={(e) => setHandlungTon(e.target.value as StoryTone)}
                disabled={saving || generatingField !== null}
                title="Ton und Sprache des Handlungsentwurfs – nimmt den Ton der späteren Geschichte vorweg"
                className="rounded-md border border-border bg-card px-2 py-1 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
              >
                {STORY_TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            {/*
              Modell-Anbieter **nur für diesen Entwurf**. „Standard" (Default)
              folgt der Einstellungsseite (Modell je Story-Erzeugung bzw. das
              globale Textmodell); ein konkreter Anbieter übersteuert das nur für
              „✨ Neu erzeugen" hier.
            */}
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <span>Modell:</span>
              <select
                value={handlungProvider}
                onChange={(e) =>
                  setHandlungProvider(e.target.value as TextProvider | "")
                }
                disabled={saving || generatingField !== null}
                title="Welches Textmodell diesen Handlungsentwurf erzeugt. „Standard&quot; folgt der Einstellungsseite; die Wahl hier gilt nur für den Entwurf und wird nicht gespeichert."
                className="rounded-md border border-border bg-card px-2 py-1 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
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

          {/*
            Handlung weiterspinnen – **immer** sichtbar, denn es gilt auch für
            den frischen Entwurf: eine vollständige Geschichte (mit Ende) statt
            der offenen Ausgangslage.
          */}
          <label
            className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground"
            title="Angehakt skizziert „✨ Neu erzeugen“ eine vollständige Geschichte – von der Ausgangslage über die Zuspitzung bis zu einem Ende – statt einer offenen Ausgangslage. Gilt auch beim Aufbauen auf einem vorhandenen Entwurf."
          >
            <input
              type="checkbox"
              checked={handlungWeiterspinnen}
              onChange={(e) => setHandlungWeiterspinnen(e.target.checked)}
              disabled={saving || generatingField !== null}
              className="size-4 accent-primary"
            />
            🧵 Handlung weiterspinnen – vollständige Geschichte statt offener
            Ausgangslage
          </label>

          {/*
            Ob eine Figur einfließt, steuert ihr eigenes Häkchen an der Karte in
            der Figuren-Sektion oben – es gilt für Handlungsentwurf und Story Arc
            zugleich. Deshalb sitzt hier keine Figuren-Checkbox mehr.
          */}

          {/*
            Nächsten Entwurf auf dem aktuellen aufbauen. Erscheint nur, wenn es
            einen gibt – ohne Grundlage ist die Wahl leer. Die Stichwörter im
            Feld-Kopf steuern dann zusätzlich, wohin sich die neue Fassung
            verschiebt.
          */}
          {details.handlung.trim() && (
            <label
              className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground"
              title="Der nächste „✨ Neu erzeugen“-Lauf nimmt den angezeigten Entwurf als Grundlage und formt daraus eine neue Fassung – statt frei aus Welt und Figuren zu beginnen. Die Stichwörter wirken zusätzlich."
            >
              <input
                type="checkbox"
                checked={handlungAlsBasis}
                onChange={(e) => setHandlungAlsBasis(e.target.checked)}
                disabled={saving || generatingField !== null}
                className="size-4 accent-primary"
              />
              aktuellen Handlungsentwurf bei neuem Entwurf verwenden
            </label>
          )}

          {/*
            Neue benannte Personen auf Wunsch – lockert die harte Regel „keine
            neuen Hauptfiguren". 0 = aus (wie bisher). Bei ≥1 erscheint ein
            optionales Feld für gewünschte Namen/Rollen; leer erfindet die KI
            sie. Gilt für „Neu erzeugen", frisch wie auf Basis. Nicht gespeichert.
            Danach lassen sich die Neuen über „Personen im Entwurf suchen"
            als Charaktere anlegen.
          */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <label className="flex items-center gap-2">
              <span>👥 Neue Personen:</span>
              <select
                value={handlungNeuePersonen}
                onChange={(e) =>
                  setHandlungNeuePersonen(Number(e.target.value))
                }
                disabled={saving || generatingField !== null}
                title="Wie viele neue, benannte Personen der Entwurf zusätzlich einführt. Wirkt auf „Neu erzeugen“ – frisch wie auf Basis eines vorhandenen Entwurfs."
                className="rounded-md border border-border bg-card px-2 py-1 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
              >
                <option value={0}>aus</option>
                {Array.from({ length: MAX_NEUE_PLOT_PERSONEN }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
            {handlungNeuePersonen >= 1 && (
              <input
                value={handlungNeuePersonenWunsch}
                onChange={(e) =>
                  setHandlungNeuePersonenWunsch(e.target.value)
                }
                disabled={saving || generatingField !== null}
                maxLength={500}
                placeholder="optional: Namen/Rollen – z. B. „Mira (Schwester); ein korrupter Beamter“"
                title="Gewünschte Namen oder Rollen der neuen Personen. Leer gelassen erfindet die KI sie stimmig aus Welt und Konflikt. Wird nicht gespeichert."
                aria-label="Gewünschte Namen oder Rollen der neuen Personen"
                className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-1 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
              />
            )}
          </div>
        </div>

        <ScenarioFields
          details={details}
          onChange={setDetails}
          disabled={saving}
          fields={["handlung"]}
          generatable={ERZEUGBAR}
          onGenerate={handleGenerate}
          generatingField={generatingField}
          zusatz={zusatz}
          onZusatzChange={(key, value) =>
            setZusatz((z) => ({ ...z, [key]: value }))
          }
          hideLabel
        />

        {/*
          Entwurf fortsetzen – anders als „✨ Neu erzeugen" (neuer Reiter) wächst
          der vorhandene Text im Feld weiter: die KI knüpft ans Ende an, die
          Fortsetzung wird angehängt. Nur sichtbar, wenn ein Entwurf da ist.
        */}
        {details.handlung.trim() && (
          <div className="mt-3">
            <button
              type="button"
              onClick={handlungFortsetzen}
              disabled={saving || generatingField !== null}
              title="Knüpft an das Ende des aktuellen Entwurfs an und schreibt weiter. Die Fortsetzung wird an den vorhandenen Text angehängt (nicht als neuer Reiter). Nutzt Ton, Erzählform, „Weiterspinnen“ und die Stichwörter wie „Neu erzeugen“."
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
            >
              {generatingField === "handlung"
                ? "Setze fort …"
                : "⏩ Entwurf fortsetzen"}
            </button>
          </div>
        )}

        {/*
          Personen aus dem Handlungsentwurf – direkt unter dem Feld, weil sie
          sich darauf beziehen.

          Bewusst **auf Knopfdruck** und nicht beim Öffnen der Seite: Die Suche
          ist ein KI-Aufruf, und im Projekt löst jede Erzeugung ein Klick aus.
          Ein Aufruf, der beim bloßen Ansehen eines Szenarios Geld kostet, wäre
          der erste seiner Art.
        */}
        {details.handlung.trim() && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={personenSuchen}
                disabled={suchend}
                title="Sucht im Handlungsentwurf nach Personen, die dem Szenario noch nicht zugeordnet sind"
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
              >
                {suchend ? "Sucht …" : "🔍 Personen im Entwurf suchen"}
              </button>
              {personen === null && !suchend && (
                <span className="text-xs text-muted-foreground">
                  Findet Namen, für die es noch keinen Charakter gibt.
                </span>
              )}
            </div>

            {suchFehler && (
              <p className="mt-2 text-xs text-destructive">
                {suchFehler}
              </p>
            )}

            {personen !== null &&
              (personen.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Keine neuen Personen – der Entwurf nennt nur Figuren, die dem
                  Szenario schon zugeordnet sind.
                </p>
              ) : (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-muted-foreground">
                    Noch nicht im Szenario – anklicken, um daraus einen Charakter
                    anzulegen:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {personen.map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setGewaehlt(p)}
                        title={`Charakter für „${p.name}" anlegen`}
                        className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-500/20 dark:text-amber-300"
                      >
                        + {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </section>

      {/*
        Der Story Arc sitzt direkt unter dem Handlungsentwurf: Er ist dessen
        dramaturgische Zerlegung und leitet sich aus der **aktiven** Variante ab.
        Wie die Varianten und Ansatzpunkte lebt er im Bearbeitungs-Zustand und
        geht über „Änderungen speichern" bzw. „Verwerfen".
      */}
      <StoryArcSection
        storyArc={storyArc}
        onChange={setStoryArc}
        onAbleiten={storyArcAbleiten}
        busy={arcBusy}
        error={arcFehler}
        params={arcParams}
        onParamsChange={setArcParams}
        onKapitelAbleiten={kapitelAbleiten}
        kapitelBusy={kapitelBusy}
        kapitelError={kapitelFehler}
        onKapitelText={kapitelTextGenerieren}
        kapitelTextBusy={kapitelTextBusy}
        kapitelTextError={kapitelTextFehler}
        disabled={saving}
        handlung={details.handlung}
        quelleLabel={
          variantenMeta[aktiv]?.titel?.trim() || `Entwurf ${aktiv + 1}`
        }
        arcs={aktuelleArcs()}
        arcAktiv={arcAktiv}
        arcMeta={ausgerichtet(arcMeta, aktuelleArcs().length)}
        onArcWaehlen={arcWaehlen}
        onArcTitelAendern={arcTitelAendern}
        onArcTitelNeu={arcTitelNeu}
        arcTitelBusy={arcTitelBusy}
        onArcFavorit={arcFavoritUmschalten}
        onArcKopieren={arcKopieren}
        onArcLoeschen={arcLoeschen}
        onAlleArcsLoeschen={alleArcsLoeschen}
        coverCharaktere={coverCharaktere}
        onArcCover={arcCoverSetzen}
        onArcAlsBuch={arcAlsBuchSetzen}
        weltbild={weltbildVorschau}
        showModel={showModel}
        kapitelModell={kapitelModell}
        storyTextModell={storyTextModell}
        provider={arcProvider}
        onProviderChange={setArcProvider}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          onClick={exportieren}
          disabled={exportiert}
          title="Schreibt Festlegungen und – wenn angehakt – die zugeordneten Charaktere samt Bildern in eine Datei"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
        >
          {exportiert ? "Sammle Daten …" : "Als Datei exportieren"}
        </button>

        {/*
          Die Checkbox steht **neben** dem Knopf und nicht darüber: Anders als
          bei der Ableitung gibt es hier keinen Startzustand, in dem man sie
          allein anträfe – der Export ist ein einzelner Klick, und die Wahl
          gehört unmittelbar an ihn.

          Ausgegraut, sobald das Szenario leer ist: Ein Häkchen, das nichts
          bewirken kann, wäre ein falsches Versprechen.
        */}
        <label
          className={`flex items-center gap-2 text-sm ${
            characters.length === 0
              ? "cursor-not-allowed text-muted-foreground"
              : "cursor-pointer text-muted-foreground"
          }`}
        >
          <input
            type="checkbox"
            checked={mitCharakteren && characters.length > 0}
            onChange={(e) => setMitCharakteren(e.target.checked)}
            disabled={exportiert || characters.length === 0}
            className="size-4 accent-primary"
          />
          {characters.length === 0
            ? "Keine Charaktere zugeordnet"
            : `Charaktere mitexportieren (${characters.length})`}
        </label>

        {/*
          Bilder mitexportieren – Default an. Ohne Häkchen bleiben Weltbild und
          Charakter-Bilder weg: eine schlanke Datei nur aus Texten/Festlegungen.
        */}
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={mitBildern}
            onChange={(e) => setMitBildern(e.target.checked)}
            disabled={exportiert}
            className="size-4 accent-primary"
          />
          Bilder mitexportieren
        </label>

        {exportFehler && (
          <span className="text-sm text-destructive">
            {exportFehler}
          </span>
        )}

        <button
          onClick={entfernen}
          className="ml-auto rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
        >
          Szenario löschen
        </button>
      </div>

      {gewaehlt && (
        <PlotPersonModal
          person={gewaehlt}
          dirty={dirty}
          onConfirm={() => personAnlegen(gewaehlt)}
          onClose={() => setGewaehlt(null)}
        />
      )}

      {/*
        Bestätigung fürs Ableiten aus einer Figur-Karte. `dirty={false}`, weil
        dieser Weg vor der Navigation **speichert** (`figurCharakterAnlegen`) –
        der „erst speichern"-Hinweis der Plot-Suche gilt hier also nicht.
      */}
      {figurKandidat && (
        <PlotPersonModal
          person={figurKandidat.person}
          dirty={false}
          onConfirm={figurCharakterAnlegen}
          onClose={() => setFigurKandidat(null)}
        />
      )}

      {addOffen && (
        <AddCharacterToScenarioModal
          scenarioId={id}
          scenarios={allScenarios}
          onAdded={charHinzugefuegt}
          onClose={() => setAddOffen(false)}
        />
      )}

      {bildModalOffen && (
        <ScenarioImageModal
          scenarioId={id}
          name={name}
          details={details}
          images={bilder}
          onChange={(s) => setBilder(s.images)}
          onClose={() => setBildModalOffen(false)}
        />
      )}

      {selectedChar && (
        <CharacterDetailModal
          key={selectedChar.id}
          character={selectedChar}
          scenarios={allScenarios}
          onClose={() => setSelectedChar(null)}
          onDelete={() => charLoeschen(selectedChar.id)}
          onSaveContent={(character, storyHooks, genre) =>
            charInhaltSpeichern(selectedChar.id, character, storyHooks, genre)
          }
          onCharacterUpdated={charAktualisiert}
          onAssignScenario={(scenarioId) =>
            charZuordnen(selectedChar.id, scenarioId)
          }
          onScenarioCreated={(scenario) =>
            setAllScenarios((gs) =>
              [...gs, scenario].sort((a, b) => a.name.localeCompare(b.name)),
            )
          }
        />
      )}

      {genreSync && (
        <GenreSyncModal
          genreLabel={(() => {
            const g = GENRE_TEMPLATES.find((t) => t.id === genreSync.genre);
            return g ? `${g.emoji} ${g.label}` : genreSync.genre;
          })()}
          anzahl={genreSync.betroffen.length}
          busy={genreSyncBusy}
          fehler={genreSyncFehler}
          onConfirm={genreUebertragen}
          onClose={() => {
            if (!genreSyncBusy) setGenreSync(null);
          }}
        />
      )}
    </div>
  );
}
