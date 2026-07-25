"use client";

import { useState } from "react";
import { generateInputField, generateName } from "@/lib/client";
import { randomName } from "@/lib/names";
import { randomAppearance, randomPersonality } from "@/lib/inspiration";
import { randomBackground } from "@/lib/backgrounds";
import { randomProfession } from "@/lib/professions";
import type { InputField } from "@/lib/prompts";
import { DEFAULT_IMAGE_STYLE, GENDERS, type CharacterInput } from "@/lib/schema";
import {
  DEFAULT_GENRE,
  GENRE_TEMPLATES,
} from "@/lib/templates";
import { RandomCharacterModal } from "./RandomCharacterModal";

const EMPTY: CharacterInput = {
  genre: DEFAULT_GENRE,
  name: "",
  gender: "egal",
  age: "",
  ethnicity: "",
  appearance: "",
  setting: "",
  occupation: "",
  background: "",
  personality: "",
  notes: "",
  imageStyle: DEFAULT_IMAGE_STYLE,
  // Kein Formularfeld: wird erst beim Speichern aus der Modellantwort gesetzt.
  model: "",
};

const inputClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none transition focus:border-black/40 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-foreground/50">{hint}</span>}
    </label>
  );
}

/** Der Würfel neben einem Feld. Ersetzt dessen Inhalt durch einen Zufallswert. */
function DiceButton({
  onClick,
  disabled,
  label,
  title,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      className="shrink-0 rounded-md border border-black/15 px-3 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
    >
      🎲
    </button>
  );
}

/**
 * Das schlaue Gegenstück zum Würfel: befüllt das Feld per KI, passend zu den
 * übrigen Angaben. `busy` zeigt den Lauf **dieses** Feldes, `disabled` sperrt
 * alle KI-Knöpfe, solange irgendeiner läuft (die Erzeugung liest die anderen
 * Felder mit).
 */
function AiButton({
  onClick,
  busy,
  disabled,
  label,
  title,
}: {
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
  label: string;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title}
      className="shrink-0 rounded-md border border-black/15 px-3 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
    >
      {busy ? "…" : "✨"}
    </button>
  );
}

export function CharacterForm({
  onGenerate,
  loading,
  initialInput,
}: {
  onGenerate: (input: CharacterInput) => void;
  loading: boolean;
  /**
   * Vorbelegte Felder – aktuell aus einem Szenario (`scenarioToInput`). Sie
   * werden **nur beim ersten Rendern** gelesen: danach gehört das Formular dem
   * Nutzer, und ein Nachziehen würde seine Eingaben überschreiben. Die
   * aufrufende Seite rendert das Formular deshalb erst, wenn sie sie hat.
   */
  initialInput?: Partial<CharacterInput>;
}) {
  const [form, setForm] = useState<CharacterInput>({
    ...EMPTY,
    ...initialInput,
  });
  /**
   * Das Genre ist **Teil der Vorgaben**, kein eigener State mehr. Früher war
   * es beides nicht: eine reine Formular-Umschaltung, die beim Speichern
   * verfiel. Damit wusste später niemand mehr, in welche Welt die Figur
   * gehört – am schmerzlichsten beim Ableiten eines Szenarios.
   */
  const genre = form.genre;
  const [namingAI, setNamingAI] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  /** Ob das „Zufällige Figur"-Modal offen ist. */
  const [randomOpen, setRandomOpen] = useState(false);
  /** Welches Feld gerade per KI erzeugt wird (sperrt alle KI-Knöpfe). */
  const [aiField, setAiField] = useState<InputField | null>(null);
  /** Fehler der Feld-KI, dem verursachenden Feld zugeordnet. */
  const [aiFieldError, setAiFieldError] = useState<{
    feld: InputField;
    msg: string;
  } | null>(null);

  function update<K extends keyof CharacterInput>(
    key: K,
    value: CharacterInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Genre-Vorlage anwenden: nur die von der Vorlage definierten Felder
  // überschreiben (Merge), alles andere bleibt erhalten.
  function applyGenre(id: string) {
    const template = GENRE_TEMPLATES.find((t) => t.id === id);
    setForm((f) => ({ ...f, ...(template?.values ?? {}), genre: id }));
  }

  /**
   * Zurücksetzen führt auf die **Vorbelegung** zurück, nicht auf ein leeres
   * Formular. Wer aus einem Szenario kommt, will seine Eingaben verwerfen –
   * nicht die Zugehörigkeit zur Welt, für die er den Charakter anlegt.
   */
  function reset() {
    setForm({ ...EMPTY, ...initialInput });
    setNameError(null);
  }

  /** Zufallsname aus den lokalen Listen – kostenlos und ohne Wartezeit. */
  function rollName() {
    setNameError(null);
    update(
      "name",
      randomName({
        gender: form.gender,
        herkunft: form.ethnicity,
        genre,
      }),
    );
  }

  /**
   * Namensvorschlag vom Modell. Anders als der Würfel wertet er die
   * Freitextfelder aus (Herkunft, Setting, Beruf, Hintergrund) und trifft
   * daher auch Vorgaben, für die es keine Liste gibt.
   */
  async function suggestName() {
    if (namingAI) return;
    setNamingAI(true);
    setNameError(null);
    try {
      const { name } = await generateName(form);
      update("name", name);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Fehler.");
    } finally {
      setNamingAI(false);
    }
  }

  /**
   * Ein Feld per KI befüllen – das schlaue Gegenstück zum Würfel: Es liest die
   * übrigen ausgefüllten Angaben mit und erzeugt Stimmiges im selben Umfang.
   * Ersetzt den Feldinhalt (wie der Würfel); das Zielfeld selbst geht nicht mit.
   */
  async function suggestField(feld: InputField) {
    if (aiField) return;
    setAiField(feld);
    setAiFieldError(null);
    try {
      const { wert } = await generateInputField(feld, form);
      update(feld, wert);
    } catch (err) {
      setAiFieldError({
        feld,
        msg: err instanceof Error ? err.message : "Fehler.",
      });
    } finally {
      setAiField(null);
    }
  }

  /**
   * Das Ergebnis der „Zufällige Figur" ins Formular übernehmen: die gefüllten
   * Felder über den bestehenden Zustand legen. Bewusst **kein** `applyGenre`
   * hinterher – das würde die eben erzeugten Felder mit den Genre-Vorlagewerten
   * überschreiben; das Genre kommt hier schon fertig mit.
   */
  function applyRandom(fields: Partial<CharacterInput>) {
    setForm((f) => ({ ...f, ...fields }));
    setNameError(null);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate(form);
      }}
      className="flex flex-col gap-5 rounded-xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
    >
      {/*
        Ganz oben: die ganze Figur auf einmal würfeln. Öffnet ein Modal mit
        freier Themen-Vorgabe; bereits ausgefüllte Felder bleiben, der Rest wird
        gefüllt. Rechtsbündig, damit es das Formular nicht anführt, sondern als
        Abkürzung danebensteht.
      */}
      <div className="-mb-1 flex justify-end">
        <button
          type="button"
          onClick={() => setRandomOpen(true)}
          disabled={loading}
          title="Das ganze Formular per KI ausfüllen – bereits ausgefüllte Felder bleiben erhalten"
          className="rounded-md border border-black/15 px-3 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
        >
          🎲 Zufällige Figur
        </button>
      </div>

      <Field
        label="Genre"
        hint="Belegt das Setting genre-passend vor, steuert die Würfel und wird am Charakter gespeichert – alle anderen Felder bleiben unverändert."
      >
        <select
          className={inputClass}
          value={genre}
          onChange={(e) => applyGenre(e.target.value)}
        >
          {GENRE_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.emoji} {t.label}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Name"
        hint="Nur ein Vorname? Dann wird ein passender Nachname ergänzt. Frei lassen für einen erfundenen Namen."
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            className={`${inputClass} min-w-48 flex-1`}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="z. B. „Mira“ oder „Mira Sandoval“"
            maxLength={120}
          />
          <button
            type="button"
            onClick={rollName}
            disabled={loading}
            title="Zufallsname passend zur Genre-Vorlage – sofort und ohne KI"
            className="shrink-0 rounded-md border border-black/15 px-3 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
          >
            🎲 Würfeln
          </button>
          <button
            type="button"
            onClick={suggestName}
            disabled={loading || namingAI}
            title="Namensvorschlag der KI, passend zu Herkunft, Setting, Beruf und Hintergrund"
            className="shrink-0 rounded-md border border-black/15 px-3 py-2 text-sm font-medium transition hover:bg-black/[0.04] disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/[0.06]"
          >
            {namingAI ? "Denkt nach …" : "✨ Zu den Angaben"}
          </button>
        </div>
        {nameError && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {nameError}
          </span>
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Geschlecht">
          <select
            className={inputClass}
            value={form.gender}
            onChange={(e) =>
              update("gender", e.target.value as CharacterInput["gender"])
            }
          >
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g === "egal" ? "egal / überrasch mich" : g}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Alter" hint="z. B. „Mitte 30“ oder „jung“">
          <input
            className={inputClass}
            value={form.age}
            onChange={(e) => update("age", e.target.value)}
            placeholder="frei lassen für Zufall"
          />
        </Field>

        <Field label="Herkunft / Ethnie">
          <input
            className={inputClass}
            value={form.ethnicity}
            onChange={(e) => update("ethnicity", e.target.value)}
            placeholder="z. B. skandinavisch"
          />
        </Field>
      </div>

      <Field label="Aussehen" hint="Haare, Augen, Statur, Kleidung, Auffälligkeiten …">
        <div className="flex items-start gap-2">
          <textarea
            className={`${inputClass} min-h-20 min-w-0 flex-1 resize-y`}
            value={form.appearance}
            onChange={(e) => update("appearance", e.target.value)}
            placeholder="z. B. lange rote Haare, Sommersprossen, schlank, trägt eine abgewetzte Lederjacke"
          />
          <DiceButton
            onClick={() => update("appearance", randomAppearance(form.gender))}
            disabled={loading}
            label="Aussehen würfeln"
            title="Zufällige Merkmale zum Aussehen, passend zum gewählten Geschlecht"
          />
          <AiButton
            onClick={() => suggestField("appearance")}
            busy={aiField === "appearance"}
            disabled={loading || aiField !== null}
            label="Aussehen per KI erzeugen"
            title="Aussehen per KI, passend zu Geschlecht, Alter, Herkunft und Beruf"
          />
        </div>
        {aiFieldError?.feld === "appearance" && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {aiFieldError.msg}
          </span>
        )}
      </Field>

      <Field label="Persönlichkeit">
        <div className="flex items-start gap-2">
          <textarea
            className={`${inputClass} min-h-16 min-w-0 flex-1 resize-y`}
            value={form.personality}
            onChange={(e) => update("personality", e.target.value)}
            placeholder="z. B. sarkastisch, loyal, misstrauisch gegenüber Autorität"
          />
          <DiceButton
            onClick={() => update("personality", randomPersonality())}
            disabled={loading}
            label="Persönlichkeit würfeln"
            title="Drei bis vier zufällige Wesenszüge"
          />
          <AiButton
            onClick={() => suggestField("personality")}
            busy={aiField === "personality"}
            disabled={loading || aiField !== null}
            label="Persönlichkeit per KI erzeugen"
            title="Persönlichkeit per KI, passend zu den übrigen Angaben"
          />
        </div>
        {aiFieldError?.feld === "personality" && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {aiFieldError.msg}
          </span>
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Setting / Genre">
          <input
            className={inputClass}
            value={form.setting}
            onChange={(e) => update("setting", e.target.value)}
            placeholder="z. B. Mittelalter-Fantasy, Cyberpunk, Gegenwart"
          />
        </Field>

        <Field label="Beruf / Rolle">
          <div className="flex items-center gap-2">
            <input
              className={`${inputClass} min-w-0 flex-1`}
              value={form.occupation}
              onChange={(e) => update("occupation", e.target.value)}
              placeholder="z. B. Söldnerin, Ärztin, Detektiv"
            />
            <DiceButton
              onClick={() => update("occupation", randomProfession(genre))}
              disabled={loading}
              label="Beruf würfeln"
              title="Zufälliger Beruf, passend zur Genre-Vorlage"
            />
            <AiButton
              onClick={() => suggestField("occupation")}
              busy={aiField === "occupation"}
              disabled={loading || aiField !== null}
              label="Beruf per KI erzeugen"
              title="Beruf per KI, passend zu Genre, Setting und Hintergrund"
            />
          </div>
          {aiFieldError?.feld === "occupation" && (
            <span className="text-xs text-red-600 dark:text-red-400">
              {aiFieldError.msg}
            </span>
          )}
        </Field>
      </div>

      <Field label="Hintergrund" hint="Herkunftsgeschichte, prägende Ereignisse, Ziele">
        <div className="flex items-start gap-2">
          <textarea
            className={`${inputClass} min-h-20 min-w-0 flex-1 resize-y`}
            value={form.background}
            onChange={(e) => update("background", e.target.value)}
            placeholder="z. B. wuchs in einem Fischerdorf auf, verlor früh die Eltern …"
          />
          <DiceButton
            onClick={() => update("background", randomBackground(genre))}
            disabled={loading}
            label="Hintergrund würfeln"
            title="Ein bis drei zufällige prägende Ereignisse, passend zur Genre-Vorlage"
          />
          <AiButton
            onClick={() => suggestField("background")}
            busy={aiField === "background"}
            disabled={loading || aiField !== null}
            label="Hintergrund per KI erzeugen"
            title="Hintergrund per KI, passend zu Herkunft, Beruf und Genre"
          />
        </div>
        {aiFieldError?.feld === "background" && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {aiFieldError.msg}
          </span>
        )}
      </Field>

      <Field label="Weitere Wünsche">
        <textarea
          className={`${inputClass} min-h-16 resize-y`}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          placeholder="alles Weitere, das der Charakter haben soll"
        />
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Erstelle Charakter …" : "Charakter erstellen"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={loading}
          className="text-sm text-foreground/60 transition hover:text-foreground disabled:opacity-50"
        >
          Zurücksetzen
        </button>
      </div>

      {randomOpen && (
        <RandomCharacterModal
          current={form}
          onFilled={applyRandom}
          onClose={() => setRandomOpen(false)}
        />
      )}
    </form>
  );
}
