"use client";

import Image from "next/image";
import { Images, Mountain } from "../../../components/ui/icons";
import { ScenarioFields } from "../../../components/ScenarioFields";
import type { ScenarioDetails } from "@/lib/schema";

/**
 * Die **Welt** eines Szenarios: links die Beschreibung (Fließtext), rechts das
 * Weltbild mit Knopf in die Bild-Ansicht; darunter die Karte „Festlegungen"
 * (Genre/Ort/Zeit/Regeln). Rein präsentierend – `ScenarioFields` trägt die
 * Feldlogik, Zustand/Handler kommen von der Seite. Optik 1:1 aus `page.tsx`.
 */
export function WeltKarte({
  details,
  name,
  saving,
  generatable,
  onGenerate,
  generatingField,
  zusatz,
  onZusatzChange,
  onBeschreibungChange,
  onFestlegungenChange,
  bilder,
  weltbildVorschau,
  onBildModalOffen,
}: {
  details: ScenarioDetails;
  name: string;
  saving: boolean;
  generatable: ReadonlySet<keyof ScenarioDetails>;
  onGenerate: (key: keyof ScenarioDetails, anzahl?: number) => void;
  generatingField: keyof ScenarioDetails | null;
  zusatz: Partial<Record<keyof ScenarioDetails, string>>;
  onZusatzChange: (key: keyof ScenarioDetails, value: string) => void;
  onBeschreibungChange: (details: ScenarioDetails) => void;
  onFestlegungenChange: (details: ScenarioDetails) => void;
  bilder: readonly unknown[];
  weltbildVorschau: string | null;
  onBildModalOffen: () => void;
}) {
  return (
    <>
      {/*
        Kopfblock wie in der Charakter-Detailansicht: links der Fließtext (dort
        die Person, hier die Welt), rechts das Bild mit seiner Steuerung
        darunter. `order-*` zeigt das Bild auf schmalen Schirmen zuerst – wie
        beim Charakter.
      */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_240px]">
          {/* Links: die Beschreibung – der Fließtext über die Welt. */}
          <div className="order-2 md:order-1">
            <ScenarioFields
              details={details}
              onChange={onBeschreibungChange}
              disabled={saving}
              fields={["beschreibung"]}
              generatable={generatable}
              onGenerate={onGenerate}
              generatingField={generatingField}
              zusatz={zusatz}
              onZusatzChange={onZusatzChange}
            />
          </div>

          {/*
            Rechts nur noch das Weltbild und ein Knopf, der die Bild-Ansicht
            öffnet – die gesamte Bedienung liegt in `ScenarioImageModal`. Das
            hält die Detailansicht ruhig: neben der Weltbeschreibung steht ein
            Bild, kein Bedienfeld.
          */}
          <div className="order-1 flex flex-col gap-3 md:order-2">
            <span className="text-sm font-medium">
              {bilder.length > 1 ? `Weltbilder (${bilder.length})` : "Weltbild"}
            </span>

            <button
              type="button"
              onClick={onBildModalOffen}
              title={
                bilder.length > 0 ? "Weltbilder verwalten" : "Weltbild hinzufügen"
              }
              className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-muted transition hover:border-border"
            >
              {weltbildVorschau ? (
                <Image
                  src={weltbildVorschau}
                  alt={`Weltbild von ${name}`}
                  fill
                  sizes="240px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Mountain size={44} strokeWidth={1.25} aria-hidden="true" />
                </div>
              )}
              {bilder.length > 1 && (
                <span className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                  +{bilder.length - 1}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={onBildModalOffen}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
            >
              {bilder.length > 0 ? (
                <>
                  <Images size={16} strokeWidth={1.75} aria-hidden="true" />
                  Weltbilder verwalten
                </>
              ) : (
                <>
                  <Mountain size={16} strokeWidth={1.75} aria-hidden="true" />
                  Weltbild hinzufügen
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Festlegungen
        </h2>
        <ScenarioFields
          details={details}
          onChange={onFestlegungenChange}
          disabled={saving}
          fields={["genre", "ort", "zeit", "regeln"]}
          generatable={generatable}
          onGenerate={onGenerate}
          generatingField={generatingField}
          zusatz={zusatz}
          onZusatzChange={onZusatzChange}
        />
      </section>
    </>
  );
}
