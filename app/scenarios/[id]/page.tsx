"use client";

import { use, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getSettings } from "@/lib/client";
import { GENRE_TEMPLATES } from "@/lib/templates";
import { type TextProvider, type ScenarioDetails } from "@/lib/schema";
import { ausgerichtet } from "@/lib/scenarioDocument";
import { primaryImage } from "@/lib/serialize";
import { AddCharacterToScenarioModal } from "../../components/AddCharacterToScenarioModal";
import { CharacterDetailModal } from "../../components/CharacterDetailModal";
import { GenreSyncModal } from "../../components/GenreSyncModal";
import { PlotPersonModal } from "../../components/PlotPersonModal";
import { ScenarioImageModal } from "../../components/ScenarioImageModal";
import { StoryArcSection } from "../../components/StoryArcSection";
import { ExportLeiste } from "./sections/ExportLeiste";
import { ScenarioHeader } from "./sections/ScenarioHeader";
import { WeltKarte } from "./sections/WeltKarte";
import { CharaktereKarte } from "./sections/CharaktereKarte";
import { HandlungsentwurfKarte } from "./sections/HandlungsentwurfKarte";
import { BesetzungsLeiste } from "./sections/BesetzungsLeiste";
import {
  ScenarioTabs,
  alsScenarioTab,
  type ScenarioTab,
} from "./sections/ScenarioTabs";
import { useScenarioDocument } from "./hooks/useScenarioDocument";
import { usePlotVarianten } from "./hooks/usePlotVarianten";
import { useScenarioExport } from "./hooks/useScenarioExport";
import { useStoryArc } from "./hooks/useStoryArc";
import { useKapitel } from "./hooks/useKapitel";
import { useScenarioFeldGen } from "./hooks/useScenarioFeldGen";
import { useScenarioCharacters } from "./hooks/useScenarioCharacters";
import { usePlotPersonen } from "./hooks/usePlotPersonen";

// `LEER_META` und `ausgerichtet` liegen jetzt in `@/lib/scenarioDocument` (pur,
// getestet) – zusammen mit den Merge-Invarianten und den Snapshot-Buildern.

export default function ScenarioDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  // `useSearchParams` (für den Tab in der URL) verlangt eine Suspense-Grenze –
  // dieselbe Hülle wie bei `app/page.tsx`.
  return (
    <Suspense
      fallback={<p className="text-muted-foreground">Lade Szenario …</p>}
    >
      <ScenarioDetail {...props} />
    </Suspense>
  );
}

function ScenarioDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Aktiver Tab aus der URL (`?tab=`) – so überleben Reload/Zurück/Teilen den Tab.
  const tab = alsScenarioTab(searchParams.get("tab"));
  function setTab(t: ScenarioTab) {
    const q = new URLSearchParams(searchParams.toString());
    q.set("tab", t);
    // `push`, damit der Browser-Zurück-Knopf zwischen den Tabs wechselt.
    router.push(`${pathname}?${q.toString()}`, { scroll: false });
  }

  // Der Dokument-Kern: geteilte Speicher-Einheit (Name/Festlegungen/Entwürfe/
  // Arcs), Laden, `dirty`/`speichern`/`verwerfen`, Lauf-Parameter. Alles Weitere
  // baut darauf auf (s. `hooks/useScenarioDocument`).
  const doc = useScenarioDocument(id);
  const {
    name,
    setName,
    details,
    setDetails,
    aktiv,
    variantenMeta,
    storyArc,
    setStoryArc,
    arcAktiv,
    arcMeta,
    characters,
    bilder,
    setBilder,
    loading,
    error,
    saving,
    saveError,
    handlungForm,
    setHandlungForm,
    handlungTon,
    setHandlungTon,
    arcParams,
    setArcParams,
    aktuelleVarianten,
    aktuelleArcs,
    dirty,
    nameValid,
    save,
    verwerfen,
  } = doc;

  // Feld-Erzeugung (✨-Knöpfe, Fortsetzen, KI-Name) samt ihrer Lauf-Parameter und
  // Arc-/Kapitel-Busy-Zustände liegen in eigenen Hooks (s. weiter unten).
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
  // Besetzung (Detail-Modal, Zuordnung, Protagonist, Genre-Sync, Szenarienliste)
  // liegt im Hook `useScenarioCharacters` (weiter unten).

  // Export/Löschen (Optionen + Handler) liegen im Hook `useScenarioExport` auf
  // dem Dokument-Kern.
  const {
    mitCharakteren,
    setMitCharakteren,
    mitBildern,
    setMitBildern,
    exportiert,
    exportFehler,
    exportieren,
    entfernen,
  } = useScenarioExport(doc, id, router);
  // Feld-Erzeugung + Handlungsentwurf-Lauf-Parameter (nicht gespeichert) im Hook
  // `useScenarioFeldGen`. `generatingField` sperrt u. a. die Varianten-Knöpfe.
  const {
    generatingField,
    zusatz,
    setZusatz,
    handlungAlsBasis,
    setHandlungAlsBasis,
    handlungWeiterspinnen,
    setHandlungWeiterspinnen,
    handlungNeuePersonen,
    setHandlungNeuePersonen,
    handlungNeuePersonenWunsch,
    setHandlungNeuePersonenWunsch,
    nameBusy,
    nameFehler,
    handleGenerate,
    handlungFortsetzen,
    nameErzeugen,
  } = useScenarioFeldGen(doc, id, handlungProvider);

  /**
   * Ob eine Figur in Handlungsentwurf/Story Arc einfließt, entscheidet ihr
   * **eigenes Häkchen** an der Karte (`FigurenListe`) – gespeichert im String
   * `details.figuren` (inaktive mit `⊘ `-Präfix, s. `lib/figuren.ts`).
   * `aktiveFiguren(details.figuren)` liefert daraus den reinen Text der aktiven
   * Figuren, den die Erzeugung bekommt; sind keine aktiv, ist er `""` und der
   * Prompt zeichengenau der ohne Figuren-Notizen. Eine Seiten-Variable braucht
   * es dafür nicht mehr.
   */

  // Personensuche im Entwurf + Figur→Charakter-Extraktion liegen im Hook
  // `usePlotPersonen` (inkl. dem speichern-vor-Navigation-Trick).
  const {
    suchend,
    personen,
    suchFehler,
    gewaehlt,
    setGewaehlt,
    figurBusy,
    figurFehler,
    figurKandidat,
    setFigurKandidat,
    personenSuchen,
    personAnlegen,
    figurCharakterExtrahieren,
    figurCharakterAnlegen,
  } = usePlotPersonen(doc, id, router);

  // -------------------------------------------------------------------------
  // Weltbild des Szenarios
  // -------------------------------------------------------------------------

  // Die Weltbilder (`bilder`) liegen jetzt im Dokument-Kern (`useScenarioDocument`),
  // weil sie mit dem Szenario geladen werden; hier nur das Modal-Flag.
  const [bildModalOffen, setBildModalOffen] = useState(false);

  /** Ob das „Charakter hinzufügen"-Modal (bestehende Figur zuordnen) offen ist. */
  const [addOffen, setAddOffen] = useState(false);

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

  // Verwaltung der Handlungsentwurf-Varianten (Reiter) liegt in einem eigenen
  // Hook auf dem Dokument-Kern (s. `hooks/usePlotVarianten`).
  const {
    varianteWaehlen,
    titelAendern,
    favoritUmschalten,
    varianteKopieren,
    varianteLoeschen,
    alleVariantenLoeschen,
    leerenEntwurfHinzufuegen,
  } = usePlotVarianten(doc, generatingField);

  // Story-Arc-Varianten (Reiter + Ableiten) und die Kapitel-Erzeugung liegen in
  // eigenen Hooks auf dem Dokument-Kern. `arcProvider` (Pro-Lauf-Modell) deckt
  // Arc, Kapitelableitung und Kapitel-Prosa gemeinsam ab.
  const {
    arcBusy,
    arcFehler,
    arcTitelBusy,
    arcWaehlen,
    arcTitelAendern,
    arcTitelNeu,
    arcFavoritUmschalten,
    arcCoverSetzen,
    arcAlsBuchSetzen,
    arcKopieren,
    arcLoeschen,
    alleArcsLoeschen,
    storyArcAbleiten,
  } = useStoryArc(doc, id, arcProvider);
  const {
    kapitelBusy,
    kapitelFehler,
    kapitelTextBusy,
    kapitelTextFehler,
    kapitelModell,
    storyTextModell,
    kapitelAbleiten,
    kapitelTextGenerieren,
  } = useKapitel(doc, id, arcProvider);
  const {
    selectedChar,
    setSelectedChar,
    genreSync,
    setGenreSync,
    genreSyncBusy,
    genreSyncFehler,
    protagonistBusy,
    allScenarios,
    setAllScenarios,
    charLoeschen,
    charInhaltSpeichern,
    charAktualisiert,
    festlegungenAendern,
    genreUebertragen,
    charZuordnen,
    charHinzugefuegt,
    protagonistUmschalten,
  } = useScenarioCharacters(doc, id);

  /** Charaktere in der Form, die der Cover-Picker braucht (Name, Porträt, Protagonist). */
  const coverCharaktere = characters.map((c) => ({
    id: c.id,
    name: c.character.name,
    thumbnail: primaryImage(c)?.thumbnail ?? null,
    isProtagonist: c.isProtagonist,
  }));

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

  // Laden, Speichern/Verwerfen und das localStorage-Gedächtnis der Lauf-Parameter
  // liegen jetzt im Dokument-Kern (`useScenarioDocument`, oben).

  // Das anzuzeigende Weltbild – das Primärbild (wie beim Charakter abgeleitet).
  const weltbildVorschau = primaryImage({ images: bilder })?.thumbnail ?? null;
  // Für die Reiter-Leiste: die Entwürfe im aktuellen (womöglich ungespeicherten)
  // Stand. Die Leiste erscheint erst ab zwei – bei einem gibt es nichts zu
  // wählen, und der Handlungsentwurf steht ohnehin im Feld darunter.
  const variantenAnzeige = aktuelleVarianten();

  // `speichern`/`save`/`verwerfen` sowie Export/Löschen liegen jetzt in Hooks
  // auf dem Dokument-Kern (`useScenarioDocument`/`useScenarioExport`).

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
      <ScenarioHeader
        name={name}
        onNameChange={setName}
        details={details}
        onNameErzeugen={nameErzeugen}
        nameBusy={nameBusy}
        nameFehler={nameFehler}
        saving={saving}
        dirty={dirty}
        nameValid={nameValid}
        onSave={save}
        onVerwerfen={verwerfen}
        saveError={saveError}
      />

      <ScenarioTabs
        tab={tab}
        onTab={setTab}
        handlungCount={aktuelleVarianten().length}
        arcCount={aktuelleArcs().length}
      />

      {tab === "welt" && (
      <WeltKarte
        details={details}
        name={name}
        saving={saving}
        generatable={ERZEUGBAR}
        onGenerate={handleGenerate}
        generatingField={generatingField}
        zusatz={zusatz}
        onZusatzChange={(key, value) =>
          setZusatz((z) => ({ ...z, [key]: value }))
        }
        onBeschreibungChange={setDetails}
        onFestlegungenChange={festlegungenAendern}
        bilder={bilder}
        weltbildVorschau={weltbildVorschau}
        onBildModalOffen={() => setBildModalOffen(true)}
      />
      )}

      {tab === "handlung" && (
        <>
      {/*
        Die **Besetzung** in einer Karte: oben die schon angelegten
        **Charaktere** samt den Knöpfen zum Zuordnen und Erstellen, darunter die
        **Figuren**-Notizen zu wichtigen Personen, aus denen erst Charaktere
        werden sollen (ein Saatbeet). Beides gehört zusammen – aus den Charakteren
        und den aktiven Figuren entstehen Handlungsentwurf und Story Arc. Früher
        standen die Charaktere ganz unten; hier stehen sie bei den Figuren, aus
        denen sie hervorgehen.
      */}
      <CharaktereKarte
        id={id}
        characters={characters}
        dirty={dirty}
        onAddOffen={() => setAddOffen(true)}
        onSelectChar={setSelectedChar}
        onProtagonistUmschalten={protagonistUmschalten}
        protagonistBusy={protagonistBusy}
        details={details}
        saving={saving}
        generatable={ERZEUGBAR}
        onGenerate={handleGenerate}
        generatingField={generatingField}
        zusatz={zusatz}
        onZusatzChange={(key, value) =>
          setZusatz((z) => ({ ...z, [key]: value }))
        }
        onFigurenChange={setDetails}
        onFigurCharakter={figurCharakterExtrahieren}
        figurBusy={figurBusy}
        figurFehler={figurFehler}
      />

      {/*
        Eine Karte, zwei Teile in dieser Reihenfolge: **oben die
        Handlungselemente** (die persistenten Vorgaben – eine Kartenliste wie die
        Figuren), **darunter der Handlungsentwurf** selbst, der aus ihnen (und den
        Charakteren) entsteht. Beide tragen eine eigene `<h2>`; die Feld-Labels
        darunter sind per `hideLabel` ausgeblendet (für Screenreader bleiben sie
        erhalten), sonst stünde die Überschrift doppelt da.
      */}
      <HandlungsentwurfKarte
        details={details}
        onDetailsChange={setDetails}
        saving={saving}
        generatingField={generatingField}
        generatable={ERZEUGBAR}
        onGenerate={handleGenerate}
        zusatz={zusatz}
        onZusatzChange={(key, value) =>
          setZusatz((z) => ({ ...z, [key]: value }))
        }
        variantenAnzeige={variantenAnzeige}
        variantenMeta={variantenMeta}
        aktiv={aktiv}
        showModel={showModel}
        onVarianteWaehlen={varianteWaehlen}
        onFavoritUmschalten={favoritUmschalten}
        onTitelAendern={titelAendern}
        onVarianteLoeschen={varianteLoeschen}
        onVarianteKopieren={varianteKopieren}
        onLeerenEntwurf={leerenEntwurfHinzufuegen}
        onAlleVariantenLoeschen={alleVariantenLoeschen}
        handlungForm={handlungForm}
        onHandlungFormChange={setHandlungForm}
        handlungTon={handlungTon}
        onHandlungTonChange={setHandlungTon}
        handlungProvider={handlungProvider}
        onHandlungProviderChange={setHandlungProvider}
        handlungWeiterspinnen={handlungWeiterspinnen}
        onHandlungWeiterspinnenChange={setHandlungWeiterspinnen}
        handlungAlsBasis={handlungAlsBasis}
        onHandlungAlsBasisChange={setHandlungAlsBasis}
        handlungNeuePersonen={handlungNeuePersonen}
        onHandlungNeuePersonenChange={setHandlungNeuePersonen}
        handlungNeuePersonenWunsch={handlungNeuePersonenWunsch}
        onHandlungNeuePersonenWunschChange={setHandlungNeuePersonenWunsch}
        onHandlungFortsetzen={handlungFortsetzen}
        personenSuchen={personenSuchen}
        suchend={suchend}
        personen={personen}
        suchFehler={suchFehler}
        onPersonWaehlen={setGewaehlt}
      />
        </>
      )}

      {tab === "arc" && (
        <>
      {/*
        Besetzungs-Leiste: im Story-Arc-Tab fehlt die volle Besetzung sonst –
        hier die Figuren als Kurzreferenz zum Anschauen und Anspringen.
      */}
      <BesetzungsLeiste
        characters={characters}
        onSelect={setSelectedChar}
        onGoToBesetzung={() => setTab("handlung")}
      />

      {/*
        Der Story Arc: die dramaturgische Zerlegung der **aktiven** Variante.
        Lebt im Bearbeitungs-Zustand und geht über „Änderungen speichern".
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
        </>
      )}

      <ExportLeiste
        exportieren={exportieren}
        exportiert={exportiert}
        anzahlCharaktere={characters.length}
        mitCharakteren={mitCharakteren}
        onMitCharakterenChange={setMitCharakteren}
        mitBildern={mitBildern}
        onMitBildernChange={setMitBildern}
        exportFehler={exportFehler}
        entfernen={entfernen}
      />

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
