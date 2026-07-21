"use client";

import { use, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buildScenarioFile,
  deleteScenario,
  deleteScenarioImage,
  findPlotPersons,
  generateScenarioDescription,
  generateScenarioField,
  generateScenarioImage,
  generateScenarioPlot,
  getScenario,
  getScenarioImage,
  saveScenarioImage,
  updateScenario,
} from "@/lib/client";
import { downloadBlob, safeFileName } from "@/lib/download";
import { fileToDataUrl } from "@/lib/image";
import { scenarioFileName } from "@/lib/scenarioFile";
import {
  DEFAULT_IMAGE_STYLE,
  IMAGE_STYLES,
  MAX_PLOT_VARIANTS,
  SCENARIO_LABELS,
  normalizeScenarioDetails,
  type PlotPerson,
  type PlotVariants,
  type ScenarioDetails,
} from "@/lib/schema";
import { stashPlotPerson } from "@/lib/personHandoff";
import { primaryImage, type StoredCharacter } from "@/lib/serialize";
import { ImageLightbox } from "../../components/ImageLightbox";
import { PlotPersonModal } from "../../components/PlotPersonModal";
import { ScenarioFields } from "../../components/ScenarioFields";

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
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
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

  // -------------------------------------------------------------------------
  // Weltbild des Szenarios
  // -------------------------------------------------------------------------

  /**
   * Das **gespeicherte** Bild als Thumbnail (oder `null`). Das Original reist
   * nicht mit – es wird für das Vollbild einzeln über `getScenarioImage`
   * geholt, wie bei den Charakter-Bildern.
   */
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  /**
   * Ein frisch erzeugtes oder hochgeladenes Bild, das **noch nicht gespeichert**
   * ist. Solange ein Kandidat vorliegt, wird er statt des gespeicherten Bilds
   * gezeigt – erst „Übernehmen" ersetzt das gespeicherte. So zerstört ein
   * probeweises „Neu erzeugen" das vorhandene Bild nicht, bis eins gefällt.
   */
  const [kandidat, setKandidat] = useState<string | null>(null);
  const [bildStil, setBildStil] = useState<string>(DEFAULT_IMAGE_STYLE);
  const [bildZusatz, setBildZusatz] = useState("");
  const [bildBusy, setBildBusy] = useState(false);
  const [bildFehler, setBildFehler] = useState<string | null>(null);
  /** Original fürs Vollbild – geladen bei Klick auf das gespeicherte Bild. */
  const [vollbild, setVollbild] = useState<string | null>(null);
  const dateiWahl = useRef<HTMLInputElement>(null);

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
  async function handleGenerate(key: keyof ScenarioDetails) {
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
      } else if (key === "handlung") {
        // Jeder Lauf hängt einen **neuen** Entwurf an und schaltet auf ihn um –
        // der vorige bleibt als Variante erhalten.
        if (aktuelleVarianten().length >= MAX_PLOT_VARIANTS) {
          setSaveError(
            `Mehr als ${MAX_PLOT_VARIANTS} Entwürfe werden nicht gespeichert. Lösche einen, um Platz zu schaffen.`,
          );
          return;
        }
        const { handlung } = await generateScenarioPlot(
          id,
          name.trim(),
          details,
          zusatz.handlung ?? "",
        );
        const items = [...aktuelleVarianten(), handlung];
        setVarianten(items);
        setAktiv(items.length - 1);
        setDetails((d) => ({ ...d, handlung }));
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
   * Ein Weltbild erzeugen. Es landet als **Kandidat** (ungespeichert) – das
   * gespeicherte Bild bleibt, bis „Übernehmen" es ersetzt. Die Festlegungen
   * gehen im aktuellen, womöglich ungespeicherten Stand mit; die Route
   * persistiert nichts.
   */
  async function bildErzeugen() {
    if (bildBusy) return;
    setBildBusy(true);
    setBildFehler(null);
    try {
      const { imageData } = await generateScenarioImage(details, bildStil, {
        extraPrompt: bildZusatz.trim() || undefined,
      });
      setKandidat(imageData);
    } catch (e) {
      setBildFehler(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setBildBusy(false);
    }
  }

  /** Ein eigenes Bild hochladen – ebenfalls erst Kandidat, dann „Übernehmen". */
  async function bildHochladen(file: File) {
    setBildFehler(null);
    try {
      setKandidat(await fileToDataUrl(file));
    } catch (e) {
      setBildFehler(e instanceof Error ? e.message : "Datei fehlerhaft.");
    }
  }

  /** Den Kandidaten speichern – ersetzt das bisherige Bild. */
  async function bildUebernehmen() {
    if (!kandidat || bildBusy) return;
    setBildBusy(true);
    setBildFehler(null);
    try {
      const s = await saveScenarioImage(id, kandidat);
      setThumbnail(s.thumbnail);
      setKandidat(null);
    } catch (e) {
      setBildFehler(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setBildBusy(false);
    }
  }

  async function bildLoeschen() {
    if (bildBusy || !thumbnail) return;
    if (!confirm("Das Szenario-Bild löschen?")) return;
    setBildBusy(true);
    setBildFehler(null);
    try {
      const s = await deleteScenarioImage(id);
      setThumbnail(s.thumbnail);
    } catch (e) {
      setBildFehler(e instanceof Error ? e.message : "Löschen fehlgeschlagen.");
    } finally {
      setBildBusy(false);
    }
  }

  /** Original fürs Vollbild nachladen (das Thumbnail ist nur die Vorschau). */
  async function vollbildOeffnen() {
    try {
      setVollbild(await getScenarioImage(id));
    } catch (e) {
      setBildFehler(e instanceof Error ? e.message : "Bild laden fehlgeschlagen.");
    }
  }

  useEffect(() => {
    getScenario(id)
      .then(({ scenario, characters }) => {
        setName(scenario.name);
        setDetails(scenario.details);
        setVarianten(scenario.plotVariants.items);
        setAktiv(scenario.plotVariants.aktiv);
        setCharacters(characters);
        setThumbnail(scenario.thumbnail);
        setSaved(
          JSON.stringify({
            name: scenario.name,
            details: scenario.details,
            plot: scenario.plotVariants,
          }),
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler."))
      .finally(() => setLoading(false));
  }, [id]);

  // Der aktuelle Stand als Vergleichswert für den „Ungespeichert"-Balken. Die
  // Handlungsvarianten gehören dazu: Umschalten und Anhängen sind Änderungen,
  // die gespeichert werden wollen.
  const dirty =
    saved !== "" &&
    JSON.stringify({
      name,
      details,
      plot: { items: aktuelleVarianten(), aktiv },
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
   */
  function personAnlegen(person: PlotPerson) {
    stashPlotPerson(person);
    router.push(`/?scenario=${id}`);
  }

  async function save() {
    if (!dirty || !nameValid || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const aktualisiert = await updateScenario(id, {
        name: name.trim(),
        details,
        plotVariants: { items: aktuelleVarianten(), aktiv },
      });
      setName(aktualisiert.name);
      setDetails(aktualisiert.details);
      setVarianten(aktualisiert.plotVariants.items);
      setAktiv(aktualisiert.plotVariants.aktiv);
      setSaved(
        JSON.stringify({
          name: aktualisiert.name,
          details: aktualisiert.details,
          plot: aktualisiert.plotVariants,
        }),
      );
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Fehler.");
    } finally {
      setSaving(false);
    }
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
        { name: name.trim(), details },
        mitCharakteren ? characters : [],
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
              };
              setName(s.name);
              setDetails(s.details);
              setVarianten(s.plot.items);
              setAktiv(s.plot.aktiv);
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

          {/* Rechts: das Weltbild samt Steuerung (Bild oben, Knöpfe darunter). */}
          <div className="order-1 flex flex-col gap-3 md:order-2">
            <span className="text-sm font-medium">Weltbild</span>

            {/* Kandidat (ungespeichert) hat Vorrang vor dem gespeicherten Bild. */}
            <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03]">
              {kandidat ? (
                <Image
                  src={kandidat}
                  alt="Vorschau des Szenario-Bilds"
                  fill
                  sizes="240px"
                  className="object-cover"
                  unoptimized
                />
              ) : thumbnail ? (
                <button
                  type="button"
                  onClick={vollbildOeffnen}
                  title="In voller Größe ansehen"
                  className="absolute inset-0 h-full w-full cursor-zoom-in"
                >
                  <Image
                    src={thumbnail}
                    alt={`Weltbild von ${name}`}
                    fill
                    sizes="240px"
                    className="object-cover"
                    unoptimized
                  />
                </button>
              ) : (
                <div className="flex h-full items-center justify-center text-4xl opacity-25">
                  🏞️
                </div>
              )}
            </div>

            {kandidat && (
              <p className="text-center text-xs text-amber-700 dark:text-amber-400">
                Vorschau – noch nicht gespeichert
              </p>
            )}

            {kandidat ? (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={bildUebernehmen}
                  disabled={bildBusy}
                  className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                >
                  {bildBusy ? "Speichere …" : "Übernehmen"}
                </button>
                <button
                  type="button"
                  onClick={() => setKandidat(null)}
                  disabled={bildBusy}
                  className="w-full rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
                >
                  Verwerfen
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="bild-stil"
                    className="text-xs font-medium text-foreground/70"
                  >
                    Stil
                  </label>
                  <select
                    id="bild-stil"
                    value={bildStil}
                    onChange={(e) => setBildStil(e.target.value)}
                    disabled={bildBusy}
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
                    htmlFor="bild-zusatz"
                    className="text-xs font-medium text-foreground/70"
                  >
                    Stichwörter (optional)
                  </label>
                  <input
                    id="bild-zusatz"
                    value={bildZusatz}
                    onChange={(e) => setBildZusatz(e.target.value)}
                    disabled={bildBusy}
                    maxLength={1000}
                    placeholder="z. B. Regen, Dämmerung"
                    title="Zusätzliche Wünsche fürs Bild – Perspektive, Lichtstimmung, Wetter. Wird nicht gespeichert."
                    className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={bildErzeugen}
                    disabled={bildBusy}
                    className="w-full rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
                  >
                    {bildBusy
                      ? "Erzeuge …"
                      : thumbnail
                        ? "✨ Neu erzeugen"
                        : "✨ Bild erzeugen"}
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => dateiWahl.current?.click()}
                      disabled={bildBusy}
                      className="flex-1 rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
                    >
                      Hochladen
                    </button>
                    {thumbnail && (
                      <button
                        type="button"
                        onClick={bildLoeschen}
                        disabled={bildBusy}
                        className="flex-1 rounded-md border border-red-500/40 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
                      >
                        Löschen
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={dateiWahl}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) bildHochladen(f);
                    e.target.value = "";
                  }}
                />
              </>
            )}

            {bildFehler && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {bildFehler}
              </p>
            )}
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
        Der Handlungsentwurf steht als eigene Karte unter den Festlegungen: Er
        handelt von den Figuren und ihrer Geschichte, nicht von der Welt selbst.
        Das Feld trägt seine eigene Beschriftung („Handlungsentwurf"), deshalb
        hier keine zusätzliche Überschrift.
      */}
      <section className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
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
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 rounded-full border text-xs transition ${
                    i === aktiv
                      ? "border-foreground bg-foreground text-background"
                      : "border-black/15 hover:bg-black/[0.04] dark:border-white/15 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => varianteWaehlen(i)}
                    disabled={saving || generatingField !== null}
                    title={text.trim().slice(0, 120) || "(leerer Entwurf)"}
                    className={`py-1 pl-2.5 font-medium disabled:opacity-50 ${
                      loeschbar ? "pr-1" : "pr-2.5"
                    }`}
                  >
                    Entwurf {i + 1}
                  </button>
                  {loeschbar && (
                    <button
                      type="button"
                      onClick={() => varianteLoeschen(i)}
                      disabled={saving || generatingField !== null}
                      title={`Entwurf ${i + 1} löschen`}
                      aria-label={`Entwurf ${i + 1} löschen`}
                      className={`rounded-full py-1 pr-2 pl-0.5 leading-none opacity-70 transition hover:opacity-100 disabled:opacity-40 ${
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
          </div>
        )}
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

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-foreground/60 uppercase">
            Charaktere ({characters.length})
          </h2>
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
            + Charakter für dieses Szenario
          </Link>
        </div>
        {dirty && (
          <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">
            Ungespeicherte Änderungen werden nicht übernommen – erst speichern,
            dann den Charakter anlegen.
          </p>
        )}
        {characters.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-8 text-center text-sm text-foreground/60 dark:border-white/15">
            Diesem Szenario ist noch niemand zugeordnet. Die Zuordnung passiert
            in der{" "}
            <Link href="/gallery" className="underline">
              Charakter-Übersicht
            </Link>
            .
          </div>
        ) : (
          // Rund halb so große Kacheln wie in der Galerie: doppelt so viele
          // Spalten, engere Abstände. Weil eine kleine Kachel keinen Platz für
          // zwei Zeilen Beschreibung hat, steht hier nur der Name – die
          // Kurzbeschreibung wandert in den `title` (Tooltip beim Überfahren).
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
            {characters.map((c) => {
              const preview = primaryImage(c)?.thumbnail;
              return (
                <Link
                  key={c.id}
                  href="/gallery"
                  title={c.character.kurzbeschreibung}
                  className="flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white transition hover:shadow-md dark:border-white/10 dark:bg-white/[0.03]"
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
                  <span className="truncate p-1.5 text-xs font-medium">
                    {c.character.name}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

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
