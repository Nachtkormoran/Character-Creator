"use client";

import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "@/lib/client";
import {
  IMAGE_MODELS,
  IMAGE_PRICES_AS_OF,
  IMAGE_PRICES_USD,
  IMAGE_QUALITIES,
  isKnownImageModel,
  type ImageModel,
  type ImageQuality,
  type Settings,
} from "@/lib/schema";

/** Preis als Cent-Angabe, z. B. 0.042 → "4,2 ct". */
function formatPrice(usd: number | null): string {
  if (usd === null) return "–";
  const cents = usd * 100;
  const text = cents < 10 ? cents.toFixed(1) : cents.toFixed(0);
  return `${text.replace(".", ",")} ct`;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch((e) => setError(e instanceof Error ? e.message : "Fehler."))
      .finally(() => setLoading(false));
  }, []);

  async function choose(imageModel: ImageModel, imageQuality: ImageQuality) {
    const previous = settings;
    setSettings((s) => (s ? { ...s, imageModel, imageQuality } : s)); // optimistisch
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setSettings(await updateSettings({ imageModel, imageQuality }));
      setSaved(true);
    } catch (e) {
      setSettings(previous); // Rollback bei Fehler
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  // Ein über OPENAI_IMAGE_MODEL gesetztes, nicht gelistetes Modell soll
  // sichtbar sein statt stillschweigend als "nichts ausgewählt" zu erscheinen.
  const fromEnv =
    settings && !isKnownImageModel(settings.imageModel)
      ? settings.imageModel
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="mt-2 text-foreground/60">
          Gelten für alle künftigen Generierungen. Bereits gespeicherte
          Charaktere bleiben unverändert.
        </p>
      </div>

      {loading && <p className="text-foreground/60">Lade Einstellungen …</p>}

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {!loading && settings && (
        <section className="flex flex-col gap-4 rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div>
            <h2 className="font-medium">Bildmodell und Qualität</h2>
            <p className="text-sm text-foreground/60">
              Wähle die Kombination aus Modell und Qualitätsstufe. Beides
              verändert das Bildergebnis – die Preise sind ungefähre Kosten pro
              Portrait bei 1024×1024.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-black/10 px-2 py-2 text-left font-medium dark:border-white/10">
                    Modell
                  </th>
                  {IMAGE_QUALITIES.map((q) => (
                    <th
                      key={q.value}
                      className="border-b border-black/10 px-2 py-2 text-center font-medium dark:border-white/10"
                    >
                      {q.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {IMAGE_MODELS.map((m) => (
                  <tr key={m.value} className="align-top">
                    <th
                      scope="row"
                      className="border-b border-black/5 px-2 py-3 text-left font-normal dark:border-white/5"
                    >
                      <span className="font-mono text-sm">{m.label}</span>
                      {m.value === "gpt-image-1" && (
                        <span className="ml-2 text-xs text-foreground/50">
                          Standard
                        </span>
                      )}
                      <span className="mt-0.5 block text-xs text-foreground/55">
                        {m.hint}
                      </span>
                    </th>

                    {IMAGE_QUALITIES.map((q) => {
                      const active =
                        settings.imageModel === m.value &&
                        settings.imageQuality === q.value;
                      const price = IMAGE_PRICES_USD[m.value][q.value];
                      return (
                        <td
                          key={q.value}
                          className="border-b border-black/5 px-1 py-2 text-center dark:border-white/5"
                        >
                          <label
                            className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border p-2 transition ${
                              active
                                ? "border-foreground/40 bg-foreground/[0.06]"
                                : "border-transparent hover:border-black/15 dark:hover:border-white/15"
                            }`}
                          >
                            <input
                              type="radio"
                              name="modelQuality"
                              value={`${m.value}|${q.value}`}
                              checked={active}
                              onChange={() => choose(m.value, q.value)}
                              disabled={saving}
                              aria-label={`${m.label}, Qualität ${q.label}, ${formatPrice(price)} pro Bild`}
                            />
                            <span className="tabular-nums text-xs text-foreground/70">
                              {formatPrice(price)}
                            </span>
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-foreground/50">
            Preise: ungefähre Angaben pro Bild bei 1024×1024, Stand{" "}
            {IMAGE_PRICES_AS_OF}, aus öffentlichen Preisvergleichen – ohne
            Gewähr. Vor allem in der höchsten Stufe weichen die Quellen
            voneinander ab. Maßgeblich ist deine OpenAI-Abrechnung.
          </p>

          {fromEnv && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
              Aktuell ist über <code>OPENAI_IMAGE_MODEL</code> das Modell{" "}
              <code>{fromEnv}</code> gesetzt, das nicht in der Tabelle steht.
              Eine Auswahl hier überschreibt es für künftige Generierungen.
            </p>
          )}

          <p className="text-xs text-foreground/50">
            {saving
              ? "Speichere …"
              : saved
                ? "Gespeichert."
                : "Änderungen werden sofort gespeichert."}
          </p>
        </section>
      )}
    </div>
  );
}
