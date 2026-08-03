"use client";

import { useEffect, useState } from "react";
import {
  exportDatabase,
  getSettings,
  importDatabase,
  updateSettings,
  type ImportMode,
} from "@/lib/client";
import {
  GEMINI_TEXT_MODELS,
  IMAGE_MODELS,
  IMAGE_PRICES_AS_OF,
  IMAGE_PRICES_USD,
  IMAGE_QUALITIES,
  isKnownGeminiModel,
  isKnownImageModel,
  STORY_GENERATIONS,
  TEXT_PROVIDERS,
  type GeminiTextModel,
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

  async function chooseGeminiTextModel(geminiTextModel: GeminiTextModel) {
    const previous = settings;
    setSettings((s) => (s ? { ...s, geminiTextModel } : s)); // optimistisch
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setSettings(await updateSettings({ geminiTextModel }));
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
        <p className="mt-2 text-muted-foreground">
          Gelten für alle künftigen Generierungen. Bereits gespeicherte
          Charaktere bleiben unverändert.
        </p>
      </div>

      {loading && <p className="text-muted-foreground">Lade Einstellungen …</p>}

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && settings && (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
          <div>
            <h2 className="font-medium">Textmodell</h2>
            <p className="text-sm text-muted-foreground">
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
                      ? "border-primary/40 bg-primary/10"
                      : "border-border hover:border-border"
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
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          Standard
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{p.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {/*
            Gemini-Modell: greift nur, wenn oben (oder je Story-Erzeugung)
            Gemini läuft. Der Sinn ist das Free-Tier-Kontingent – Flash Lite hat
            ein großes Tageskontingent, das Voll-Flash ist stärker, aber knapp.
          */}
          <div className="mt-1 flex flex-col gap-2 border-t border-border pt-4">
            <label htmlFor="gemini-model" className="text-sm font-medium">
              Gemini-Modell
            </label>
            <p className="text-xs text-muted-foreground">
              Welches Gemini-Modell läuft, wenn oben (oder je Story-Erzeugung)
              Gemini gewählt ist. Daran hängt das kostenlose Tageskontingent.
            </p>
            <select
              id="gemini-model"
              value={settings.geminiTextModel}
              onChange={(e) =>
                chooseGeminiTextModel(e.target.value as GeminiTextModel)
              }
              disabled={saving}
              className="self-start rounded-md border border-border bg-transparent px-2 py-1.5 text-sm disabled:opacity-50"
            >
              {!isKnownGeminiModel(settings.geminiTextModel) && (
                <option value={settings.geminiTextModel}>
                  {settings.geminiTextModel} (aus Env)
                </option>
              )}
              {GEMINI_TEXT_MODELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {
                GEMINI_TEXT_MODELS.find(
                  (m) => m.value === settings.geminiTextModel,
                )?.hint
              }
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
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
          <label className="mt-1 flex cursor-pointer items-start gap-3 border-t border-border pt-4">
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
              <span className="text-xs text-muted-foreground">
                Zeigt bei Handlungsentwurf, Story Arc, Kapitel-Ableitung und
                Kapitel-Prosa an, mit welchem Textmodell sie erzeugt wurden.
                Reine Anzeige – Standard aus.
              </span>
            </span>
          </label>
        </section>
      )}

      {!loading && settings && (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
          <div>
            <h2 className="font-medium">Modell je Story-Erzeugung</h2>
            <p className="text-sm text-muted-foreground">
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
              <span className="text-xs text-muted-foreground">
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
            className={`flex flex-col gap-3 border-t border-border pt-4 ${
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
                  className="rounded-md border border-border bg-card px-2 py-1 text-sm outline-none transition focus:border-primary/50 disabled:opacity-60"
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

          <p className="text-xs text-muted-foreground">
            {saving
              ? "Speichere …"
              : saved
                ? "Gespeichert."
                : "Änderungen werden sofort gespeichert."}
          </p>
        </section>
      )}

      {!loading && settings && (
        <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
          <div>
            <h2 className="font-medium">Bildmodell und Qualität</h2>
            <p className="text-sm text-muted-foreground">
              Wähle die Kombination aus Modell und Qualitätsstufe. Beides
              verändert das Bildergebnis – die Preise sind ungefähre Kosten pro
              Portrait bei 1024×1024.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-border px-2 py-2 text-left font-medium">
                    Modell
                  </th>
                  {IMAGE_QUALITIES.map((q) => (
                    <th
                      key={q.value}
                      className="border-b border-border px-2 py-2 text-center font-medium"
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
                      className="border-b border-border px-2 py-3 text-left font-normal"
                    >
                      <span className="font-mono text-sm">{m.label}</span>
                      {m.value === "gpt-image-1" && (
                        <span className="ml-2 text-xs text-muted-foreground">
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
                          className="border-b border-border px-1 py-2 text-center"
                        >
                          <label
                            className={`flex cursor-pointer flex-col items-center gap-1 rounded-md border p-2 transition ${
                              active
                                ? "border-primary/40 bg-primary/10"
                                : "border-transparent hover:border-border"
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
                            <span className="tabular-nums text-xs text-muted-foreground">
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

          <p className="text-xs text-muted-foreground">
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

          <p className="text-xs text-muted-foreground">
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
  // Wie eine Sicherung eingespielt wird. Default „replace" (ersetzen) – der
  // sichere, gewohnte Fall; „additive" hängt die Datei-Inhalte an.
  const [importMode, setImportMode] = useState<ImportMode>("replace");

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

    // Rückfrage – beim Ersetzen ist sie Pflicht (Datenverlust), aber auch
    // additiv soll man wissen, was passiert. Der Text hängt am Modus.
    const frage =
      importMode === "additive"
        ? `„${file.name}" additiv einspielen?\n\n` +
          "Die Charaktere und Szenarien aus der Datei werden ZUSÄTZLICH " +
          "angelegt (mit neuen IDs). Dein aktueller Bestand und deine " +
          "Einstellungen bleiben unverändert.\n\n" +
          "Vorher wird automatisch eine Sicherheitskopie abgelegt."
        : `„${file.name}" einspielen?\n\n` +
          "ACHTUNG: Alle aktuellen Charaktere, Szenarien und Einstellungen werden " +
          "dabei gelöscht und durch den Inhalt der Datei ersetzt.\n\n" +
          "Vorher wird automatisch eine Sicherheitskopie des jetzigen Standes " +
          "neben der Datenbank abgelegt.";
    if (!confirm(frage)) return;

    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const r = await importDatabase(file, importMode);
      const verb = importMode === "additive" ? "Hinzugefügt" : "Eingespielt";
      setMessage(
        `${verb}: ${r.characters} Charaktere, ${r.images} Bilder, ` +
          `${r.scenarios} Szenarien` +
          (importMode === "additive"
            ? ""
            : `, ${r.settings} Einstellungen`) +
          `. Sicherheitskopie: ${r.safetyCopy}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import fehlgeschlagen.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div>
        <h2 className="font-medium">Sicherung</h2>
        <p className="text-sm text-muted-foreground">
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
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {exporting ? "Erstelle Sicherung …" : "Datenbank exportieren"}
        </button>

        <label
          className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none"
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

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Import-Modus
          <select
            value={importMode}
            onChange={(e) => setImportMode(e.target.value as ImportMode)}
            disabled={importing || exporting}
            title="Ersetzen leert den Bestand und spielt die Datei ein. Additiv hängt die Charaktere und Szenarien der Datei zusätzlich an (mit neuen IDs)."
            className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm disabled:opacity-50"
          >
            <option value="replace">Ersetzen</option>
            <option value="additive">Additiv (hinzufügen)</option>
          </select>
        </label>

        <label
          className={`rounded-md border border-border px-4 py-2 text-sm font-medium transition ${
            importing || exporting
              ? "cursor-not-allowed opacity-50"
              : "cursor-pointer hover:bg-muted"
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
        {importMode === "additive" ? (
          <>
            <strong>Additiver Import:</strong> Charaktere und Szenarien der Datei
            werden <strong>zusätzlich</strong> angelegt (neue IDs); Bestand und
            Einstellungen bleiben. Vorher wird eine Sicherheitskopie abgelegt.
          </>
        ) : (
          <>
            Der Import <strong>ersetzt den gesamten Bestand</strong>. Vorher wird
            automatisch eine Sicherheitskopie des aktuellen Standes neben der
            Datenbank abgelegt.
          </>
        )}
      </p>

      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
