"use client";

import { use, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  buildScenarioFile,
  deleteScenario,
  findPlotPersons,
  generateScenarioDescription,
  generateScenarioPlot,
  getScenario,
  updateScenario,
} from "@/lib/client";
import { downloadBlob, safeFileName } from "@/lib/download";
import { scenarioFileName } from "@/lib/scenarioFile";
import {
  SCENARIO_LABELS,
  normalizeScenarioDetails,
  type PlotPerson,
  type ScenarioDetails,
} from "@/lib/schema";
import { stashPlotPerson } from "@/lib/personHandoff";
import { primaryImage, type StoredCharacter } from "@/lib/serialize";
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

  /** Hier sind beide Textfelder erzeugbar – das Szenario ist gespeichert. */
  const ERZEUGBAR: ReadonlySet<keyof ScenarioDetails> = new Set([
    "beschreibung",
    "handlung",
  ]);

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
    if (
      details[key].trim() &&
      !confirm(`${SCENARIO_LABELS[key]} wird ersetzt. Fortfahren?`)
    )
      return;
    setGeneratingField(key);
    setSaveError(null);
    try {
      if (key === "handlung") {
        const { handlung } = await generateScenarioPlot(
          id,
          name.trim(),
          details,
          zusatz.handlung ?? "",
        );
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

  useEffect(() => {
    getScenario(id)
      .then(({ scenario, characters }) => {
        setName(scenario.name);
        setDetails(scenario.details);
        setCharacters(characters);
        setSaved(
          JSON.stringify({ name: scenario.name, details: scenario.details }),
        );
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler."))
      .finally(() => setLoading(false));
  }, [id]);

  const dirty = saved !== "" && JSON.stringify({ name, details }) !== saved;
  const nameValid = name.trim().length > 0;

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
      });
      setName(aktualisiert.name);
      setDetails(aktualisiert.details);
      setSaved(
        JSON.stringify({
          name: aktualisiert.name,
          details: aktualisiert.details,
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
              };
              setName(s.name);
              setDetails(s.details);
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

      <section className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-foreground/60 uppercase">
          Festlegungen
        </h2>
        <ScenarioFields
          details={details}
          onChange={setDetails}
          disabled={saving}
          generatable={ERZEUGBAR}
          onGenerate={handleGenerate}
          generatingField={generatingField}
          zusatz={zusatz}
          onZusatzChange={(key, value) =>
            setZusatz((z) => ({ ...z, [key]: value }))
          }
        />

        {/*
          Personen aus dem Handlungsentwurf – direkt unter den Festlegungen,
          weil sie sich auf das Feld darüber beziehen.

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
                    Noch nicht im Szenario – anklicken, um daraus einen
                    Charakter anzulegen:
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {characters.map((c) => {
              const preview = primaryImage(c)?.thumbnail;
              return (
                <Link
                  key={c.id}
                  href="/gallery"
                  className="flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white transition hover:shadow-md dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="relative aspect-square w-full bg-black/[0.03] dark:bg-white/[0.03]">
                    {preview ? (
                      <Image
                        src={preview}
                        alt={c.character.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl opacity-30">
                        🧑
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 p-3">
                    <span className="truncate font-medium">
                      {c.character.name}
                    </span>
                    <span className="line-clamp-2 text-xs text-foreground/60">
                      {c.character.kurzbeschreibung}
                    </span>
                  </div>
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
    </div>
  );
}
