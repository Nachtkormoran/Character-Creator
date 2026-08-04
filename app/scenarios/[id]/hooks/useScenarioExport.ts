"use client";

import { useState } from "react";
import { buildScenarioFile, deleteScenario } from "@/lib/client";
import { downloadBlob, safeFileName } from "@/lib/download";
import { scenarioFileName } from "@/lib/scenarioFile";
import { ausgerichtet } from "@/lib/scenarioDocument";
import type { ScenarioDocument } from "./useScenarioDocument";

/**
 * **Export und Löschen** des Szenarios. Baut auf dem Dokument-Kern auf: der
 * Export nimmt den **bearbeiteten** Stand (Name/Festlegungen/alle Entwürfe und
 * Arcs) aus `doc`, die Charaktere und Weltbilder ebenso. Zwei unabhängige
 * Häkchen steuern „mit Charakteren" / „mit Bildern" (beide Default an). Früher
 * ließ sich dieser Hook nicht sauber schneiden – er brauchte ~14 Einzelwerte;
 * mit `doc` liest er alles an einer Stelle.
 */
export function useScenarioExport(
  doc: ScenarioDocument,
  id: string,
  router: { push: (href: string) => void },
) {
  const [mitCharakteren, setMitCharakteren] = useState(true);
  const [mitBildern, setMitBildern] = useState(true);
  const [exportiert, setExportiert] = useState(false);
  const [exportFehler, setExportFehler] = useState<string | null>(null);

  async function exportieren() {
    setExportiert(true);
    setExportFehler(null);
    try {
      const datei = await buildScenarioFile(
        {
          name: doc.name.trim(),
          details: doc.details,
          // Der **bearbeitete** Stand: alle Entwürfe und alle Story Arcs samt
          // aktivem Index und Metadaten (Titel/Form/Ton).
          plotVariants: {
            items: doc.aktuelleVarianten(),
            aktiv: doc.aktiv,
            meta: ausgerichtet(doc.variantenMeta, doc.aktuelleVarianten().length),
          },
          storyArc: doc.storyArc,
          storyArcVariants: {
            items: doc.aktuelleArcs(),
            aktiv: doc.arcAktiv,
            meta: ausgerichtet(doc.arcMeta, doc.aktuelleArcs().length),
          },
        },
        mitCharakteren ? doc.characters : [],
        // Die Weltbilder sind unabhängig vom bearbeiteten Stand (eigene Route,
        // sofort gespeichert) – `buildScenarioFile` holt je Bild das Original.
        { scenarioId: id, images: doc.bilder },
        // Ohne Häkchen „mit Bildern" bleibt Weltbild + Charakter-Bilder weg.
        !mitBildern,
      );
      const blob = new Blob([JSON.stringify(datei, null, 2)], {
        type: "application/json",
      });
      downloadBlob(blob, scenarioFileName(safeFileName(doc.name.trim())));
    } catch (e) {
      setExportFehler(e instanceof Error ? e.message : "Export fehlgeschlagen.");
    } finally {
      setExportiert(false);
    }
  }

  async function entfernen() {
    if (
      !confirm(
        `Szenario „${doc.name}" löschen? Die ${doc.characters.length} zugeordneten Charaktere bleiben erhalten und sind danach ohne Szenario.`,
      )
    )
      return;
    try {
      await deleteScenario(id);
      router.push("/scenarios");
    } catch (e) {
      doc.setSaveError(
        e instanceof Error ? e.message : "Löschen fehlgeschlagen.",
      );
    }
  }

  return {
    mitCharakteren,
    setMitCharakteren,
    mitBildern,
    setMitBildern,
    exportiert,
    exportFehler,
    exportieren,
    entfernen,
  };
}
