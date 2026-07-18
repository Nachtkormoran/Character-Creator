"use client";

import { useState } from "react";
import { generateName } from "@/lib/client";
import { randomName } from "@/lib/names";
import {
  randomAppearance,
  randomBackground,
  randomPersonality,
} from "@/lib/inspiration";
import { randomProfession } from "@/lib/professions";
import { DEFAULT_IMAGE_STYLE, GENDERS, type CharacterInput } from "@/lib/schema";
import {
  DEFAULT_GENRE,
  GENRE_TEMPLATES,
} from "@/lib/templates";

const EMPTY: CharacterInput = {
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

export function CharacterForm({
  onGenerate,
  loading,
}: {
  onGenerate: (input: CharacterInput) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<CharacterInput>(EMPTY);
  const [genre, setGenre] = useState<string>(DEFAULT_GENRE);
  const [namingAI, setNamingAI] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  function update<K extends keyof CharacterInput>(
    key: K,
    value: CharacterInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Genre-Vorlage anwenden: nur die von der Vorlage definierten Felder
  // überschreiben (Merge), alles andere bleibt erhalten.
  function applyGenre(id: string) {
    setGenre(id);
    const template = GENRE_TEMPLATES.find((t) => t.id === id);
    if (template) setForm((f) => ({ ...f, ...template.values }));
  }

  function reset() {
    setForm(EMPTY);
    setGenre(DEFAULT_GENRE);
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate(form);
      }}
      className="flex flex-col gap-5 rounded-xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
    >
      <Field
        label="Genre-Vorlage"
        hint="Belegt das Setting genre-passend vor – alle anderen Felder bleiben unverändert."
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
        </div>
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
        </div>
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
          </div>
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
            onClick={() => update("background", randomBackground())}
            disabled={loading}
            label="Hintergrund würfeln"
            title="Ein bis zwei zufällige prägende Ereignisse"
          />
        </div>
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
    </form>
  );
}
