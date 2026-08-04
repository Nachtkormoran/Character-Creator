"use client";

import Link from "next/link";
import { Sparkles } from "../../../components/ui/icons";
import type { ScenarioDetails } from "@/lib/schema";

/**
 * Kopf der Szenario-Detailseite: Breadcrumb, editierbarer **Name** mit
 * KI-Namensknopf und die **Speicher-Leiste** („Ungespeicherte Änderungen" →
 * Speichern / Verwerfen). Rein präsentierend – Zustand und Handler kommen von
 * der Seite. Optik 1:1 aus `page.tsx`.
 */
export function ScenarioHeader({
  name,
  onNameChange,
  details,
  onNameErzeugen,
  nameBusy,
  nameFehler,
  saving,
  dirty,
  nameValid,
  onSave,
  onVerwerfen,
  saveError,
}: {
  name: string;
  onNameChange: (v: string) => void;
  details: ScenarioDetails;
  onNameErzeugen: () => void;
  nameBusy: boolean;
  nameFehler: string | null;
  saving: boolean;
  dirty: boolean;
  nameValid: boolean;
  onSave: () => void;
  onVerwerfen: () => void;
  saveError: string | null;
}) {
  return (
    <>
      <div>
        <Link
          href="/scenarios"
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← Szenarien
        </Link>
        <div className="mt-1 -mx-2 flex items-center gap-1">
          <input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            aria-label="Name des Szenarios"
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 font-display text-3xl font-semibold tracking-tight outline-none transition hover:border-border focus:border-primary/50"
          />
          {/*
            KI-Name aus Beschreibung/Ort/Zeit/Regeln. Ersetzt das Feld (geht in
            den Bearbeitungs-Zustand, „Verwerfen" holt den alten Namen zurück).
            Gesperrt, solange keins der vier Felder etwas hergibt.
          */}
          <button
            type="button"
            onClick={onNameErzeugen}
            disabled={
              saving ||
              nameBusy ||
              !(
                details.beschreibung.trim() ||
                details.ort.trim() ||
                details.zeit.trim() ||
                details.regeln.trim()
              )
            }
            title="Namen aus Beschreibung, Ort, Zeit und Regeln erzeugen"
            aria-label="Namen per KI erzeugen"
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-border px-2.5 py-2 transition hover:bg-muted disabled:opacity-40"
          >
            {nameBusy ? (
              <span className="animate-pulse">…</span>
            ) : (
              <Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
        </div>
        {nameFehler && (
          <p className="mt-1 text-xs text-destructive">{nameFehler}</p>
        )}
      </div>

      {dirty && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <span className="text-sm text-amber-800 dark:text-amber-300">
            Ungespeicherte Änderungen
          </span>
          <button
            onClick={onSave}
            disabled={saving || !nameValid}
            className="ml-auto rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Speichere …" : "Änderungen speichern"}
          </button>
          <button
            onClick={onVerwerfen}
            disabled={saving}
            className="text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-50"
          >
            Verwerfen
          </button>
          {saveError && (
            <span className="w-full text-xs text-destructive">{saveError}</span>
          )}
        </div>
      )}
    </>
  );
}
