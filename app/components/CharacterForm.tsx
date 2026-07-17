"use client";

import { useState } from "react";
import { DEFAULT_IMAGE_STYLE, GENDERS, type CharacterInput } from "@/lib/schema";

const EMPTY: CharacterInput = {
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

export function CharacterForm({
  onGenerate,
  loading,
}: {
  onGenerate: (input: CharacterInput) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<CharacterInput>(EMPTY);

  function update<K extends keyof CharacterInput>(
    key: K,
    value: CharacterInput[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGenerate(form);
      }}
      className="flex flex-col gap-5 rounded-xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03]"
    >
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
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={form.appearance}
          onChange={(e) => update("appearance", e.target.value)}
          placeholder="z. B. lange rote Haare, Sommersprossen, schlank, trägt eine abgewetzte Lederjacke"
        />
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
          <input
            className={inputClass}
            value={form.occupation}
            onChange={(e) => update("occupation", e.target.value)}
            placeholder="z. B. Söldnerin, Ärztin, Detektiv"
          />
        </Field>
      </div>

      <Field label="Hintergrund" hint="Herkunftsgeschichte, prägende Ereignisse, Ziele">
        <textarea
          className={`${inputClass} min-h-20 resize-y`}
          value={form.background}
          onChange={(e) => update("background", e.target.value)}
          placeholder="z. B. wuchs in einem Fischerdorf auf, verlor früh die Eltern …"
        />
      </Field>

      <Field label="Persönlichkeit">
        <textarea
          className={`${inputClass} min-h-16 resize-y`}
          value={form.personality}
          onChange={(e) => update("personality", e.target.value)}
          placeholder="z. B. sarkastisch, loyal, misstrauisch gegenüber Autorität"
        />
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
          onClick={() => setForm(EMPTY)}
          disabled={loading}
          className="text-sm text-foreground/60 transition hover:text-foreground disabled:opacity-50"
        >
          Zurücksetzen
        </button>
      </div>
    </form>
  );
}
