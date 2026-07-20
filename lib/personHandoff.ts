"use client";

import type { PlotPerson } from "./schema";

/**
 * Übergabe einer im Handlungsentwurf gefundenen Person an das
 * Erstellen-Formular.
 *
 * Der Weg führt über `sessionStorage` und **nicht über die URL**: Hintergrund
 * und Persönlichkeit dürfen zusammen mehrere tausend Zeichen haben, und die
 * hängte man sonst an eine Adresse, die im Verlauf, in Lesezeichen und in
 * Server-Logs landet. Der Umweg ist auch inhaltlich richtig – es ist ein
 * einmaliger Vorschlag und kein Zustand, den man teilen oder erneut aufrufen
 * können soll.
 *
 * `sessionStorage` statt `localStorage`, weil die Übergabe genau einen
 * Navigationsschritt weit reichen muss. Ein Vorschlag, der eine Woche später
 * in einem neuen Fenster wieder auftaucht, wäre ein Fehler.
 */
const KEY = "charakter-creator:person-aus-handlung";

/** Legt die Person für den nächsten Seitenaufruf ab. */
export function stashPlotPerson(person: PlotPerson): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(person));
  } catch {
    // Privater Modus oder volles Kontingent: Dann entsteht der Charakter eben
    // ohne Vorbelegung. Das Anlegen daran scheitern zu lassen wäre schlimmer.
  }
}

/**
 * Liest die abgelegte Person – **ohne** sie zu löschen. Das Aufräumen macht
 * `clearPlotPerson`, und zwar erst, nachdem die Seite steht.
 *
 * Die Trennung ist kein Zierat: React ruft im Entwicklungsmodus sowohl den
 * Initialisierer von `useState` als auch Effekte doppelt auf. Läse und löschte
 * dieselbe Funktion, käme der zweite Aufruf leer zurück – und je nachdem,
 * welcher Durchgang gewinnt, stünde das Formular ohne Vorbelegung da. Ein
 * Fehler, der nur manchmal auftritt und beim Nachstellen verschwindet.
 */
export function readPlotPerson(): PlotPerson | null {
  try {
    const roh = sessionStorage.getItem(KEY);
    return roh ? (JSON.parse(roh) as PlotPerson) : null;
  } catch {
    return null;
  }
}

/** Räumt die Übergabe weg, damit sie nicht beim nächsten Besuch wieder greift. */
export function clearPlotPerson(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Siehe oben – ein fehlgeschlagenes Aufräumen ist folgenlos.
  }
}
