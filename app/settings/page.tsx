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
  STORY_GENERATIONS,
  TEXT_PROVIDERS,
  type ImageModel,
  type ImageQuality,
  type Settings,
  type StoryGeneration,
  type TextProvider,
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

  async function chooseTextProvider(textProvider: TextProvider) {
    const previous = settings;
    setSettings((s) => (s ? { ...s, textProvider } : s)); // optimistisch
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setSettings(await updateSettings({ textProvider }));
      setSaved(true);
    } catch (e) {
      setSettings(previous); // Rollback bei Fehler
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function chooseShowModel(showModel: boolean) {
    const previous = settings;
    setSettings((s) => (s ? { ...s, showModel } : s)); // optimistisch
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setSettings(await updateSettings({ showModel }));
      setSaved(true);
    } catch (e) {
      setSettings(previous); // Rollback bei Fehler
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function chooseUseModelOverrides(useModelOverrides: boolean) {
    const previous = settings;
    setSettings((s) => (s ? { ...s, useModelOverrides } : s)); // optimistisch
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setSettings(await updateSettings({ useModelOverrides }));
      setSaved(true);
    } catch (e) {
      setSettings(previous); // Rollback bei Fehler
      setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function chooseStoryModel(
    generation: StoryGeneration,
    provider: TextProvider,
  ) {
    if (!settings) return;
    const previous = settings;
    // Vollständige Karte mit der einen geänderten Erzeugung – der Server
    // schreibt zwar nur geänderte Schlüssel, aber die Client-Signatur erwartet
    // die volle Karte (wie Modell + Qualität zusammen).
    const storyModels = { ...settings.storyModels, [generation]: provider };
    setSettings((s) => (s ? { ...s, storyModels } : s)); // optimistisch
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setSettings(await updateSettings({ storyModels }));
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
            <h2 className="font-medium">Textmodell</h2>
            <p className="text-sm text-foreground/60">
              Welcher Anbieter die Texte erzeugt (Beschreibungen, Namen,
              Szenarien, Ansatzpunkte …). Die <strong>Bilder</strong> laufen
              unabhängig davon immer über OpenAI.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {TEXT_PROVIDERS.map((p) => {
              const active = settings.textProvider === p.value;
              return (
                <label
                  key={p.value}
                  className={`flex cursor-pointer gap-3 rounded-md border p-3 transition ${
                    active
                      ? "border-foreground/40 bg-foreground/[0.06]"
                      : "border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
                  }`}
                >
                  <input
                    type="radio"
                    name="textProvider"
                    value={p.value}
                    checked={active}
                    onChange={() => chooseTextProvider(p.value)}
                    disabled={saving}
                    className="mt-1"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {p.label}
                      {p.value === "openai" && (
                        <span className="ml-2 text-xs font-normal text-foreground/50">
                          Standard
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-foreground/60">{p.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>

          <p className="text-xs text-foreground/50">
            {saving
              ? "Speichere …"
              : saved
                ? "Gespeichert."
                : "Änderungen werden sofort gespeichert."}
          </p>

          {/*
            Anzeige-Schalter: Modell bei den Story-Erzeugungen mit anzeigen.
            Reine Anzeige, Default aus – ändert nichts an der Erzeugung selbst.
          */}
          <label className="mt-1 flex cursor-pointer items-start gap-3 border-t border-black/5 pt-4 dark:border-white/5">
            <input
              type="checkbox"
              checked={settings.showModel}
              onChange={(e) => chooseShowModel(e.target.checked)}
              disabled={saving}
              className="mt-1"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                Verwendetes Modell anzeigen
              </span>
              <span className="text-xs text-foreground/60">
                Zeigt bei Handlungsentwurf, Story Arc, Kapitel-Ableitung und
                Kapitel-Prosa an, mit welchem Textmodell sie erzeugt wurden.
                Reine Anzeige – Standard aus.
              </span>
            </span>
          </label>
        </section>
      )}

      {!loading && settings && (
        <section className="flex flex-col gap-4 rounded-lg border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
          <div>
            <h2 className="font-medium">Modell je Story-Erzeugung</h2>
            <p className="text-sm text-foreground/60">
              Legt für die vier Story-Erzeugungen jeweils <strong>ein eigenes</strong>{" "}
              Textmodell fest. Alle übrigen Text-Erzeugungen (Beschreibungen,
              Namen, Szenarien, Ansatzpunkte …) folgen weiter dem{" "}
              <strong>Textmodell</strong> oben.
            </p>
          </div>

          {/*
            Master-Schalter oberhalb der Detaileinstellungen: Erst wenn er an ist,
            greifen die vier Auswahlfelder. Aus → jede Story-Erzeugung folgt dem
            globalen Textmodell (wie bisher).
          */}
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={settings.useModelOverrides}
              onChange={(e) => chooseUseModelOverrides(e.target.checked)}
              disabled={saving}
              className="mt-1"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">
                Modell je Story-Erzeugung separat festlegen
              </span>
              <span className="text-xs text-foreground/60">
                Aus (Standard): alle vier folgen dem Textmodell oben. An: die
                Auswahl darunter wird verwendet. Ein Pro-Lauf-Selektor auf der
                Szenario-Seite übersteuert die Wahl weiterhin für einen
                einzelnen Lauf.
              </span>
            </span>
          </label>

          {/*
            Detaileinstellungen – je Story-Erzeugung ein Anbieter. Iteriert über
            STORY_GENERATIONS und TEXT_PROVIDERS: eine weitere Erzeugung oder ein
            weiteres Modell zieht hier automatisch mit. Ausgegraut, solange der
            Schalter oben aus ist.
          */}
          <div
            className={`flex flex-col gap-3 border-t border-black/5 pt-4 dark:border-white/5 ${
              settings.useModelOverrides ? "" : "opacity-50"
            }`}
          >
            {STORY_GENERATIONS.map((g) => (
              <label
                key={g.value}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span className="text-sm font-medium">{g.label}</span>
                <select
                  value={settings.storyModels[g.value]}
                  onChange={(e) =>
                    chooseStoryModel(g.value, e.target.value as TextProvider)
                  }
                  disabled={saving || !settings.useModelOverrides}
                  className="rounded-md border border-black/15 bg-white px-2 py-1 text-sm outline-none transition focus:border-black/40 disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:focus:border-white/40"
                >
                  {TEXT_PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <p className="text-xs text-foreground/50">
            {saving
              ? "Speichere …"
              : saved
                ? "Gespeichert."
                : "Änderungen werden sofort gespeichert."}
          </p>
        </section>
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
  // Ob die großen Bild-Originale mitexportiert werden. Die Thumbnails sind immer
  // dabei. Default an – die Vollsicherung ist der übliche Fall.
  const [includeOriginals, setIncludeOriginals] = useState(true);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const { blob, filename } = await exportDatabase(includeOriginals);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage(
        `Sicherung heruntergeladen (${(blob.size / 1024 / 1024).toFixed(1)} MB` +
          `${includeOriginals ? "" : ", ohne Bild-Originale"}).`,
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
          "ACHTUNG: Alle aktuellen Charaktere, Szenarien und Einstellungen werden " +
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
          `${r.scenarios} Szenarien, ${r.settings} Einstellungen. ` +
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
          Die gesamte Datenbank – Charaktere samt Bildern, Szenarien und
          Einstellungen – als Datei sichern oder wieder einspielen. Ohne die
          Bild-Originale wird die Datei deutlich kleiner; die Vorschaubilder
          bleiben erhalten, nur Vollbild, PDF und Bild-Export zeigen die
          betroffenen Bilder dann nicht mehr.
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
          className="flex cursor-pointer items-center gap-2 text-sm text-foreground/70 select-none"
          title="Die großen Bild-Originale mitsichern. Die kleinen Vorschaubilder (Thumbnails) sind immer dabei."
        >
          <input
            type="checkbox"
            checked={includeOriginals}
            onChange={(e) => setIncludeOriginals(e.target.checked)}
            disabled={exporting || importing}
            className="h-4 w-4 accent-current"
          />
          Bild-Originale mitexportieren
        </label>

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
