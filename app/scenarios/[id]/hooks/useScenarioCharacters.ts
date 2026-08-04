"use client";

import { useEffect, useState } from "react";
import {
  deleteCharacter,
  listScenarios,
  updateCharacterContent,
  updateCharacterGenre,
  updateCharacterProtagonist,
  updateCharacterScenario,
} from "@/lib/client";
import type { GeneratedCharacter, ScenarioDetails } from "@/lib/schema";
import type { StoredCharacter, StoredScenario } from "@/lib/serialize";
import type { ScenarioDocument } from "./useScenarioDocument";

/**
 * **Besetzung** des Szenarios: das Detail-Modal (Bearbeiten/Löschen/Bild-
 * Operationen), Zuordnung, Protagonisten-Umschalten und die Genre-Übertragung
 * auf zugeordnete Figuren. Diese Operationen persistieren **sofort** (eigene
 * PATCHes), unabhängig vom „Änderungen speichern" des Dokuments – deshalb ein
 * eigener Hook neben dem Kern, der nur `characters`/`setCharacters`/`details`/
 * `setDetails` von dort bezieht. Lädt außerdem alle Szenarien fürs
 * Zuordnungs-Menü.
 */
export function useScenarioCharacters(doc: ScenarioDocument, id: string) {
  const { characters, setCharacters, details, setDetails, setSaveError } = doc;

  const [selectedChar, setSelectedChar] = useState<StoredCharacter | null>(null);
  const [genreSync, setGenreSync] = useState<{
    genre: string;
    betroffen: StoredCharacter[];
  } | null>(null);
  const [genreSyncBusy, setGenreSyncBusy] = useState(false);
  const [genreSyncFehler, setGenreSyncFehler] = useState<string | null>(null);
  const [protagonistBusy, setProtagonistBusy] = useState<string | null>(null);
  const [allScenarios, setAllScenarios] = useState<StoredScenario[]>([]);

  // Alle Szenarien fürs Zuordnungs-Menü des Detail-Modals. Unabhängig und nicht
  // kritisch – schlägt es fehl, bleibt die Liste leer.
  useEffect(() => {
    listScenarios()
      .then(setAllScenarios)
      .catch(() => {});
  }, []);

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

  // Bild-Operationen im Modal liefern den vollständigen aktualisierten Charakter.
  function charAktualisiert(updated: StoredCharacter) {
    setCharacters((cs) => cs.map((c) => (c.id === updated.id ? updated : c)));
    setSelectedChar(updated);
  }

  /**
   * Genre-Änderung an den Festlegungen abfangen: Wird das Genre auf ein
   * **anderes, nicht-leeres** Genre gesetzt und tragen zugeordnete Figuren ein
   * abweichendes Genre, öffnet sich die Rückfrage. Der Feld-Wert selbst wird
   * immer übernommen; die Übertragung auf die Figuren ist nur auf Bestätigung.
   */
  function festlegungenAendern(next: ScenarioDetails) {
    if (
      next.genre &&
      next.genre !== details.genre &&
      characters.some((c) => c.input.genre !== next.genre)
    ) {
      const betroffen = characters.filter((c) => c.input.genre !== next.genre);
      setGenreSyncFehler(null);
      setGenreSync({ genre: next.genre, betroffen });
    }
    setDetails(next);
  }

  /** Das neue Genre auf die betroffenen Figuren übertragen (Teil-PATCH je Figur). */
  async function genreUebertragen() {
    if (!genreSync || genreSyncBusy) return;
    setGenreSyncBusy(true);
    setGenreSyncFehler(null);
    try {
      const aktualisiert = await Promise.all(
        genreSync.betroffen.map((c) =>
          updateCharacterGenre(c.id, genreSync.genre),
        ),
      );
      const beiId = new Map(aktualisiert.map((c) => [c.id, c]));
      setCharacters((cs) => cs.map((c) => beiId.get(c.id) ?? c));
      setSelectedChar((sel) => (sel ? beiId.get(sel.id) ?? sel : sel));
      setGenreSync(null);
    } catch (e) {
      setGenreSyncFehler(
        e instanceof Error ? e.message : "Übertragen fehlgeschlagen.",
      );
    } finally {
      setGenreSyncBusy(false);
    }
  }

  /**
   * Zuordnung ändern. Wird der Charakter einem **anderen** Szenario (oder keinem)
   * zugewiesen, gehört er nicht mehr hierher – dann fällt seine Kachel weg und das
   * Modal schließt. Bleibt er, wird er nur aktualisiert.
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

  /** Ein zugeordneter/kopierter Charakter – in die Kachelliste einreihen (Dedupe). */
  function charHinzugefuegt(neu: StoredCharacter) {
    setCharacters((cs) => (cs.some((c) => c.id === neu.id) ? cs : [...cs, neu]));
  }

  /**
   * Eine Figur als Protagonist markieren/entmarken. Sofort persistiert; ist das
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

  return {
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
  };
}
