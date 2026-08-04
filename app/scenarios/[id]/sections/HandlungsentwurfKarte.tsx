"use client";

import {
  ChevronsRight,
  Copy,
  Pencil,
  Plus,
  Search,
  Star,
  Users,
  X,
} from "../../../components/ui/icons";
import { ScenarioFields } from "../../../components/ScenarioFields";
import { LEER_META } from "@/lib/scenarioDocument";
import {
  MAX_NEUE_PLOT_PERSONEN,
  STORY_FORMS,
  STORY_TONES,
  TEXT_PROVIDERS,
  variantBadge,
  type PlotPerson,
  type ScenarioDetails,
  type StoryForm,
  type StoryTone,
  type TextProvider,
  type VariantMeta,
} from "@/lib/schema";

/**
 * Die **Handlung** eines Szenarios in einer Karte: oben die Handlungselemente
 * (persistente Vorgaben), darunter der Handlungsentwurf mit Varianten-Reitern,
 * den Lauf-Parametern (Erzählform/Ton/Modell/Weiterspinnen/Basis/neue Personen),
 * dem Entwurf-Feld, „Entwurf fortsetzen" und der Personensuche. Rein
 * präsentierend – Zustand und Handler kommen von der Seite. Optik 1:1 aus
 * `page.tsx`.
 */
export function HandlungsentwurfKarte({
  details,
  onDetailsChange,
  saving,
  generatingField,
  generatable,
  onGenerate,
  zusatz,
  onZusatzChange,
  variantenAnzeige,
  variantenMeta,
  aktiv,
  showModel,
  onVarianteWaehlen,
  onFavoritUmschalten,
  onTitelAendern,
  onVarianteLoeschen,
  onVarianteKopieren,
  onLeerenEntwurf,
  onAlleVariantenLoeschen,
  handlungForm,
  onHandlungFormChange,
  handlungTon,
  onHandlungTonChange,
  handlungProvider,
  onHandlungProviderChange,
  handlungWeiterspinnen,
  onHandlungWeiterspinnenChange,
  handlungAlsBasis,
  onHandlungAlsBasisChange,
  handlungNeuePersonen,
  onHandlungNeuePersonenChange,
  handlungNeuePersonenWunsch,
  onHandlungNeuePersonenWunschChange,
  onHandlungFortsetzen,
  personenSuchen,
  suchend,
  personen,
  suchFehler,
  onPersonWaehlen,
}: {
  details: ScenarioDetails;
  onDetailsChange: (details: ScenarioDetails) => void;
  saving: boolean;
  generatingField: keyof ScenarioDetails | null;
  generatable: ReadonlySet<keyof ScenarioDetails>;
  onGenerate: (key: keyof ScenarioDetails, anzahl?: number) => void;
  zusatz: Partial<Record<keyof ScenarioDetails, string>>;
  onZusatzChange: (key: keyof ScenarioDetails, value: string) => void;
  variantenAnzeige: string[];
  variantenMeta: VariantMeta[];
  aktiv: number;
  showModel: boolean;
  onVarianteWaehlen: (i: number) => void;
  onFavoritUmschalten: (i: number) => void;
  onTitelAendern: (i: number) => void;
  onVarianteLoeschen: (i: number) => void;
  onVarianteKopieren: (i: number) => void;
  onLeerenEntwurf: () => void;
  onAlleVariantenLoeschen: () => void;
  handlungForm: StoryForm;
  onHandlungFormChange: (v: StoryForm) => void;
  handlungTon: StoryTone;
  onHandlungTonChange: (v: StoryTone) => void;
  handlungProvider: TextProvider | "";
  onHandlungProviderChange: (v: TextProvider | "") => void;
  handlungWeiterspinnen: boolean;
  onHandlungWeiterspinnenChange: (v: boolean) => void;
  handlungAlsBasis: boolean;
  onHandlungAlsBasisChange: (v: boolean) => void;
  handlungNeuePersonen: number;
  onHandlungNeuePersonenChange: (v: number) => void;
  handlungNeuePersonenWunsch: string;
  onHandlungNeuePersonenWunschChange: (v: string) => void;
  onHandlungFortsetzen: () => void;
  personenSuchen: () => void;
  suchend: boolean;
  personen: PlotPerson[] | null;
  suchFehler: string | null;
  onPersonWaehlen: (p: PlotPerson) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      {/*
        Handlungselemente – die persistenten Vorgaben für die Erzeugung: was der
        nächste „✨ Neu erzeugen“-Lauf aufgreift. Aktive Elemente (Häkchen)
        fließen ein; die einmalige Stichwörter-Zeile im Entwurf-Kopf wirkt
        zusätzlich. Ein zufällig erzeugtes Szenario füllt die Liste mit.
      */}
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Handlungselemente
      </h2>
      <ScenarioFields
        details={details}
        onChange={onDetailsChange}
        disabled={saving}
        fields={["handlungselemente"]}
        generatingField={generatingField}
        hideLabel
      />

      <h2 className="mt-6 mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Handlungsentwurf
      </h2>
      {/*
        Reiter-Leiste über dem Feld: zwischen mehreren Handlungsentwürfen
        umschalten. Erscheint erst ab zwei Entwürfen – „✨ Neu erzeugen" im
        Feld-Kopf hängt jeweils einen weiteren an, statt den vorigen zu
        ersetzen. Die **aktive** Variante steht im Feld darunter und geht in
        Personensuche und Export.
      */}
      {variantenAnzeige.length >= 1 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-muted-foreground">
            Entwürfe:
          </span>
          {variantenAnzeige.map((text, i) => {
            // Der letzte verbliebene Entwurf trägt kein ✕ – er lässt sich nicht
            // über die Leiste löschen, und ohne Löschknopf braucht die Kachel
            // rechts wieder ihren vollen Rand.
            const loeschbar = variantenAnzeige.length >= 2;
            // Titel (KI, sonst „Entwurf N") oben, „Erzählform · Ton" klein
            // darunter – Letzteres nur, wenn es etwas Unterscheidendes hergibt
            // (leer/neutral wird weggelassen, s. `variantBadge`).
            const meta = variantenMeta[i] ?? LEER_META;
            const titel = meta.titel.trim() || `Entwurf ${i + 1}`;
            const badge = variantBadge(meta);
            return (
              <span
                key={i}
                className={`inline-flex items-stretch gap-1 overflow-hidden rounded-lg border text-xs transition ${
                  i === aktiv
                    ? "border-foreground bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onVarianteWaehlen(i)}
                  disabled={saving || generatingField !== null}
                  title={text.trim().slice(0, 200) || "(leerer Entwurf)"}
                  className="flex flex-col items-start gap-0.5 py-1 pr-1 pl-2.5 text-left disabled:opacity-50"
                >
                  <span className="max-w-[15rem] truncate font-medium">
                    {titel}
                  </span>
                  {badge && (
                    <span
                      className={`text-[10px] leading-tight ${
                        i === aktiv
                          ? "text-background/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
                {/*
                  Favorit-Stern – auf **jedem** Reiter: markiert und schaltet mit
                  einem Klick um, ohne die aktive Variante zu wechseln. Bewusst
                  ein Stern, kein Herz. ⭐ (Emoji, farbig) = Favorit, ☆ (gedämpft)
                  = nicht.
                */}
                <button
                  type="button"
                  onClick={() => onFavoritUmschalten(i)}
                  disabled={saving || generatingField !== null}
                  aria-pressed={meta.favorit}
                  title={
                    meta.favorit
                      ? `Entwurf ${i + 1} ist Favorit – klicken zum Aufheben`
                      : `Entwurf ${i + 1} als Favorit markieren`
                  }
                  aria-label={
                    meta.favorit
                      ? `Favorit-Markierung von Entwurf ${i + 1} aufheben`
                      : `Entwurf ${i + 1} als Favorit markieren`
                  }
                  className={`flex items-center px-1 leading-none transition disabled:opacity-40 ${
                    meta.favorit
                      ? ""
                      : i === aktiv
                        ? "text-background/45 hover:text-background/80"
                        : "text-foreground/30 hover:text-amber-500"
                  }`}
                >
                  <Star
                    size={15}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className={
                      meta.favorit ? "fill-amber-400 text-amber-400" : ""
                    }
                  />
                </button>
                {/* Titel ändern – nur am aktiven Reiter, um die Leiste ruhig zu halten. */}
                {i === aktiv && (
                  <button
                    type="button"
                    onClick={() => onTitelAendern(i)}
                    disabled={saving || generatingField !== null}
                    title={`Titel von Entwurf ${i + 1} ändern`}
                    aria-label={`Titel von Entwurf ${i + 1} ändern`}
                    className="flex items-center px-1 leading-none opacity-70 transition hover:opacity-100 disabled:opacity-40"
                  >
                    <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
                {loeschbar && (
                  <button
                    type="button"
                    onClick={() => onVarianteLoeschen(i)}
                    disabled={saving || generatingField !== null}
                    title={`Entwurf ${i + 1} löschen`}
                    aria-label={`Entwurf ${i + 1} löschen`}
                    className={`flex items-center pr-2 pl-0.5 leading-none opacity-70 transition hover:opacity-100 disabled:opacity-40 ${
                      i === aktiv
                        ? "hover:text-red-300"
                        : "hover:text-destructive dark:hover:text-red-400"
                    }`}
                  >
                    <X size={14} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              </span>
            );
          })}
          {/*
            Aktiven Entwurf kopieren – als eigenständige neue Variante (wie
            „⧉ Kopieren" beim Story Arc). Kein KI-Aufruf; hängt einen Reiter an.
          */}
          <button
            type="button"
            onClick={() => onVarianteKopieren(aktiv)}
            disabled={saving || generatingField !== null}
            title="Den aktiven Handlungsentwurf kopieren – als eigenständige neue Variante"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <Copy size={13} strokeWidth={1.75} aria-hidden="true" />
            Kopieren
          </button>
          {/*
            Leeren Entwurf anhängen – der Gegenpol zu „✨ Neu erzeugen": kein
            KI-Aufruf, ein leeres Feld zum Selbstschreiben. Sitzt bei den
            Reitern, weil er einen weiteren Reiter anlegt.
          */}
          <button
            type="button"
            onClick={onLeerenEntwurf}
            disabled={saving || generatingField !== null}
            title="Einen leeren Handlungsentwurf zum Selbstschreiben anlegen"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-40"
          >
            <Plus size={13} strokeWidth={1.75} aria-hidden="true" />
            Leerer Entwurf
          </button>
          {/*
            Bei genau einem Entwurf ist die Leiste keine Umschaltung, sondern
            ein Hinweis: Sie macht sichtbar, dass „Neu erzeugen" einen weiteren
            anlegt, statt diesen zu ersetzen. Ohne das käme niemand mit nur
            einem Entwurf auf die Idee, dass mehrere nebeneinander möglich sind.
          */}
          {variantenAnzeige.length === 1 && (
            <span className="text-xs text-muted-foreground">
              · „✨ Neu erzeugen“ legt einen weiteren an, statt diesen zu
              ersetzen
            </span>
          )}
          {/*
            Alle auf einmal löschen – erst ab zwei Entwürfen sinnvoll (bei
            einem tut es das Feld selbst). Rechts abgesetzt, damit es nicht
            mit den einzelnen ✕ verwechselt wird.
          */}
          {variantenAnzeige.length >= 2 && (
            <button
              type="button"
              onClick={onAlleVariantenLoeschen}
              disabled={saving || generatingField !== null}
              title="Alle Handlungsentwürfe löschen"
              className="ml-auto rounded-full border border-red-600/30 px-2.5 py-1 text-xs font-medium text-destructive transition hover:bg-red-600/10 disabled:opacity-40 dark:border-red-400/30 dark:hover:bg-red-400/10"
            >
              Alle löschen
            </button>
          )}
        </div>
      )}
      {/*
        Verwendetes Modell des aktiven Entwurfs – nur bei aktivierter
        Einstellung und wenn es (nicht bei Altbeständen) bekannt ist.
      */}
      {showModel && variantenMeta[aktiv]?.modell?.trim() && (
        <p className="mb-3 text-xs text-muted-foreground">
          Erzeugt mit{" "}
          <span className="font-mono">{variantenMeta[aktiv].modell}</span>
        </p>
      )}
      <div className="mb-3 flex flex-col gap-2">
        {/*
          Erzählform und Ton des Handlungsentwurfs – eigene Werte neben denen
          des Story Arcs, damit Entwurf und Arc unabhängig einstellbar sind.
          Erzählform = welche Art Geschichte (Krimi, Liebe …), Ton = wie
          erzählt. Zwei getrennte Achsen, beide unabhängig vom Genre der Welt.
        */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <span>Erzählform:</span>
            <select
              value={handlungForm}
              onChange={(e) => onHandlungFormChange(e.target.value as StoryForm)}
              disabled={saving || generatingField !== null}
              title="Die Art der Geschichte (Krimi, Liebe, Abenteuer …) – prägt Konflikt und Aufbau des Entwurfs, unabhängig vom Genre der Welt. „Allround“ = gemischt wie bisher."
              className="rounded-md border border-border bg-card px-2 py-1 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
            >
              {STORY_FORMS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <span>Ton:</span>
            <select
              value={handlungTon}
              onChange={(e) => onHandlungTonChange(e.target.value as StoryTone)}
              disabled={saving || generatingField !== null}
              title="Ton und Sprache des Handlungsentwurfs – nimmt den Ton der späteren Geschichte vorweg"
              className="rounded-md border border-border bg-card px-2 py-1 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
            >
              {STORY_TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {/*
            Modell-Anbieter **nur für diesen Entwurf**. „Standard" (Default)
            folgt der Einstellungsseite (Modell je Story-Erzeugung bzw. das
            globale Textmodell); ein konkreter Anbieter übersteuert das nur für
            „✨ Neu erzeugen" hier.
          */}
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <span>Modell:</span>
            <select
              value={handlungProvider}
              onChange={(e) =>
                onHandlungProviderChange(e.target.value as TextProvider | "")
              }
              disabled={saving || generatingField !== null}
              title="Welches Textmodell diesen Handlungsentwurf erzeugt. „Standard&quot; folgt der Einstellungsseite; die Wahl hier gilt nur für den Entwurf und wird nicht gespeichert."
              className="rounded-md border border-border bg-card px-2 py-1 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
            >
              <option value="">Standard (Einstellungen)</option>
              {TEXT_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/*
          Handlung weiterspinnen – **immer** sichtbar, denn es gilt auch für
          den frischen Entwurf: eine vollständige Geschichte (mit Ende) statt
          der offenen Ausgangslage.
        */}
        <label
          className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground"
          title="Angehakt skizziert „✨ Neu erzeugen“ eine vollständige Geschichte – von der Ausgangslage über die Zuspitzung bis zu einem Ende – statt einer offenen Ausgangslage. Gilt auch beim Aufbauen auf einem vorhandenen Entwurf."
        >
          <input
            type="checkbox"
            checked={handlungWeiterspinnen}
            onChange={(e) => onHandlungWeiterspinnenChange(e.target.checked)}
            disabled={saving || generatingField !== null}
            className="size-4 accent-primary"
          />
          Handlung weiterspinnen – vollständige Geschichte statt offener
          Ausgangslage
        </label>

        {/*
          Ob eine Figur einfließt, steuert ihr eigenes Häkchen an der Karte in
          der Figuren-Sektion oben – es gilt für Handlungsentwurf und Story Arc
          zugleich. Deshalb sitzt hier keine Figuren-Checkbox mehr.
        */}

        {/*
          Nächsten Entwurf auf dem aktuellen aufbauen. Erscheint nur, wenn es
          einen gibt – ohne Grundlage ist die Wahl leer. Die Stichwörter im
          Feld-Kopf steuern dann zusätzlich, wohin sich die neue Fassung
          verschiebt.
        */}
        {details.handlung.trim() && (
          <label
            className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground"
            title="Der nächste „✨ Neu erzeugen“-Lauf nimmt den angezeigten Entwurf als Grundlage und formt daraus eine neue Fassung – statt frei aus Welt und Figuren zu beginnen. Die Stichwörter wirken zusätzlich."
          >
            <input
              type="checkbox"
              checked={handlungAlsBasis}
              onChange={(e) => onHandlungAlsBasisChange(e.target.checked)}
              disabled={saving || generatingField !== null}
              className="size-4 accent-primary"
            />
            aktuellen Handlungsentwurf bei neuem Entwurf verwenden
          </label>
        )}

        {/*
          Neue benannte Personen auf Wunsch – lockert die harte Regel „keine
          neuen Hauptfiguren". 0 = aus (wie bisher). Bei ≥1 erscheint ein
          optionales Feld für gewünschte Namen/Rollen; leer erfindet die KI
          sie. Gilt für „Neu erzeugen", frisch wie auf Basis. Nicht gespeichert.
          Danach lassen sich die Neuen über „Personen im Entwurf suchen"
          als Charaktere anlegen.
        */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5">
              <Users size={15} strokeWidth={1.75} aria-hidden="true" />
              Neue Personen:
            </span>
            <select
              value={handlungNeuePersonen}
              onChange={(e) =>
                onHandlungNeuePersonenChange(Number(e.target.value))
              }
              disabled={saving || generatingField !== null}
              title="Wie viele neue, benannte Personen der Entwurf zusätzlich einführt. Wirkt auf „Neu erzeugen“ – frisch wie auf Basis eines vorhandenen Entwurfs."
              className="rounded-md border border-border bg-card px-2 py-1 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
            >
              <option value={0}>aus</option>
              {Array.from({ length: MAX_NEUE_PLOT_PERSONEN }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </label>
          {handlungNeuePersonen >= 1 && (
            <input
              value={handlungNeuePersonenWunsch}
              onChange={(e) => onHandlungNeuePersonenWunschChange(e.target.value)}
              disabled={saving || generatingField !== null}
              maxLength={500}
              placeholder="optional: Namen/Rollen – z. B. „Mira (Schwester); ein korrupter Beamter“"
              title="Gewünschte Namen oder Rollen der neuen Personen. Leer gelassen erfindet die KI sie stimmig aus Welt und Konflikt. Wird nicht gespeichert."
              aria-label="Gewünschte Namen oder Rollen der neuen Personen"
              className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-1 text-sm outline-none transition focus:border-primary/50 disabled:opacity-50"
            />
          )}
        </div>
      </div>

      <ScenarioFields
        details={details}
        onChange={onDetailsChange}
        disabled={saving}
        fields={["handlung"]}
        generatable={generatable}
        onGenerate={onGenerate}
        generatingField={generatingField}
        zusatz={zusatz}
        onZusatzChange={onZusatzChange}
        hideLabel
      />

      {/*
        Entwurf fortsetzen – anders als „✨ Neu erzeugen" (neuer Reiter) wächst
        der vorhandene Text im Feld weiter: die KI knüpft ans Ende an, die
        Fortsetzung wird angehängt. Nur sichtbar, wenn ein Entwurf da ist.
      */}
      {details.handlung.trim() && (
        <div className="mt-3">
          <button
            type="button"
            onClick={onHandlungFortsetzen}
            disabled={saving || generatingField !== null}
            title="Knüpft an das Ende des aktuellen Entwurfs an und schreibt weiter. Die Fortsetzung wird an den vorhandenen Text angehängt (nicht als neuer Reiter). Nutzt Ton, Erzählform, „Weiterspinnen“ und die Stichwörter wie „Neu erzeugen“."
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            {generatingField === "handlung" ? (
              "Setze fort …"
            ) : (
              <>
                <ChevronsRight size={16} strokeWidth={1.75} aria-hidden="true" />
                Entwurf fortsetzen
              </>
            )}
          </button>
        </div>
      )}

      {/*
        Personen aus dem Handlungsentwurf – direkt unter dem Feld, weil sie
        sich darauf beziehen.

        Bewusst **auf Knopfdruck** und nicht beim Öffnen der Seite: Die Suche
        ist ein KI-Aufruf, und im Projekt löst jede Erzeugung ein Klick aus.
        Ein Aufruf, der beim bloßen Ansehen eines Szenarios Geld kostet, wäre
        der erste seiner Art.
      */}
      {details.handlung.trim() && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={personenSuchen}
              disabled={suchend}
              title="Sucht im Handlungsentwurf nach Personen, die dem Szenario noch nicht zugeordnet sind"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition hover:bg-muted disabled:opacity-50"
            >
              {suchend ? (
                "Sucht …"
              ) : (
                <>
                  <Search size={13} strokeWidth={1.75} aria-hidden="true" />
                  Personen im Entwurf suchen
                </>
              )}
            </button>
            {personen === null && !suchend && (
              <span className="text-xs text-muted-foreground">
                Findet Namen, für die es noch keinen Charakter gibt.
              </span>
            )}
          </div>

          {suchFehler && (
            <p className="mt-2 text-xs text-destructive">{suchFehler}</p>
          )}

          {personen !== null &&
            (personen.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Keine neuen Personen – der Entwurf nennt nur Figuren, die dem
                Szenario schon zugeordnet sind.
              </p>
            ) : (
              <div className="mt-3">
                <p className="mb-2 text-xs text-muted-foreground">
                  Noch nicht im Szenario – anklicken, um daraus einen Charakter
                  anzulegen:
                </p>
                <div className="flex flex-wrap gap-2">
                  {personen.map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => onPersonWaehlen(p)}
                      title={`Charakter für „${p.name}" anlegen`}
                      className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-500/20 dark:text-amber-300"
                    >
                      + {p.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
