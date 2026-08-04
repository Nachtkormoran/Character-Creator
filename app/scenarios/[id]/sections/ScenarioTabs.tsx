"use client";

/** Die drei Arbeitsflächen der Szenario-Seite. Der Wert steht auch in der URL (`?tab=`). */
export type ScenarioTab = "welt" | "handlung" | "arc";

export const SCENARIO_TABS: { id: ScenarioTab; label: string }[] = [
  { id: "welt", label: "Welt" },
  { id: "handlung", label: "Besetzung & Handlung" },
  { id: "arc", label: "Story Arc" },
];

export const DEFAULT_SCENARIO_TAB: ScenarioTab = "handlung";

/** Prüft einen (URL-)String auf einen gültigen Tab; sonst der Default. */
export function alsScenarioTab(wert: string | null): ScenarioTab {
  return SCENARIO_TABS.some((t) => t.id === wert)
    ? (wert as ScenarioTab)
    : DEFAULT_SCENARIO_TAB;
}

/**
 * Tab-Leiste der Szenario-Detailseite. Die eigentliche Umschaltung läuft über
 * die URL (`?tab=`) im Orchestrator – hier nur die Darstellung. Kleine Zähler an
 * „Besetzung & Handlung" (Entwürfe) und „Story Arc" (Arcs) geben einen schnellen
 * Überblick, ohne die Tabs zu öffnen.
 */
export function ScenarioTabs({
  tab,
  onTab,
  handlungCount,
  arcCount,
}: {
  tab: ScenarioTab;
  onTab: (t: ScenarioTab) => void;
  handlungCount: number;
  arcCount: number;
}) {
  const counts: Partial<Record<ScenarioTab, number>> = {
    handlung: handlungCount,
    arc: arcCount,
  };
  return (
    <div
      role="tablist"
      aria-label="Bereiche des Szenarios"
      className="flex flex-wrap gap-1 border-b border-border"
    >
      {SCENARIO_TABS.map((t) => {
        const aktiv = t.id === tab;
        const count = counts[t.id];
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={aktiv}
            onClick={() => onTab(t.id)}
            className={`relative flex items-center gap-2 px-3.5 py-2.5 text-sm transition ${
              aktiv
                ? "font-semibold text-foreground after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
                : "font-medium text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {count !== undefined && count > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[0.7rem] tabular-nums text-muted-foreground">
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
