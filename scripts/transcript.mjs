#!/usr/bin/env node
/**
 * Wandelt den Sitzungs-Mitschnitt von Claude Code (JSONL) in lesbares Markdown.
 *
 *   node scripts/transcript.mjs <sitzung.jsonl> [ziel.md] [--thinking] [--tools]
 *
 * Der Mitschnitt liegt unter
 * ~/.claude/projects/<projekt-slug>/<sitzungs-id>.jsonl
 *
 * Warum ein eigenes Skript: die JSONL-Datei ist überwiegend Werkzeug-Verkehr
 * und enthält base64-kodierte Bilder – roh ist sie zweistellig megabytegroß und
 * unlesbar. Hier bleiben standardmäßig nur die Gesprächsbeiträge übrig;
 * Gedankengänge und Werkzeugaufrufe kommen nur auf Wunsch dazu.
 *
 * **Wichtig – die Datei ist kein Protokoll, sondern ein Journal.** Wird eine
 * Sitzung fortgesetzt oder verdichtet (`/compact`), schreibt Claude Code die
 * bisherige Historie erneut hinein. Gemessen an einer echten Sitzung: 10.168
 * Einträge bei nur 2.422 verschiedenen `uuid`s, jede Nachricht also im Schnitt
 * viermal. Ohne Deduplizierung über `uuid` steht das halbe Gespräch mehrfach im
 * Ergebnis. Nebengespräche von Subagenten (`isSidechain`) und Systemeinschübe
 * (`isMeta`) fliegen aus demselben Grund raus: sie sind nicht das Gespräch.
 */

import { createReadStream, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const [quelle, ziel = "transcript.md"] = args.filter((a) => !a.startsWith("--"));

if (!quelle) {
  console.error("Aufruf: node scripts/transcript.mjs <sitzung.jsonl> [ziel.md] [--thinking] [--tools]");
  process.exit(1);
}

const mitThinking = flags.has("--thinking");
const mitTools = flags.has("--tools");

/** Base64-Blöcke (Bilder) zusammenstreichen – sie machen den Großteil der Datei aus. */
function kuerzen(text) {
  return String(text)
    .replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g, "«Bild (base64, gekürzt)»")
    .replace(/[A-Za-z0-9+/]{500,}={0,2}/g, "«base64, gekürzt»");
}

/**
 * Die Oberfläche schiebt einiges in die Nachrichten, das niemand getippt hat:
 * Systemhinweise, die gerade offene Datei, markierten Editor-Text und die
 * Marker lokaler Slash-Befehle. Im Protokoll stünde das als Beitrag des
 * Nutzers – irreführend, deshalb raus.
 */
const EINSCHUEBE = [
  /<system-reminder>[\s\S]*?<\/system-reminder>/g,
  /<ide_opened_file>[\s\S]*?<\/ide_opened_file>/g,
  /<ide_selection>[\s\S]*?<\/ide_selection>/g,
  /<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g,
  /<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g,
  /<command-(name|message|args)>[\s\S]*?<\/command-\1>/g,
];

function ohneEinschuebe(text) {
  let t = text;
  for (const re of EINSCHUEBE) t = t.replace(re, "");
  return t.trim();
}

function textAus(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

const zeilen = [];
let letzteRolle = null;
let nummer = 0;
let gelesen = 0;
const gesehen = new Set();

const rl = createInterface({ input: createReadStream(quelle) });
for await (const line of rl) {
  if (!line.trim()) continue;
  let o;
  try {
    o = JSON.parse(line);
  } catch {
    continue;
  }
  const rolle = o.message?.role;
  if (rolle !== "user" && rolle !== "assistant") continue;
  gelesen++;

  // Dieselbe Nachricht steht mehrfach in der Datei – s. Kopfkommentar.
  if (gesehen.has(o.uuid)) continue;
  gesehen.add(o.uuid);

  // Subagenten-Nebengespräche und Systemeinschübe sind nicht das Gespräch.
  if (o.isSidechain || o.isMeta) continue;

  const content = o.message.content;

  // Werkzeug-Ergebnisse sind Maschinen-Verkehr, keine Gesprächsbeiträge.
  const nurToolResult =
    Array.isArray(content) && content.length > 0 && content.every((c) => c.type === "tool_result");
  if (nurToolResult) continue;

  if (rolle === "assistant") {
    if (mitThinking && Array.isArray(content)) {
      for (const c of content) {
        if (c.type === "thinking" && c.thinking?.trim()) {
          zeilen.push("> **Gedankengang**\n>\n> " + c.thinking.trim().replace(/\n/g, "\n> ") + "\n");
        }
      }
    }
    if (mitTools && Array.isArray(content)) {
      for (const c of content) {
        if (c.type === "tool_use") {
          const kurz = kuerzen(JSON.stringify(c.input)).slice(0, 300);
          zeilen.push("`→ " + c.name + "` " + kurz + "\n");
        }
      }
    }
  }

  const text = ohneEinschuebe(kuerzen(textAus(content)));
  if (!text) continue;

  if (rolle !== letzteRolle) {
    if (rolle === "user") nummer++;
    zeilen.push(`\n## ${rolle === "user" ? `${nummer}. Daniel` : "Claude"}\n`);
    letzteRolle = rolle;
  }
  zeilen.push(text + "\n");
}

const kopf = [
  "# Gesprächsprotokoll",
  "",
  `Quelle: \`${quelle}\``,
  `Erzeugt: ${new Date().toISOString().slice(0, 10)}`,
  `Enthalten: Gesprächsbeiträge${mitThinking ? " + Gedankengänge" : ""}${mitTools ? " + Werkzeugaufrufe" : ""}`,
  "",
].join("\n");

writeFileSync(ziel, kopf + zeilen.join("\n"));
console.log(
  `${ziel} geschrieben – ${nummer} Gesprächsrunden ` +
    `(${gelesen} Einträge gelesen, ${gesehen.size} verschieden).`,
);
