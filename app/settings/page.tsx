"use client";

import { useEffect, useState } from "react";
import {
  exportDatabase,
  getSettings,
  importDatabase,
  updateSettings,
} from "@/lib/client";
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

      <BackupSection />
    </div>
  );
}

function BackupSection() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const { blob, filename } = await exportDatabase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(
        `Sicherung heruntergeladen (${(blob.size / 1024 / 1024).toFixed(1)} MB).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export fehlgeschlagen.");
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // erlaubt erneutes Wählen derselben Datei
    if (!file || importing) return;

    // Der Import löscht den gesamten Bestand – hier ist eine Rückfrage Pflicht.
    if (
      !confirm(
        `„${file.name}" einspielen?\n\n` +
          "ACHTUNG: Alle aktuellen Charaktere, Gruppen und Einstellungen werden " +
          "dabei gelöscht und durch den Inhalt der Datei ersetzt.\n\n" +
          "Vorher wird automatisch eine Sicherheitskopie des jetzigen Standes " +
          "neben der Datenbank abgelegt.",
      )
    )
      return;

    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const r = await importDatabase(file);
      setMessage(
        `Eingespielt: ${r.characters} Charaktere, ${r.images} Bilder, ` +
          `${r.groups} Gruppen, ${r.settings} Einstellungen. ` +
          `Sicherheitskopie: ${r.safetyCopy}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import fehlgeschlagen.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
      <div>
        <h2 className="font-medium">Sicherung</h2>
        <p className="text-sm text-foreground/60">
          Die gesamte Datenbank – Charaktere samt Bildern, Gruppen und
          Einstellungen – als Datei sichern oder wieder einspielen.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || importing}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {exporting ? "Erstelle Sicherung …" : "Datenbank exportieren"}
        </button>

        <label
          className={`rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition dark:border-white/15 ${
            importing || exporting
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          }`}
        >
          {importing ? "Spiele ein …" : "Datenbank importieren"}
          <input
            type="file"
            accept=".db,application/octet-stream"
            className="hidden"
            onChange={handleImport}
            disabled={importing || exporting}
          />
        </label>
      </div>

      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
        Der Import <strong>ersetzt den gesamten Bestand</strong>. Vorher wird
        automatisch eine Sicherheitskopie des aktuellen Standes neben der
        Datenbank abgelegt.
      </p>

      {message && (
        <p className="text-sm text-foreground/70">{message}</p>
      )}
      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
