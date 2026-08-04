"use client";

import Link from "next/link";
import Image from "next/image";
import { Star, User } from "../../../components/ui/icons";
import { ScenarioFields } from "../../../components/ScenarioFields";
import { primaryImage, type StoredCharacter } from "@/lib/serialize";
import type { ScenarioDetails } from "@/lib/schema";

/**
 * Die **Besetzung** eines Szenarios in einer Karte: oben die zugeordneten
 * Charaktere (Kacheln mit Protagonisten-Stern, Zuordnen/Erstellen), darunter die
 * **Figuren**-Notizen (Saatbeet, aus dem Charaktere werden). Rein
 * präsentierend; `ScenarioFields` trägt die Figuren-Feldlogik. Optik 1:1 aus
 * `page.tsx`.
 */
export function CharaktereKarte({
  id,
  characters,
  dirty,
  onAddOffen,
  onSelectChar,
  onProtagonistUmschalten,
  protagonistBusy,
  details,
  saving,
  generatable,
  onGenerate,
  generatingField,
  zusatz,
  onZusatzChange,
  onFigurenChange,
  onFigurCharakter,
  figurBusy,
  figurFehler,
}: {
  id: string;
  characters: StoredCharacter[];
  dirty: boolean;
  onAddOffen: () => void;
  onSelectChar: (c: StoredCharacter) => void;
  onProtagonistUmschalten: (c: StoredCharacter) => void;
  protagonistBusy: string | null;
  details: ScenarioDetails;
  saving: boolean;
  generatable: ReadonlySet<keyof ScenarioDetails>;
  onGenerate: (key: keyof ScenarioDetails, anzahl?: number) => void;
  generatingField: keyof ScenarioDetails | null;
  zusatz: Partial<Record<keyof ScenarioDetails, string>>;
  onZusatzChange: (key: keyof ScenarioDetails, value: string) => void;
  onFigurenChange: (details: ScenarioDetails) => void;
  onFigurCharakter: (figurText: string) => void;
  figurBusy: string | null;
  figurFehler: { figur: string; text: string } | null;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Charaktere ({characters.length})
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {/*
            Bestehenden Charakter zuordnen: zeigt nur Figuren, die noch nicht
            hier sind. Gehört eine schon zu einem anderen Szenario, wird auf
            Wunsch eine Kopie angelegt. Ein Knopf und kein Link – es öffnet ein
            Modal, keine Navigation.
          */}
          <button
            type="button"
            onClick={onAddOffen}
            title="Einen bereits vorhandenen Charakter diesem Szenario zuordnen"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
          >
            + Vorhandenen hinzufügen
          </button>
          {/*
            Führt aufs Erstellen-Formular, mit dem Szenario im Parameter: es
            belegt Genre, Setting und Weltkontext vor und ist als Zuordnung
            ausgewählt. Bewusst ein Link und kein Knopf – es ist eine
            Navigation, und man soll ihn in einem neuen Tab öffnen können.
          */}
          <Link
            href={`/?scenario=${id}`}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:opacity-90"
          >
            + Neuen erstellen
          </Link>
        </div>
      </div>
      {characters.length > 0 && (
        <p className="mb-3 text-xs text-muted-foreground">
          Mit dem Stern markierst du <strong>Protagonisten</strong> – der
          Handlungsentwurf dreht sich dann um sie, die übrigen sind
          Nebenfiguren. Ohne Markierung bleibt alles wie bisher.
        </p>
      )}
      {dirty && (
        <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">
          Ungespeicherte Änderungen werden nicht übernommen – erst speichern,
          dann den Charakter anlegen.
        </p>
      )}
      {characters.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Diesem Szenario ist noch niemand zugeordnet. Füge über die Knöpfe
          oben einen vorhandenen Charakter hinzu, erstelle einen neuen – oder
          lege unten aus einer Figur einen an.
        </div>
      ) : (
        // Rund halb so große Kacheln wie in der Galerie: doppelt so viele
        // Spalten, engere Abstände. Weil eine kleine Kachel keinen Platz für
        // zwei Zeilen Beschreibung hat, steht hier nur der Name – die
        // Kurzbeschreibung wandert in den `title` (Tooltip beim Überfahren).
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6">
          {characters.map((c) => {
            const preview = primaryImage(c)?.thumbnail;
            // Wrapper, damit der Stern ein **Geschwister** des Kachel-Knopfes
            // ist – verschachtelte Buttons sind ungültiges HTML.
            return (
              <div key={c.id} className="relative">
                <button
                  type="button"
                  onClick={() => onSelectChar(c)}
                  title={c.character.kurzbeschreibung}
                  className={`flex w-full cursor-pointer flex-col overflow-hidden rounded-lg border bg-card text-left transition hover:shadow-md ${
                    c.isProtagonist
                      ? "border-amber-400 ring-1 ring-amber-400/60 dark:border-amber-400/70"
                      : "border-border"
                  }`}
                >
                  <div className="relative aspect-square w-full bg-muted">
                    {preview ? (
                      <Image
                        src={preview}
                        alt={c.character.name}
                        fill
                        sizes="(max-width: 640px) 50vw, 16vw"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <User size={28} strokeWidth={1.25} aria-hidden="true" />
                      </div>
                    )}
                  </div>
                  <span className="block truncate p-1.5 text-xs font-medium">
                    {c.character.name}
                  </span>
                </button>
                {/*
                  Protagonisten-Stern, oben rechts über dem Bild. Eigener
                  Button (nicht im Kachel-Knopf), mit gut lesbarem Chip über
                  dem Thumbnail. Sofort persistiert.
                */}
                <button
                  type="button"
                  onClick={() => onProtagonistUmschalten(c)}
                  disabled={protagonistBusy === c.id}
                  aria-pressed={c.isProtagonist}
                  aria-label={
                    c.isProtagonist
                      ? `${c.character.name} als Protagonist aufheben`
                      : `${c.character.name} als Protagonist markieren`
                  }
                  title={
                    c.isProtagonist
                      ? "Protagonist – klicken zum Aufheben"
                      : "Als Protagonist markieren (der Handlungsentwurf dreht sich dann um die Protagonisten)"
                  }
                  className={`absolute right-1 top-1 inline-flex items-center justify-center rounded-full bg-black/45 p-1.5 leading-none backdrop-blur-sm transition hover:bg-black/60 disabled:opacity-50 ${
                    c.isProtagonist
                      ? "text-amber-300"
                      : "text-white/75 hover:text-amber-200"
                  }`}
                >
                  <Star
                    size={15}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className={c.isProtagonist ? "fill-current" : ""}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/*
        Die **Figuren**-Notizen unter den fertigen Charakteren, in derselben
        Karte: wichtige Personen, aus denen noch Charaktere werden sollen.
        „✨ Charakter" an einer Figur legt sie an; das Häkchen je Figur
        entscheidet, ob sie in Handlungsentwurf und Story Arc einfließt (Default
        an). Kein Erzeugen-Knopf für das Feld selbst (nicht in ERZEUGBAR) –
        gefüllt wird von Hand, per Würfel/KI-Ergänzen oder vom „Zufälligen
        Szenario".
      */}
      <div className="mt-6 border-t border-border pt-5">
        <h3 className="mb-1 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Figuren
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Notizen zu wichtigen Personen, aus denen noch kein Charakter angelegt
          ist. „✨ Charakter“ macht aus einer Figur einen Charakter für dieses
          Szenario.
        </p>
        <ScenarioFields
          details={details}
          onChange={onFigurenChange}
          disabled={saving}
          fields={["figuren"]}
          generatable={generatable}
          onGenerate={onGenerate}
          generatingField={generatingField}
          zusatz={zusatz}
          onZusatzChange={onZusatzChange}
          onFigurCharakter={onFigurCharakter}
          figurBusy={figurBusy}
          figurFehler={figurFehler}
        />

        {details.figuren.trim() && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
            Das Häkchen je Figur entscheidet, ob sie in Handlungsentwurf und
            Story Arc einfließt. Abgehakte Figuren bleiben in der Liste, werden
            dort aber übergangen.
          </p>
        )}
      </div>
    </section>
  );
}
