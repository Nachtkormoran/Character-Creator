"use client";

/**
 * Fußzeile der Szenario-Detailseite: **Exportieren** (mit den beiden
 * unabhängigen Häkchen „Charaktere" / „Bilder") und **Löschen**. Rein
 * präsentierend – Zustand und Handler kommen von der Seite (später aus
 * `useScenarioExport`). Die Optik ist 1:1 aus `page.tsx` übernommen.
 */
export function ExportLeiste({
  exportieren,
  exportiert,
  anzahlCharaktere,
  mitCharakteren,
  onMitCharakterenChange,
  mitBildern,
  onMitBildernChange,
  exportFehler,
  entfernen,
}: {
  exportieren: () => void;
  exportiert: boolean;
  anzahlCharaktere: number;
  mitCharakteren: boolean;
  onMitCharakterenChange: (v: boolean) => void;
  mitBildern: boolean;
  onMitBildernChange: (v: boolean) => void;
  exportFehler: string | null;
  entfernen: () => void;
}) {
  return (
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
          anzahlCharaktere === 0
            ? "cursor-not-allowed text-muted-foreground"
            : "cursor-pointer text-muted-foreground"
        }`}
      >
        <input
          type="checkbox"
          checked={mitCharakteren && anzahlCharaktere > 0}
          onChange={(e) => onMitCharakterenChange(e.target.checked)}
          disabled={exportiert || anzahlCharaktere === 0}
          className="size-4 accent-primary"
        />
        {anzahlCharaktere === 0
          ? "Keine Charaktere zugeordnet"
          : `Charaktere mitexportieren (${anzahlCharaktere})`}
      </label>

      {/*
        Bilder mitexportieren – Default an. Ohne Häkchen bleiben Weltbild und
        Charakter-Bilder weg: eine schlanke Datei nur aus Texten/Festlegungen.
      */}
      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={mitBildern}
          onChange={(e) => onMitBildernChange(e.target.checked)}
          disabled={exportiert}
          className="size-4 accent-primary"
        />
        Bilder mitexportieren
      </label>

      {exportFehler && (
        <span className="text-sm text-destructive">{exportFehler}</span>
      )}

      <button
        onClick={entfernen}
        className="ml-auto rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10"
      >
        Szenario löschen
      </button>
    </div>
  );
}
