import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { normalizeScenarioDetails } from "@/lib/schema";
import type { StoredScenario } from "@/lib/serialize";

// --- Mocks: kein Netz, kein DOM-Fetch ---------------------------------------
const getScenario = vi.fn();
const updateScenario = vi.fn();
vi.mock("@/lib/client", () => ({
  getScenario: (...a: unknown[]) => getScenario(...a),
  updateScenario: (...a: unknown[]) => updateScenario(...a),
}));

const ladeRunParams = vi.fn();
const speichereRunParams = vi.fn();
vi.mock("@/lib/scenarioRunParams", () => ({
  ladeRunParams: (...a: unknown[]) => ladeRunParams(...a),
  speichereRunParams: (...a: unknown[]) => speichereRunParams(...a),
}));

import { useScenarioDocument } from "./useScenarioDocument";

// --- Fixtures ---------------------------------------------------------------
const leerMeta = {
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

function szenario(id: string, handlung: string): StoredScenario {
  return {
    id,
    name: `Szenario ${id}`,
    details: normalizeScenarioDetails({ handlung }),
    plotVariants: { items: [handlung], aktiv: 0, meta: [leerMeta] },
    storyArc: { stufen: [] },
    storyArcVariants: { items: [], aktiv: 0, meta: [] },
    images: [],
    createdAt: new Date().toISOString(),
  } as unknown as StoredScenario;
}

const runParamsDefault = {
  handlung: { form: "allround", ton: "neutral" },
  arc: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  ladeRunParams.mockReturnValue(runParamsDefault);
  getScenario.mockImplementation((id: string) =>
    Promise.resolve({ scenario: szenario(id, "Entwurf A"), characters: [] }),
  );
  // Server echot den Patch als „aktualisiert" zurück (wie serializeScenario).
  updateScenario.mockImplementation((id: string, patch: Record<string, unknown>) =>
    Promise.resolve({
      id,
      name: patch.name,
      details: patch.details,
      plotVariants: patch.plotVariants,
      storyArc:
        (patch.storyArcVariants as { items: unknown[]; aktiv: number }).items[
          (patch.storyArcVariants as { aktiv: number }).aktiv
        ] ?? { stufen: [] },
      storyArcVariants: patch.storyArcVariants,
      images: [],
      createdAt: "",
    }),
  );
});

describe("useScenarioDocument – Laden", () => {
  it("lädt und ist danach nicht dirty", async () => {
    const { result } = renderHook(() => useScenarioDocument("A"));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.name).toBe("Szenario A");
    expect(result.current.details.handlung).toBe("Entwurf A");
    expect(result.current.dirty).toBe(false); // frisch geladen ⇒ nicht dirty
  });
});

describe("useScenarioDocument – dirty/speichern/verwerfen", () => {
  it("tippen macht dirty", async () => {
    const { result } = renderHook(() => useScenarioDocument("A"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setName("Neuer Name"));
    expect(result.current.dirty).toBe(true);
  });

  it("save schickt den korrekten PATCH und ist danach nicht mehr dirty", async () => {
    const { result } = renderHook(() => useScenarioDocument("A"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setDetails(normalizeScenarioDetails({ handlung: "Entwurf A – geändert" })));
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      await result.current.save();
    });

    expect(updateScenario).toHaveBeenCalledTimes(1);
    const [idArg, patch] = updateScenario.mock.calls[0];
    expect(idArg).toBe("A");
    expect(patch.name).toBe("Szenario A");
    expect(patch.details.handlung).toBe("Entwurf A – geändert");
    // Die aktive Zelle ist in die Liste gefaltet (Merge-Invariante):
    expect(patch.plotVariants.items).toEqual(["Entwurf A – geändert"]);
    expect(patch.plotVariants.meta).toHaveLength(1);
    // Nach dem Speichern ist die Basislinie neu → nicht mehr dirty.
    expect(result.current.dirty).toBe(false);
  });

  it("verwerfen holt den gespeicherten Stand zurück", async () => {
    const { result } = renderHook(() => useScenarioDocument("A"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setName("verworfen?"));
    expect(result.current.dirty).toBe(true);

    act(() => result.current.verwerfen());
    expect(result.current.name).toBe("Szenario A");
    expect(result.current.dirty).toBe(false);
  });

  it("save ohne Änderung schickt keinen PATCH", async () => {
    const { result } = renderHook(() => useScenarioDocument("A"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.save();
    });
    expect(updateScenario).not.toHaveBeenCalled();
  });
});

describe("useScenarioDocument – Run-Params (skip-once, kein Durchsickern)", () => {
  it("beim Szenariowechsel A→B werden nicht A's Parameter unter B gemerkt", async () => {
    ladeRunParams.mockImplementation((id: string) => ({
      handlung: {
        form: id === "A" ? "krimi" : "liebe",
        ton: "neutral",
      },
      arc: {},
    }));

    const { result, rerender } = renderHook(
      ({ id }) => useScenarioDocument(id),
      { initialProps: { id: "A" } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(result.current.handlungForm).toBe("krimi"));

    // Eine Änderung unter A wird unter A gemerkt.
    speichereRunParams.mockClear();
    act(() => result.current.setHandlungTon("cool"));
    await waitFor(() => expect(speichereRunParams).toHaveBeenCalled());
    expect(speichereRunParams.mock.calls.every(([cid]) => cid === "A")).toBe(true);

    // Wechsel auf B: es darf **kein** speichereRunParams("B", …) mit A's Werten
    // passieren, bevor B geladen ist.
    speichereRunParams.mockClear();
    rerender({ id: "B" });
    await waitFor(() => expect(result.current.handlungForm).toBe("liebe"));

    const bCalls = speichereRunParams.mock.calls.filter(([cid]) => cid === "B");
    // Falls überhaupt für B gemerkt wurde, dann nur mit B's Werten (liebe),
    // nie mit A's (krimi).
    for (const [, payload] of bCalls) {
      expect(payload.handlung.form).toBe("liebe");
    }
  });
});
