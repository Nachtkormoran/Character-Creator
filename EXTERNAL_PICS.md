# Plan: Original-Bilder aus der DB auslagern (Thumbnails bleiben drin)

Gegenstück zu den übrigen Plandokumenten (`VERCEL+SUPABASE.md`,
`HOSTINGER_VPS.md`, `HTML_CSS_JS.md`). Hier geht es darum, die **großen
Bild-Originale** aus SQLite auf ein externes Speicherziel (zunächst das
Dateisystem) auszulagern und nur die **kleinen, häufig gebrauchten Thumbnails**
in der Datenbank zu belassen.

---

## Ziel & Prinzip

Die großen **Originale** (`imageData`, ~2 MB Base64 je Bild) wandern aus SQLite
auf **das Dateisystem**. Die kleinen **Thumbnails** (~40 KB) bleiben in der DB –
das ist der häufige Pfad (Karten, Listen, Detail-Vorschau). Originale braucht man
selten: Vollbild, Bild-Export, PDF, Referenzbild – und die laufen alle über die
eine GET-Route.

Der Umbau ist gut lokalisiert: Originale werden an **genau einer** Stelle gelesen
(`GET .../images/[imageId]`) und an wenigen geschrieben (`addImage`/POST/Import).

## Ist-Zustand

- `CharacterImage` / `ScenarioImage`: `imageData` (Original, Base64),
  `thumbnail` (Base64 WebP, optional), `isPrimary`.
- Alle Listen lassen `imageData` weg (`omit`); das Original kommt **nur** über
  `GET .../images/[imageId]`
  (`app/api/characters/[id]/images/[imageId]/route.ts` und Szenario-Zwilling).
- Schreiben: `addImage()` / `addScenarioImage()` (`lib/characterImages.ts` /
  `lib/scenarioImages.ts`), `POST /api/characters` (Erstbild), die beiden
  Import-Routen.
- Backup: `VACUUM INTO` → **eine** DB-Datei enthält heute alles (`lib/backup.ts`).

## Soll-Zustand

- Original als **Datei** auf der Platte (dekodierte Bytes, **kein** Base64 mehr →
  spart schon 33 %), auffindbar über die Bild-Id.
- DB-Zeile: `thumbnail` bleibt; `imageData` wird durch einen **Verweis**
  (`storageKey`) ersetzt.
- Ein `StorageProvider`-Interface kapselt „wo die Bytes liegen": **Dateisystem
  jetzt**, Cloud (S3/Supabase/Blob) später ohne Änderung an den Aufrufern. Das
  ist exakt dieselbe Naht wie „Phase 3 — Storage-Abstraktion" in
  `VERCEL+SUPABASE.md`; dieser Plan ist die **lokal/VPS-Variante** davon.

> Wichtig fürs Verständnis: Auf einem VPS/lokal ist das Dateisystem persistent →
> perfekt. Auf **Vercel** ginge es nicht (flüchtiges FS) – dort greift dieselbe
> Provider-Schnittstelle mit einer Cloud-Implementierung.

---

## Baustein 1 — Der StorageProvider

Neues Modul `lib/imageStore.ts`:
```
interface ImageStore {
  put(key, bytes, mime): Promise<void>   // schreibt die Bytes
  get(key): Promise<{ bytes, mime }>     // liest sie zurück
  delete(key): Promise<void>
  has(key): Promise<boolean>
  list(): Promise<string[]>              // für GC
}
```
- **FilesystemStore:** schreibt nach `<IMAGE_DIR>/<key>`, Key z. B.
  `char/<imageId>.png` bzw. `scenario/<imageId>.png`. `IMAGE_DIR` aus Env
  (Default `./data/images`), auf dem VPS ein persistentes Datenverzeichnis
  (s. `HOSTINGER_VPS.md`).
- Die Datei-Endung trägt den Typ → korrekter `Content-Type` beim Ausliefern,
  ohne zweite Spalte.

## Baustein 2 — Datenmodell (Prisma), **zweistufig und rückwärtssicher**

Nie in einem Schritt die einzige Kopie der Bilder aus der DB löschen (Memo:
„Vor dem Löschen sichern").

1. **Migration A:** `storageKey String?` (nullable) hinzufügen, `imageData`
   **bleibt** vorerst.
2. **Backfill** (Baustein 6) füllt `storageKey` und leert `imageData`.
3. **Migration B** (erst nach erfolgreichem Backfill): `imageData` droppen,
   `storageKey` auf `NOT NULL`.

## Baustein 3 — Schreiben umstellen

- `addImage()` / `addScenarioImage()`: statt `imageData` in die Zeile →
  `store.put(key, bytes, mime)`, dann `storageKey` in die Zeile. **Reihenfolge:**
  erst Datei schreiben, dann die DB-Transaktion; scheitert die DB, Datei wieder
  löschen (Kompensation).
- `POST /api/characters` (Erstbild) und `POST .../images` rufen `addImage` – der
  **Client-Vertrag bleibt gleich** (schickt weiter die Base64-Data-URL), die
  Route dekodiert und lagert aus.
- **Import-Routen** (die Charakter + alle Bilder in **einer** Prisma-Transaktion
  anlegen): Das FS ist nicht Teil der DB-Transaktion. Strategie: erst alle
  Dateien schreiben, dann die DB-Transaktion; schlägt sie fehl, die geschriebenen
  Dateien löschen. Waisen sind harmlos und per GC entfernbar.

## Baustein 4 — Lesen umstellen (mit Übergangs-Fallback)

- `GET .../images/[imageId]`: liest `storageKey` → `store.get(key)`.
  **Fallback:** ist `storageKey` leer (noch nicht migriertes Alt-Bild), das alte
  `imageData` aus der Zeile verwenden. Dieser Fallback erlaubt, Baustein 3–4
  **vor** dem Backfill auszuliefern – neue Bilder von Platte, alte weiter aus der
  Spalte. Kein Big-Bang.
- **Client-Vertrag unverändert:** Die Route packt die Bytes wieder in eine
  `data:`-URL und liefert wie bisher `{ imageData }`. So bleiben alle Aufrufer
  (`getImage`, Vollbild, PDF, Export, Referenzbild) unberührt.
  - *(Optionaler späterer Schritt: binär statt Data-URL ausliefern und Anzeige/
    Export auf Blobs umstellen → entfernt Base64 ganz. Berührt mehr Aufrufer,
    deshalb nicht im ersten Wurf.)*
- **Löschen** (`deleteImage`): nach der DB-Transaktion `store.delete(key)`
  (best effort).
- `setPrimaryImage`: unberührt (rührt kein Original an).

## Baustein 5 — Backup (der kritische Punkt)

Nach dem Auslagern enthält die DB **keine Originale mehr** – ein reines
DB-Backup wäre unvollständig.
- `exportDatabase` bündelt jetzt **DB-Snapshot (VACUUM INTO) + Bild-Verzeichnis**
  zu **einem** Archiv (tar/zip). Bewusst ein Archiv, nicht zwei Knöpfe – der
  häufigste Fehler wäre „DB gesichert, Bilder vergessen".
- `importDatabase` spielt beides zurück.
- **Alt-Backups bleiben lesbar:** Erkennt der Import Zeilen mit `imageData`
  (Sicherung von vor der Auslagerung), lagert er sie **beim Einspielen** aus
  (Datei schreiben, `storageKey` setzen). Der Import kann also beides.

## Baustein 6 — Backfill-Skript (einmalig)

`scripts/offload-images.ts` (via `tsx`), **idempotent**:
- Vorher ein Voll-Backup ziehen.
- Über alle `CharacterImage`/`ScenarioImage`: `imageData` → dekodieren →
  `store.put` → `storageKey` setzen → `imageData` leeren. Überspringt Zeilen,
  die schon `storageKey` haben.
- Danach Migration B.

## Baustein 7 — GC / Reparatur

Kleines Wartungsskript: Dateien ohne DB-Zeile → löschen; DB-Zeilen ohne Datei →
melden. Weil DB und FS nicht gemeinsam atomar sind, minimiert die Kompensation
Waisen, und GC räumt den Rest.

---

## Nutzen

- DB schrumpft von **~2 MB → ~40 KB pro Bild**: schnelleres `VACUUM`/DB-Backup,
  weniger RAM beim Laden, schlanke `dev.db`.
- Klarer, getesteter Austauschpunkt für Cloud-Storage später (identische Naht wie
  im Vercel-Plan).

## Optionaler Zusatzgewinn

Beim Auslagern Originale **PNG → JPEG/WebP** konvertieren (senkt Dateigröße
3–10×). Verlustbehaftet, für Portraits meist unkritisch – als separater, bewusst
wählbarer Schritt im Backfill.

## Risiken / offene Punkte

- **Transaktionsgrenze DB ↔ FS** (Waisen) – durch Kompensation + GC beherrschbar,
  aber nicht null.
- **Zweiteiliges Backup** – deshalb ein einziges Archiv statt zweier getrennter
  Wege.
- **Alt-Backups/-Exportdateien** müssen lesbar bleiben – der Import lagert beim
  Einspielen aus.
- **Deployment:** `IMAGE_DIR` muss persistent **und** mitgesichert sein
  (VPS-Backup-Cron um das Verzeichnis erweitern).

## Reihenfolge (kürzester sicherer Weg)

1. `StorageProvider` + `FilesystemStore`, Env `IMAGE_DIR`.
2. Migration A (`storageKey` nullable).
3. Schreiben umstellen → neue Bilder gehen ab jetzt auf Platte.
4. Lesen umstellen mit `imageData`-Fallback → alte Bilder laufen weiter.
5. Backfill (mit Voll-Backup davor) → dann Migration B (`imageData` droppen).
6. Backup zu einem Archiv umbauen (Import beidseitig).
7. GC-/Reparatur-Skript.

Die Schritte 3–4 sind dank Fallback **gefahrlos vor** dem Backfill ausrollbar –
kein Stichtag, keine große Umschaltung.
