import { describe, it, expect } from "vitest";
import { normalizeScenarioDetails } from "@/lib/schema";
import type {
  PlotVariants,
  ScenarioDetails,
  StoryArc,
  StoryArcVariants,
  VariantMeta,
} from "@/lib/schema";
import {
  ausgerichtet,
  currentSnapshot,
  isDirty,
  LEER_META,
  mergeArcs,
  mergeVarianten,
  savedSnapshot,
  type DocumentState,
} from "@/lib/scenarioDocument";

// Minimale Arc-Fixtures – die Snapshot-/Merge-Logik interessiert nur `stufen.length`.
const arc = (titel: string): StoryArc =>
  ({ stufen: [{ titel } as unknown] } as unknown as StoryArc);
const leererArc: StoryArc = { stufen: [] } as StoryArc;

const meta = (titel: string): VariantMeta => ({ ...LEER_META, titel });

const details = (handlung: string): ScenarioDetails =>
  normalizeScenarioDetails({ handlung });

describe("ausgerichtet", () => {
  it("füllt fehlende Einträge mit LEER_META auf", () => {
    expect(ausgerichtet([], 2)).toEqual([LEER_META, LEER_META]);
  });
  it("schneidet überzählige ab", () => {
    expect(ausgerichtet([meta("a"), meta("b"), meta("c")], 1)).toEqual([
      meta("a"),
    ]);
  });
  it("lässt passende Länge unverändert", () => {
    const m = [meta("a"), meta("b")];
    expect(ausgerichtet(m, 2)).toEqual(m);
  });
});

describe("mergeVarianten", () => {
  it("leere Liste + Text → ein Entwurf", () => {
    expect(mergeVarianten([], 0, "Hallo")).toEqual(["Hallo"]);
  });
  it("leere Liste + leerer Text → nichts", () => {
    expect(mergeVarianten([], 0, "   ")).toEqual([]);
  });
  it("faltet die aktive Zelle auf den Live-Text", () => {
    expect(mergeVarianten(["a", "b", "c"], 1, "B*")).toEqual(["a", "B*", "c"]);
  });
});

describe("mergeArcs", () => {
  it("leere Liste + Arc mit Stufen → ein Arc", () => {
    expect(mergeArcs([], 0, arc("x"))).toEqual([arc("x")]);
  });
  it("leere Liste + leerer Arc → nichts", () => {
    expect(mergeArcs([], 0, leererArc)).toEqual([]);
  });
  it("faltet die aktive Zelle auf den Live-Arc", () => {
    const live = arc("neu");
    expect(mergeArcs([arc("a"), arc("b")], 0, live)).toEqual([live, arc("b")]);
  });
});

describe("currentSnapshot – byte-genau zur alten Inline-Form", () => {
  // Referenz-Orakel: exakt der Ausdruck, der bisher inline in der Seite stand.
  const orakel = (s: DocumentState): string => {
    const items =
      s.varianten.length === 0
        ? s.details.handlung.trim()
          ? [s.details.handlung]
          : []
        : s.varianten.map((v, i) => (i === s.aktiv ? s.details.handlung : v));
    const arcs =
      s.arcVarianten.length === 0
        ? s.storyArc.stufen.length > 0
          ? [s.storyArc]
          : []
        : s.arcVarianten.map((v, i) => (i === s.arcAktiv ? s.storyArc : v));
    return JSON.stringify({
      name: s.name,
      details: s.details,
      plot: {
        items,
        aktiv: s.aktiv,
        meta: Array.from({ length: items.length }, (_, i) =>
          s.variantenMeta[i] ?? LEER_META,
        ),
      },
      arc: {
        items: arcs,
        aktiv: s.arcAktiv,
        meta: Array.from({ length: arcs.length }, (_, i) =>
          s.arcMeta[i] ?? LEER_META,
        ),
      },
    });
  };

  const faelle: DocumentState[] = [
    {
      name: "Leer",
      details: details(""),
      varianten: [],
      aktiv: 0,
      variantenMeta: [],
      storyArc: leererArc,
      arcVarianten: [],
      arcAktiv: 0,
      arcMeta: [],
    },
    {
      name: "Ein Entwurf, ein Arc",
      details: details("Entwurf A"),
      varianten: ["Entwurf A"],
      aktiv: 0,
      variantenMeta: [meta("A")],
      storyArc: arc("s1"),
      arcVarianten: [arc("s1")],
      arcAktiv: 0,
      arcMeta: [meta("Arc1")],
    },
    {
      name: "Live-Edit der aktiven Zelle",
      details: details("Entwurf B*"),
      varianten: ["Entwurf A", "Entwurf B", "Entwurf C"],
      aktiv: 1,
      variantenMeta: [meta("A"), meta("B"), meta("C")],
      storyArc: arc("live"),
      arcVarianten: [arc("a"), arc("b")],
      arcAktiv: 0,
      arcMeta: [meta("Arc1"), meta("Arc2")],
    },
    {
      name: "meta kürzer als items",
      details: details("x"),
      varianten: ["x", "y"],
      aktiv: 0,
      variantenMeta: [],
      storyArc: leererArc,
      arcVarianten: [],
      arcAktiv: 0,
      arcMeta: [],
    },
  ];

  for (const fall of faelle) {
    it(fall.name, () => {
      expect(currentSnapshot(fall)).toBe(orakel(fall));
    });
  }
});

describe("Lade-Invariante: frisch geladen ⇒ nicht dirty", () => {
  // So kommt das Szenario vom Server (serializeScenario garantiert:
  // details.handlung === plotVariants.items[aktiv], meta index-gleich).
  const plotVariants: PlotVariants = {
    items: ["Entwurf A", "Entwurf B"],
    aktiv: 1,
    meta: [meta("A"), meta("B")],
  };
  const storyArcVariants: StoryArcVariants = {
    items: [arc("s1")],
    aktiv: 0,
    meta: [meta("Arc1")],
  };
  const serverDetails = details("Entwurf B"); // === items[aktiv]
  const name = "Weltszenario";

  const hydrated: DocumentState = {
    name,
    details: serverDetails,
    varianten: plotVariants.items,
    aktiv: plotVariants.aktiv,
    variantenMeta: plotVariants.meta,
    storyArc: storyArcVariants.items[storyArcVariants.aktiv],
    arcVarianten: storyArcVariants.items,
    arcAktiv: storyArcVariants.aktiv,
    arcMeta: storyArcVariants.meta,
  };

  it("savedSnapshot(server) === currentSnapshot(hydrated) → isDirty false", () => {
    const saved = savedSnapshot({
      name,
      details: serverDetails,
      plotVariants,
      storyArcVariants,
    });
    const current = currentSnapshot(hydrated);
    expect(current).toBe(saved);
    expect(isDirty(saved, current)).toBe(false);
  });

  it("nach Bearbeiten der aktiven Handlung ⇒ dirty", () => {
    const saved = savedSnapshot({
      name,
      details: serverDetails,
      plotVariants,
      storyArcVariants,
    });
    const bearbeitet = currentSnapshot({
      ...hydrated,
      details: details("Entwurf B — geändert"),
    });
    expect(isDirty(saved, bearbeitet)).toBe(true);
  });

  it("ohne Basislinie ist nichts dirty", () => {
    expect(isDirty("", currentSnapshot(hydrated))).toBe(false);
  });
});
