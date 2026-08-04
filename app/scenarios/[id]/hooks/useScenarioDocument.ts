"use client";

import { useEffect, useRef, useState } from "react";
import { getScenario, updateScenario } from "@/lib/client";
import { ladeRunParams, speichereRunParams } from "@/lib/scenarioRunParams";
import {
  ausgerichtet,
  currentSnapshot,
  isDirty,
  mergeArcs,
  mergeVarianten,
  savedSnapshot,
} from "@/lib/scenarioDocument";
import {
  DEFAULT_ARC_FORMAT,
  DEFAULT_ARC_LENGTH,
  DEFAULT_KAPITEL_COUNT,
  DEFAULT_KAPITEL_LAENGE,
  DEFAULT_STORY_FORM,
  DEFAULT_STORY_TONE,
  DEFAULT_WERKFORM,
  normalizeScenarioDetails,
  type ArcFormat,
  type ArcLength,
  type KapitelCount,
  type KapitelLaenge,
  type PlotVariants,
  type ScenarioDetails,
  type StoryArc,
  type StoryArcVariants,
  type StoryForm,
  type StoryTone,
  type VariantMeta,
  type Werkform,
} from "@/lib/schema";
import type { StoredCharacter, StoredImage } from "@/lib/serialize";

/**
 * **Lauf-Parameter des Story Arcs** (nicht gespeichert – s. `scenarioRunParams`).
 * Liegt hier, weil der Merk-Effekt (localStorage) im Dokument-Kern sitzt.
 */
export interface ArcParams {
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
  /**
   * Beim **Kapitel-Ableiten** die volle Besetzung (Charaktere + Figuren) mit in
   * den Prompt geben – wie beim Story Arc. Default aus (die Ableitung arbeitet
   * dann wie bisher allein aus der Station). Lauf-Parameter, nicht gespeichert.
   */
  kapitelMitBesetzung: boolean;
}

const ARC_PARAMS_DEFAULT: ArcParams = {
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
  kapitelMitBesetzung: false,
};

/**
 * **Der Dokument-Kern der Szenario-Detailseite.** Besitzt die **eine** geteilte
 * Speicher-Einheit – Name, Festlegungen, **alle** Handlungsentwürfe **und alle**
 * Story Arcs –, lädt das Szenario (samt Charakteren und Weltbildern), berechnet
 * `dirty` und stellt `speichern`/`save`/`verwerfen` bereit. Die
 * Merge-Invarianten (`details.handlung === varianten[aktiv]`,
 * `storyArc === arcVarianten[arcAktiv]`) laufen über `@/lib/scenarioDocument`
 * (pur, getestet); dieser Hook verdrahtet sie nur in den React-Lebenszyklus.
 *
 * Zusätzlich hält er die **zuletzt gewählten Lauf-Parameter** (Handlungsentwurf
 * Form/Ton, Story-Arc `arcParams`) und ihre localStorage-Persistenz. Die beiden
 * Effekte (Laden, Merken) stehen bewusst in **dieser Reihenfolge** in *einem*
 * Hook – so setzt der Load-Effekt `runParamsGeladen` zurück, **bevor** der
 * Merk-Effekt läuft, und die geladenen Werte werden nicht mit Defaults
 * überschrieben (die „skip-once"-Regel, 1:1 aus der früheren Seite).
 */
export function useScenarioDocument(id: string) {
  const [name, setName] = useState("");
  const [details, setDetails] = useState<ScenarioDetails>(
    normalizeScenarioDetails({}),
  );
  const [varianten, setVarianten] = useState<string[]>([]);
  const [aktiv, setAktiv] = useState(0);
  const [variantenMeta, setVariantenMeta] = useState<VariantMeta[]>([]);
  const [storyArc, setStoryArc] = useState<StoryArc>({ stufen: [] });
  const [arcVarianten, setArcVarianten] = useState<StoryArc[]>([]);
  const [arcAktiv, setArcAktiv] = useState(0);
  const [arcMeta, setArcMeta] = useState<VariantMeta[]>([]);
  const [characters, setCharacters] = useState<StoredCharacter[]>([]);
  const [bilder, setBilder] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Lauf-Parameter (nicht Teil der Speicher-Einheit; localStorage-gemerkt).
  const [handlungForm, setHandlungForm] = useState<StoryForm>(DEFAULT_STORY_FORM);
  const [handlungTon, setHandlungTon] = useState<StoryTone>(DEFAULT_STORY_TONE);
  const [arcParams, setArcParams] = useState<ArcParams>(ARC_PARAMS_DEFAULT);

  // „skip-once"-Gate: der Merk-Effekt bleibt still, bis der Load-`.then` die
  // gespeicherten Lauf-Parameter angewandt hat (sonst überschriebe er sie mit
  // den Defaults).
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
          savedSnapshot({
            name: scenario.name,
            details: scenario.details,
            plotVariants: scenario.plotVariants,
            storyArcVariants: scenario.storyArcVariants,
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

  function aktuelleVarianten(): string[] {
    return mergeVarianten(varianten, aktiv, details.handlung);
  }

  function aktuelleArcs(): StoryArc[] {
    return mergeArcs(arcVarianten, arcAktiv, storyArc);
  }

  const dirty = isDirty(
    saved,
    currentSnapshot({
      name,
      details,
      varianten,
      aktiv,
      variantenMeta,
      storyArc,
      arcVarianten,
      arcAktiv,
      arcMeta,
    }),
  );
  const nameValid = name.trim().length > 0;

  async function speichern(
    overrideDetails?: ScenarioDetails,
  ): Promise<boolean> {
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
        savedSnapshot({
          name: aktualisiert.name,
          details: aktualisiert.details,
          plotVariants: aktualisiert.plotVariants,
          storyArcVariants: aktualisiert.storyArcVariants,
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
   * „Verwerfen" – holt den zuletzt gespeicherten Stand aus `saved` zurück
   * (Name, Festlegungen, alle Entwürfe und Story Arcs samt aktivem Index). Der
   * aktive Arc wird zusätzlich in `storyArc` gespiegelt (die Merge-Invariante).
   */
  function verwerfen() {
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
  }

  return {
    // Speicher-Einheit
    name,
    setName,
    details,
    setDetails,
    varianten,
    setVarianten,
    aktiv,
    setAktiv,
    variantenMeta,
    setVariantenMeta,
    storyArc,
    setStoryArc,
    arcVarianten,
    setArcVarianten,
    arcAktiv,
    setArcAktiv,
    arcMeta,
    setArcMeta,
    // Nebenbestände aus dem Load
    characters,
    setCharacters,
    bilder,
    setBilder,
    // Lebenszyklus
    loading,
    error,
    saving,
    saveError,
    setSaveError,
    // Lauf-Parameter (localStorage-gemerkt)
    handlungForm,
    setHandlungForm,
    handlungTon,
    setHandlungTon,
    arcParams,
    setArcParams,
    // Abgeleitet + Aktionen
    aktuelleVarianten,
    aktuelleArcs,
    dirty,
    nameValid,
    speichern,
    save,
    verwerfen,
  };
}

/** Rückgabetyp des Dokument-Kerns – die Basis, auf der die Feature-Hooks bauen. */
export type ScenarioDocument = ReturnType<typeof useScenarioDocument>;
