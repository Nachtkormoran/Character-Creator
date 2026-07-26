"use client";

import { use, useEffect, useState } from "react";
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
  generateScenarioPlot,
  generateStoryArc,
  generateStoryTitle,
  generateChapterText,
  generateStoryArcChapters,
  getScenario,
  listScenarios,
  updateCharacterContent,
  updateCharacterProtagonist,
  updateCharacterScenario,
  updateScenario,
} from "@/lib/client";
import { downloadBlob, safeFileName } from "@/lib/download";
import { scenarioFileName } from "@/lib/scenarioFile";
import {
  DEFAULT_ARC_FORMAT,
  DEFAULT_ARC_LENGTH,
  DEFAULT_KAPITEL_COUNT,
  DEFAULT_STORY_FORM,
  DEFAULT_STORY_TONE,
  MAX_NEUE_PLOT_PERSONEN,
  MAX_PLOT_VARIANTS,
  MAX_STORY_ARCS,
  SCENARIO_LABELS,
  STORY_FORMS,
  STORY_TONES,
  normalizeScenarioDetails,
  variantBadge,
  type ArcFormat,
  type ArcLength,
  type KapitelCount,
  type StoryForm,
  type StoryTone,
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
  type StoredScenario,
} from "@/lib/serialize";
import { AddCharacterToScenarioModal } from "../../components/AddCharacterToScenarioModal";
import { CharacterDetailModal } from "../../components/CharacterDetailModal";
import { PlotPersonModal } from "../../components/PlotPersonModal";
import { ScenarioFields } from "../../components/ScenarioFields";
import { ScenarioImageModal } from "../../components/ScenarioImageModal";
import { StoryArcSection } from "../../components/StoryArcSection";

/** Leere Metadaten – für neue leere/von Hand angelegte Varianten und als Rückfall. */
const LEER_META: VariantMeta = { titel: "", form: "", ton: "" };

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
  /**
   * Länge, Format und Zusatzwunsch für die Arc-Erzeugung – wie beim
   * Handlungsentwurf **nicht gespeichert**: Sie beschreiben einen Lauf, nicht
   * den Arc.
   */
  const [arcParams, setArcParams] = useState<{
    laenge: ArcLength;
    format: ArcFormat;
    zusatz: string;
    /** Zufällige Impulse + höhere Temperatur, für Arc **und** Kapitel. */
    kreativ: boolean;
    /** Aus der offenen Ausgangslage eine vollständige Geschichte entwickeln. */
    weiterspinnen: boolean;
    /** Wie viele Kapitel ein „Kapitel ableiten" erzeugt. */
    kapitelAnzahl: KapitelCount;
    /** Ton und Sprache – für Arc **und** Kapitel. */
    ton: StoryTone;
    /** Erzählform (Krimi, Liebe, …) – für Arc **und** Kapitel. */
    form: StoryForm;
  }>({
    laenge: DEFAULT_ARC_LENGTH,
    format: DEFAULT_ARC_FORMAT,
    zusatz: "",
    kreativ: false,
    weiterspinnen: false,
    kapitelAnzahl: DEFAULT_KAPITEL_COUNT,
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
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
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
   * Das **gespeicherte** Bild als Thumbnail (oder `null`). Die gesamte
   * Bild-Bedienung (Erzeugen, Hochladen, Löschen, Exportieren, Vollbild) liegt
   * in `ScenarioImageModal`; die Detailseite zeigt nur das Thumbnail und den
   * Knopf, der die Ansicht öffnet. Das Modal meldet ein geändertes Bild über
   * `onChange` zurück, damit das Thumbnail hier aktuell bleibt.
   */
  const [thumbnail, setThumbnail] = useState<string | null>(null);
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
        const { handlung } = await generateScenarioPlot(
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
          { titel, form: handlungForm, ton: handlungTon },
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

  useEffect(() => {
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
        setThumbnail(scenario.thumbnail);
        setSaved(
          JSON.stringify({
            name: scenario.name,
            details: scenario.details,
            plot: scenario.plotVariants,
            arc: scenario.storyArcVariants,
          }),
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler."))
      .finally(() => setLoading(false));
  }, [id]);

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
      const { storyArc: neu } = await generateStoryArc(id, details.handlung, {
        laenge: arcParams.laenge,
        format: arcParams.format,
        zusatz: arcParams.zusatz,
        kreativ: arcParams.kreativ,
        weiterspinnen: arcParams.weiterspinnen,
        ton: arcParams.ton,
        form: arcParams.form,
        // Nur die **aktiven** Figuren (reiner Text); sind keine aktiv, leer.
        figuren: aktiveFiguren(details.figuren),
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
      const alt = aktuelleArcs();
      setArcVarianten([...alt, neu]);
      setArcAktiv(alt.length);
      setStoryArc(neu);
      setArcMeta([
        ...ausgerichtet(arcMeta, alt.length),
        { titel, form: arcParams.form, ton: arcParams.ton },
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
      const { kapitel } = await generateStoryArcChapters(
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
        },
      );
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
      const { text } = await generateChapterText(
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
        { ton: arcParams.ton, kreativ: arcParams.kreativ, form: arcParams.form },
      );
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
        // Das Weltbild ist unabhängig vom bearbeiteten Stand (eigene Route,
        // sofort gespeichert) – gibt es ein Thumbnail, gibt es ein Original.
        { scenarioId: id, vorhanden: !!thumbnail },
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

  if (loading) return <p className="text-foreground/60">Lade Szenario …</p>;
  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
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
          className="text-sm text-foreground/60 transition hover:text-foreground"
        >
          ← Szenarien
        </Link>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Name des Szenarios"
          className="mt-1 -mx-2 w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-3xl font-semibold tracking-tight outline-none transition hover:border-black/15 focus:border-black/40 dark:hover:border-white/15 dark:focus:border-white/40"
        />
      </div>

      {dirty && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <span className="text-sm text-amber-800 dark:text-amber-300">
            Ungespeicherte Änderungen
          </span>
          <button
            onClick={save}
            disabled={saving || !nameValid}
            className="ml-auto rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
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
            className="text-sm text-foreground/60 transition hover:text-foreground disabled:opacity-50"
          >
            Verwerfen
          </button>
          {saveError && (
            <span className="w-full text-xs text-red-600 dark:text-red-400">
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
      <section className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
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
            <span className="text-sm font-medium">Weltbild</span>

            <button
              type="button"
              onClick={() => setBildModalOffen(true)}
              title={thumbnail ? "Weltbild verwalten" : "Weltbild hinzufügen"}
              className="relative aspect-square w-full overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] transition hover:border-black/25 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-white/25"
            >
              {thumbnail ? (
                <Image
                  src={thumbnail}
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
            </button>

            <button
              type="button"
              onClick={() => setBildModalOffen(true)}
              className="w-full rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06]"
            >
              {thumbnail ? "🖼️ Weltbild verwalten" : "🏞️ Weltbild hinzufügen"}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-foreground/60 uppercase">
          Festlegungen
        </h2>
        <ScenarioFields
          details={details}
          onChange={setDetails}
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
      <section className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-foreground/60 uppercase">
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
              className="rounded-md border border-black/15 px-3 py-1.5 text-xs font-medium transition hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06]"
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
              className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90"
            >
              + Neuen erstellen
            </Link>
          </div>
        </div>
        {characters.length > 0 && (
          <p className="mb-3 text-xs text-foreground/50">
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
          <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-foreground/60 dark:border-white/15">
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
                    className={`flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border bg-white text-left transition hover:shadow-md dark:bg-white/[0.03] ${
                      c.isProtagonist
                        ? "border-amber-400 ring-1 ring-amber-400/60 dark:border-amber-400/70"
                        : "border-black/10 dark:border-white/10"
                    }`}
                  >
                    <div className="relative aspect-square w-full bg-black/[0.03] dark:bg-white/[0.03]">
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
        <div className="mt-6 border-t border-black/10 pt-5 dark:border-white/10">
          <h3 className="mb-1 text-sm font-semibold tracking-wide text-foreground/60 uppercase">
            Figuren
          </h3>
          <p className="mb-3 text-xs text-foreground/50">
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
            <p className="mt-3 border-t border-black/10 pt-3 text-xs text-foreground/50 dark:border-white/10">
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
      <section className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
        {/*
          Handlungselemente – die persistenten Vorgaben für die Erzeugung: was der
          nächste „✨ Neu erzeugen“-Lauf aufgreift. Aktive Elemente (Häkchen)
          fließen ein; die einmalige Stichwörter-Zeile im Entwurf-Kopf wirkt
          zusätzlich. Ein zufällig erzeugtes Szenario füllt die Liste mit.
        */}
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-foreground/60 uppercase">
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

        <h2 className="mt-6 mb-4 text-sm font-semibold tracking-wide text-foreground/60 uppercase">
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
            <span className="mr-1 text-xs font-medium text-foreground/50">
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
                      ? "border-foreground bg-foreground text-background"
                      : "border-black/15 hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => varianteWaehlen(i)}
                    disabled={saving || generatingField !== null}
                    title={text.trim().slice(0, 200) || "(leerer Entwurf)"}
                    className={`flex flex-col items-start gap-0.5 py-1 pl-2.5 text-left disabled:opacity-50 ${
                      loeschbar || i === aktiv ? "pr-1" : "pr-2.5"
                    }`}
                  >
                    <span className="max-w-[15rem] truncate font-medium">
                      {titel}
                    </span>
                    {badge && (
                      <span
                        className={`text-[10px] leading-tight ${
                          i === aktiv
                            ? "text-background/70"
                            : "text-foreground/50"
                        }`}
                      >
                        {badge}
                      </span>
                    )}
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
                          : "hover:text-red-600 dark:hover:text-red-400"
                      }`}
                    >
                      ✕
                    </button>
                  )}
                </span>
              );
            })}
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
              className="rounded-full border border-black/15 px-2.5 py-1 text-xs font-medium text-foreground/70 transition hover:bg-black/[0.04] disabled:opacity-40 dark:border-white/15 dark:hover:bg-white/[0.06]"
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
              <span className="text-xs text-foreground/50">
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
                className="ml-auto rounded-full border border-red-600/30 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-600/10 disabled:opacity-40 dark:border-red-400/30 dark:text-red-400 dark:hover:bg-red-400/10"
              >
                Alle löschen
              </button>
            )}
          </div>
        )}
        <div className="mb-3 flex flex-col gap-2">
          {/*
            Erzählform und Ton des Handlungsentwurfs – eigene Werte neben denen
            des Story Arcs, damit Entwurf und Arc unabhängig einstellbar sind.
            Erzählform = welche Art Geschichte (Krimi, Liebe …), Ton = wie
            erzählt. Zwei getrennte Achsen, beide unabhängig vom Genre der Welt.
          */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground/70">
              <span>Erzählform:</span>
              <select
                value={handlungForm}
                onChange={(e) => setHandlungForm(e.target.value as StoryForm)}
                disabled={saving || generatingField !== null}
                title="Die Art der Geschichte (Krimi, Liebe, Abenteuer …) – prägt Konflikt und Aufbau des Entwurfs, unabhängig vom Genre der Welt. „Allround“ = gemischt wie bisher."
                className="rounded-md border border-black/15 bg-white px-2 py-1 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
              >
                {STORY_FORMS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground/70">
              <span>Ton:</span>
              <select
                value={handlungTon}
                onChange={(e) => setHandlungTon(e.target.value as StoryTone)}
                disabled={saving || generatingField !== null}
                title="Ton und Sprache des Handlungsentwurfs – nimmt den Ton der späteren Geschichte vorweg"
                className="rounded-md border border-black/15 bg-white px-2 py-1 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
              >
                {STORY_TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
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
            className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground/70"
            title="Angehakt skizziert „✨ Neu erzeugen“ eine vollständige Geschichte – von der Ausgangslage über die Zuspitzung bis zu einem Ende – statt einer offenen Ausgangslage. Gilt auch beim Aufbauen auf einem vorhandenen Entwurf."
          >
            <input
              type="checkbox"
              checked={handlungWeiterspinnen}
              onChange={(e) => setHandlungWeiterspinnen(e.target.checked)}
              disabled={saving || generatingField !== null}
              className="size-4 accent-foreground"
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
              className="flex w-fit cursor-pointer items-center gap-2 text-sm text-foreground/70"
              title="Der nächste „✨ Neu erzeugen“-Lauf nimmt den angezeigten Entwurf als Grundlage und formt daraus eine neue Fassung – statt frei aus Welt und Figuren zu beginnen. Die Stichwörter wirken zusätzlich."
            >
              <input
                type="checkbox"
                checked={handlungAlsBasis}
                onChange={(e) => setHandlungAlsBasis(e.target.checked)}
                disabled={saving || generatingField !== null}
                className="size-4 accent-foreground"
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
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/70">
            <label className="flex items-center gap-2">
              <span>👥 Neue Personen:</span>
              <select
                value={handlungNeuePersonen}
                onChange={(e) =>
                  setHandlungNeuePersonen(Number(e.target.value))
                }
                disabled={saving || generatingField !== null}
                title="Wie viele neue, benannte Personen der Entwurf zusätzlich einführt. Wirkt auf „Neu erzeugen“ – frisch wie auf Basis eines vorhandenen Entwurfs."
                className="rounded-md border border-black/15 bg-white px-2 py-1 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
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
                className="min-w-0 flex-1 rounded-md border border-black/15 bg-white px-3 py-1 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
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
          Personen aus dem Handlungsentwurf – direkt unter dem Feld, weil sie
          sich darauf beziehen.

          Bewusst **auf Knopfdruck** und nicht beim Öffnen der Seite: Die Suche
          ist ein KI-Aufruf, und im Projekt löst jede Erzeugung ein Klick aus.
          Ein Aufruf, der beim bloßen Ansehen eines Szenarios Geld kostet, wäre
          der erste seiner Art.
        */}
        {details.handlung.trim() && (
          <div className="mt-4 border-t border-black/10 pt-4 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={personenSuchen}
                disabled={suchend}
                title="Sucht im Handlungsentwurf nach Personen, die dem Szenario noch nicht zugeordnet sind"
                className="rounded-md border border-black/15 px-2.5 py-1 text-xs font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
              >
                {suchend ? "Sucht …" : "🔍 Personen im Entwurf suchen"}
              </button>
              {personen === null && !suchend && (
                <span className="text-xs text-foreground/50">
                  Findet Namen, für die es noch keinen Charakter gibt.
                </span>
              )}
            </div>

            {suchFehler && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                {suchFehler}
              </p>
            )}

            {personen !== null &&
              (personen.length === 0 ? (
                <p className="mt-2 text-xs text-foreground/50">
                  Keine neuen Personen – der Entwurf nennt nur Figuren, die dem
                  Szenario schon zugeordnet sind.
                </p>
              ) : (
                <div className="mt-3">
                  <p className="mb-2 text-xs text-foreground/60">
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
        onArcLoeschen={arcLoeschen}
        onAlleArcsLoeschen={alleArcsLoeschen}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-4 dark:border-white/10">
        <button
          onClick={exportieren}
          disabled={exportiert}
          title="Schreibt Festlegungen und – wenn angehakt – die zugeordneten Charaktere samt Bildern in eine Datei"
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
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
              ? "cursor-not-allowed text-foreground/40"
              : "cursor-pointer text-foreground/70"
          }`}
        >
          <input
            type="checkbox"
            checked={mitCharakteren && characters.length > 0}
            onChange={(e) => setMitCharakteren(e.target.checked)}
            disabled={exportiert || characters.length === 0}
            className="size-4 accent-foreground"
          />
          {characters.length === 0
            ? "Keine Charaktere zugeordnet"
            : `Charaktere mitexportieren (${characters.length})`}
        </label>

        {exportFehler && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {exportFehler}
          </span>
        )}

        <button
          onClick={entfernen}
          className="ml-auto rounded-md border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 dark:text-red-400"
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
          thumbnail={thumbnail}
          onChange={setThumbnail}
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
    </div>
  );
}
