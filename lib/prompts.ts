import {
  DEFAULT_STORY_HOOK_ANCHOR,
  MAX_NEUE_PLOT_PERSONEN,
  TRAIT_LABELS,
  formHint,
  kapitelLaengeHint,
  toneHint,
  werkformStil,
} from "./schema";
import { DEFAULT_GENRE, GENRE_TEMPLATES, genreLabel } from "./templates";
import type { ScenarioSamples } from "./scenarioSamples";
import type {
  CharacterInput,
  CharacterTraits,
  GeneratedCharacter,
  ScenarioDetails,
  StoryHookAnchor,
} from "./schema";

/** Hilfsfunktion: nur ausgefüllte Vorgaben in den Prompt aufnehmen. */
function line(label: string, value?: string): string {
  const v = (value || "").trim();
  return v ? `- ${label}: ${v}\n` : "";
}

/**
 * Der **Ton-Block** für Handlungsentwurf, Story Arc und Kapitel – an einer
 * Stelle, damit derselbe Ton überall gleich formuliert ist. Leer bei `neutral`
 * (oder unbekannt): dann bleibt der Prompt wie bisher. Der Ton beschreibt, *wie*
 * geschrieben wird, und ist der Sache – Zerlegung, Figurenbindung – nicht
 * übergeordnet: Er ändert die Sprache, nicht den Inhalt.
 */
function tonHinweis(ton?: string): string {
  const hint = toneHint(ton ?? "");
  return hint
    ? `\nTon und Sprache (er nimmt den Ton der späteren Geschichte vorweg): ${hint}\n`
    : "";
}

/**
 * Erzählform-Block für die Erzeugungs-Prompts (Handlungsentwurf, Story Arc,
 * Kapitel). Leer bei `allround`/unbekannt – dann bleibt der Prompt wie zuvor.
 * Anders als der Ton (der die Sprache prägt) steuert die Erzählform **Konflikt,
 * Aufbau und Schwerpunkt** – deshalb ein eigener, deutlich benannter Block und
 * nicht in die Ton-Zeile gemischt.
 */
function formHinweis(form?: string): string {
  const hint = formHint(form ?? "");
  return hint
    ? `\nErzählform – die Art dieser Geschichte (sie prägt Konflikt, Aufbau und Schwerpunkt, nicht die Welt): ${hint}\n`
    : "";
}

/**
 * Baut den Prompt für die Textgenerierung. Das Modell soll strukturiertes
 * JSON zurückgeben (via Structured Outputs), daher beschreibt der Prompt nur
 * Inhalt und Ton – nicht das Format.
 */
export function buildTextPrompt(
  input: CharacterInput,
  /**
   * Zufälliger Anfangsbuchstabe für den Vornamen – **nur** wirksam, wenn kein
   * Wunschname vorgegeben ist (sonst gilt der). Dekorreliert identische
   * Vorgaben und wirkt der Gleichförmigkeit der Namen entgegen; wie bei
   * `buildNamePrompt` in der Route gezogen, damit der Baukasten deterministisch
   * bleibt.
   */
  initial?: string,
): string {
  const wunschname = (input.name || "").trim();
  /**
   * Ein einzelnes Wort verstehen wir als Vornamen, der um einen passenden
   * Nachnamen ergänzt wird; ab zwei Wörtern gilt der Name als vollständig und
   * wird unverändert übernommen. „Anna-Maria" zählt dabei als ein Wort – ein
   * Doppelvorname ist immer noch ein Vorname.
   */
  const nurVorname = wunschname !== "" && !/\s/.test(wunschname);

  const vorgaben =
    line(nurVorname ? "Vorname" : "Name", wunschname) +
    line("Geschlecht", input.gender === "egal" ? "" : input.gender) +
    line("Alter", input.age) +
    line("Herkunft/Ethnie", input.ethnicity) +
    line("Aussehen", input.appearance) +
    line("Setting/Genre", input.setting) +
    line("Beruf/Rolle", input.occupation) +
    line("Hintergrund", input.background) +
    line("Persönlichkeit", input.personality) +
    line("Weitere Wünsche", input.notes);

  // Die Namens-Anforderung ersetzt die freie Namenswahl, sobald etwas
  // vorgegeben ist – sonst stünden beide widersprüchlich nebeneinander.
  const nameAnforderung = !wunschname
    ? `- Ein vollständiger, zum Setting passender Name – authentisch zur Herkunft, aber **nicht** der naheliegendste Allerweltsname.${
        initial
          ? ` Der Vorname soll möglichst mit „${initial}" beginnen (nur wenn das für die Herkunft unnatürlich wäre, weiche auf einen nahen Buchstaben aus).`
          : ""
      }`
    : nurVorname
      ? `- Der Vorname lautet exakt „${wunschname}". Übernimm ihn unverändert (auch Schreibweise) und ergänze einen dazu passenden Nachnamen, stimmig zu Herkunft und Setting. Das Feld für den Namen enthält beides zusammen.`
      : `- Der Name lautet exakt „${wunschname}". Übernimm ihn unverändert und ergänze nichts.`;

  return `Erstelle einen glaubwürdigen, vielschichtigen menschlichen Charakter, der z. B. in einem Buch oder Spiel verwendet werden kann.

Halte dich an die folgenden Vorgaben. Für alle nicht angegebenen Aspekte triffst du selbst stimmige, kreative und in sich konsistente Entscheidungen.

Vorgaben:
${vorgaben || "- (keine spezifischen Vorgaben – gestalte den Charakter frei)\n"}
Anforderungen an das Ergebnis:
${nameAnforderung}
- Eine kompakte Beschreibung in 2–3 kurzen Absätzen (insgesamt ca. 700–1000 Zeichen) zu Aussehen, Persönlichkeit und Hintergrund. Fasse dich prägnant, keine Ausschweifungen.
- Konkrete, konsistente Körpermerkmale (Größe und Gewicht als realistische Werte mit Einheit).
- Schreibe auf Deutsch, lebendig und plastisch, aber ohne Kitsch.
- Die Merkmale müssen zur Beschreibung passen (keine Widersprüche).`;
}

/**
 * Baut den Prompt, mit dem der **Beschreibungstext** eines bereits
 * gespeicherten Charakters neu erzeugt wird.
 *
 * Anders als `buildTextPrompt` entsteht hier kein neuer Charakter, sondern nur
 * ein neuer Text zu einem bestehenden. Deshalb sind Name und Merkmale
 * **Vorgabe, nicht Ergebnis**: die Merkmalstabelle bleibt unangetastet, und ein
 * Text, der ihr widerspricht, wäre schlimmer als der alte. Der Charakter ist
 * schon vergeben – neu geschrieben wird nur, wie über ihn erzählt wird.
 *
 * `zusatz` ist das freie Feld aus der Oberfläche (Stilwunsch, Perspektive,
 * Schwerpunkt). Es steht bewusst **am Ende und als das Wichtigste**: wer es
 * ausfüllt, will genau daran etwas ändern, sonst hätte er einfach nochmal auf
 * denselben Knopf gedrückt.
 */
export function buildRegenerateTextPrompt(
  input: CharacterInput,
  character: GeneratedCharacter,
  zusatz?: string,
): string {
  const m = character.merkmale;

  const vorgaben =
    line("Setting/Genre", input.setting) +
    line("Herkunft/Ethnie", input.ethnicity) +
    line("Hintergrund", input.background) +
    line("Aussehen", input.appearance) +
    line("Persönlichkeit", input.personality) +
    line("Weitere Wünsche", input.notes);

  const merkmale =
    line("Name", character.name) +
    line("Alter", String(m.alter)) +
    line("Geschlecht", m.geschlecht) +
    line("Größe/Körperbau", [m.groesse, m.koerperbau].filter(Boolean).join(", ")) +
    line("Haare", [m.haarfarbe, m.frisur].filter(Boolean).join(", ")) +
    line("Augen", m.augenfarbe) +
    line("Hautton", m.hautton) +
    line("Herkunft", m.herkunft) +
    line("Wohnort", m.wohnort) +
    line("Beruf", m.beruf) +
    line("Besondere Merkmale", m.besondereMerkmale) +
    line("Persönlichkeit", m.persoenlichkeit) +
    line("Interessen", m.interessen);

  const zusatzBlock = zusatz?.trim()
    ? `\nBesonders wichtig – zusätzliche Wünsche für diesen Text (Stil, Perspektive, Schwerpunkt). Sie haben Vorrang vor den allgemeinen Anforderungen oben, solange sie den feststehenden Merkmalen nicht widersprechen:\n${zusatz.trim()}\n`
    : "";

  return `Schreibe den Beschreibungstext für einen bereits existierenden Charakter neu.

Diese Merkmale stehen fest und dürfen sich nicht ändern. Der Text muss zu ihnen passen:
${merkmale}
Ursprüngliche Vorgaben zum Charakter (Kontext, keine Pflicht):
${vorgaben || "- (keine)\n"}
Anforderungen an den neuen Text:
- 2–3 kurze Absätze (insgesamt ca. 700–1000 Zeichen) zu Aussehen, Persönlichkeit und Hintergrund.
- Auf Deutsch, lebendig und plastisch, aber ohne Kitsch.
- Ein wirklich neuer Text, keine Umformulierung Satz für Satz.
${zusatzBlock}
Antworte mit nichts als dem Text selbst – keine Überschrift, keine Anführungszeichen, keine Erklärung.`;
}

/**
 * Baut den Prompt für **einen** Ansatzpunkt einer Geschichte.
 *
 * Grundlage sind Beschreibung **und** Merkmale, weil beide etwas beisteuern,
 * was der andere nicht hat: der Text die Vorgeschichte, die Tabelle die harten
 * Eckdaten (Beruf, Wohnort, Interessen). Die Ansatzpunkte sollen aus dem
 * Charakter kommen, nicht aus einem allgemeinen Vorrat an Plot-Ideen.
 *
 * **Einer je Aufruf, nicht drei.** Die Ansatzpunkte sind eine Liste, aus der
 * einzeln gelöscht wird; wer einen dritten will, klickt ein drittes Mal. Drei
 * auf einmal wären wieder ein Block, der nur ganz zu haben ist – und der
 * häufigste Fall war ohnehin, dass zwei taugen und einer nicht.
 *
 * Ausgabe ist **Freitext**, kein strukturiertes JSON: das Ergebnis ist ein
 * Absatz, der von Hand weitergeschrieben wird. Ein Schema drumherum wäre nur
 * Aufschlag – dieselbe Überlegung wie bei `buildNamePrompt`.
 */
export function buildStoryHooksPrompt(
  character: GeneratedCharacter,
  anchor: StoryHookAnchor = DEFAULT_STORY_HOOK_ANCHOR,
  /**
   * Stichworte zur Richtung – „Verrat, alte Schuld", „eher leise", „es soll um
   * seine Schwester gehen". Freitext und bewusst **kein** weiteres Menü: Was
   * jemand von einem Ansatzpunkt will, lässt sich nicht in eine Liste
   * sperren, und die Stichworte sind je Charakter andere.
   *
   * Steht im Prompt **hinter** der Bindungsstufe und ist ihr ausdrücklich
   * untergeordnet. Sonst hebelte das Feld sie aus: Wer bei `eng` „Verschwörung
   * im Konzern" eingibt, bekäme sonst genau die erfundenen Personen und
   * Ereignisse zurück, die diese Stufe verbietet. Die Stichworte wählen unter
   * dem **zulässigen** Material aus, sie erweitern es nicht.
   */
  richtung?: string,
  /**
   * Die bereits vorhandenen Ansatzpunkte. Gehen **nur** mit, damit der neue
   * ein anderer wird – ohne sie liefert wiederholtes Klicken dieselbe Idee in
   * anderen Worten, und genau das Klicken ist jetzt der Weg zu mehreren.
   *
   * Das ist auch der Grund, warum sie hier stehen dürfen, obwohl der Prompt
   * sonst nur Charaktermaterial enthält: Sie sind kein zusätzliches Material,
   * sondern eine **Ausschlussliste**. Der Prompt sagt das ausdrücklich, sonst
   * schreibt das Modell sie fort statt daneben.
   */
  vorhandene: string[] = [],
): string {
  const m = character.merkmale;

  /**
   * Der eigentliche Hebel. Ohne ihn greift das Modell zu Aufhängern, die an
   * jede Figur passen (ein Zufallsfund, ein anonymer Hinweis, ein altes Buch
   * voller Geheimnisse) – und was überall passt, erzählt nirgends etwas.
   *
   * Bewusst als **Verbot plus Nachweispflicht** formuliert, nicht als Bitte um
   * „mehr Nähe": „bleib nah am Charakter" ist eine Geschmacksangabe, die das
   * Modell mit ein paar Namensnennungen erfüllt zu haben glaubt. „Erfinde keine
   * neuen Personen" ist überprüfbar, auch für den Leser.
   */
  const bindung: Record<StoryHookAnchor, string> = {
    eng: `- Jeder Ansatzpunkt muss auf einer Stelle beruhen, die oben schon steht – in der Beschreibung oder in den Eckdaten. Setze diese Stelle am Ende in Klammern dahinter, in wenigen Worten.
- Erfinde **keine** neuen Personen, Orte, Gegenstände oder Ereignisse. Arbeite ausschließlich mit dem, was der Charakter mitbringt: seiner Vorgeschichte, seiner Arbeit, seinen Beziehungen, seinen Interessen, den Widersprüchen in seinem Wesen.
- Keine Geheimnisse, Verschwörungen, Zufallsfunde oder anonymen Hinweise. Die Spannung entsteht daraus, dass der Charakter ist, wie er ist – nicht daraus, dass ihm etwas zustößt.
- Der Alltag reicht als Schauplatz. Ein ungeklärtes Verhältnis oder eine anstehende Entscheidung ist ein vollwertiger Ansatzpunkt.`,
    mittel: `- Jeder Ansatzpunkt geht von etwas aus, das oben schon steht, und darf **ein** neues Element hinzufügen (eine Person, einen Vorfall, eine Gelegenheit).
- Dieses neue Element muss sich aus dem Vorhandenen ergeben und nicht bloß dazukommen: Es soll den Charakter genau dort treffen, wo er verwundbar oder ehrgeizig ist.
- Keine großen Zufälle. Wenn etwas passiert, dann weil dieser Charakter so lebt, wie er lebt.`,
    frei: `- Der Charakter ist der Ausgangspunkt, die Handlung darf von dort aus weit ausgreifen – neue Personen, Orte und Ereignisse sind erlaubt.
- Auch dann muss erkennbar bleiben, warum es **diese** Figur trifft und keine andere.`,
  };

  const eckdaten =
    line("Alter", String(m.alter)) +
    line("Geschlecht", m.geschlecht) +
    line("Herkunft", m.herkunft) +
    line("Wohnort", m.wohnort) +
    line("Beruf", m.beruf) +
    line("Besondere Merkmale", m.besondereMerkmale) +
    line("Persönlichkeit", m.persoenlichkeit) +
    line("Interessen und Hobbys", m.interessen);

  /**
   * Die vorhandenen Ansatzpunkte als Ausschlussliste. Ungekürzt: Wovon sich
   * der neue unterscheiden soll, muss vollständig dastehen – aus einer
   * Überschrift allein ist nicht ersichtlich, welche Stelle des Charakters
   * schon vergeben ist.
   */
  const bekannt = vorhandene.map((h) => h.trim()).filter(Boolean);
  const bekanntBlock = bekannt.length
    ? `
Diese Ansatzpunkte gibt es für diesen Charakter bereits:
${bekannt.map((h) => `- ${h}`).join("\n")}

- Sie sind **keine Vorlage**, sondern eine Ausschlussliste: Schreibe sie nicht fort und liefere keine Abwandlung davon.
- Der neue Ansatzpunkt muss an einer **anderen** Stelle des Charakters ansetzen und in eine andere Richtung führen. Ist das Naheliegende vergeben, nimm das Zweitnaheliegende.
`
    : "";

  return `Leite aus diesem Charakter **einen** Ansatzpunkt für eine interessante Geschichte ab.

Name: ${character.name}
${character.kurzbeschreibung ? `\nKurz: ${character.kurzbeschreibung}\n` : ""}
Eckdaten:
${eckdaten || "- (keine)\n"}
Beschreibung:
${character.beschreibung}

Bindung an den Charakter – das ist die wichtigste Anforderung:
${bindung[anchor]}
${
  richtung?.trim()
    ? `
Gewünschte Richtung: ${richtung.trim()}
- Richte den Ansatzpunkt daran aus, so weit der Charakter das hergibt.
- Es sind Stichworte, keine Handlungsvorgabe. Erzähle nicht die genannte Geschichte nach, sondern finde im Charakter die Stellen, an denen sie ansetzen könnte.
- **Die Bindung oben schlägt diese Stichworte.** Verlangt ein Stichwort etwas, das die Bindung ausschließt, dann befolge die Bindung und **lass das Stichwort in diesem Punkt fallen**. Es ist ausdrücklich richtig, ein Stichwort nur teilweise oder gar nicht zu bedienen; es ist falsch, dafür die Bindung zu brechen.
- Übersetze das Stichwort in diesem Fall in seinen **Kern** und suche den im Charakter: „Verrat" ist auch ein gebrochenes Versprechen unter Freunden, „Verschwörung" auch ein Schweigen, an dem sich jemand beteiligt. Erfinde keine Organisationen, Vorfälle oder Personen, nur damit das Stichwort wörtlich vorkommt.
- Sei direkt und konkret.
`
    : ""
}${bekanntBlock}
Weitere Anforderungen:
- Genau **ein** Ansatzpunkt, zwei bis drei Sätze.
- Er beginnt mit einer knappen Überschrift von wenigen Worten, danach ein Doppelpunkt und der Text.
- **Keine Nummer davor.** Der Ansatzpunkt steht in einer Liste, deren Reihenfolge sich ändert.
- Reiner Fließtext ohne Markdown: keine Sternchen, keine Rauten, keine Fettschrift.
- Kein Absatzumbruch – ein zusammenhängender Block.
- Ein Ansatzpunkt ist eine offene Ausgangslage mit einer Spannung, kein fertiges Handlungsgerüst und kein Ende.
- Auf Deutsch, nüchtern und konkret.

Antworte mit nichts als dem Ansatzpunkt.`;
}

/**
 * Baut den Prompt für die Beschreibung eines **Szenarios**.
 *
 * Grundlage sind die übrigen Festlegungen – Ort, Zeit, Genre, Regeln. Die
 * Beschreibung ist deren Fließtext-Fassung, nicht eine weitere Quelle: was hier
 * entsteht, darf den Feldern nie widersprechen, sonst stünden in derselben
 * Maske zwei verschiedene Welten.
 *
 * Bewusst **ohne** die Charaktere des Szenarios. Ein Szenario beschreibt, was
 * für alle darin gilt; würde es aus den vorhandenen Figuren geschrieben,
 * beschriebe es den heutigen Bestand statt die Welt – und änderte sich mit
 * jedem neuen Charakter.
 */
export function buildScenarioDescriptionPrompt(
  name: string,
  details: {
    genre?: string;
    ort?: string;
    zeit?: string;
    regeln?: string;
  },
  zusatz?: string,
): string {
  const vorgaben =
    line("Name", name) +
    line("Genre", details.genre) +
    line("Ort", details.ort) +
    line("Zeit", details.zeit) +
    line("Regeln", details.regeln);

  const zusatzBlock = zusatz?.trim()
    ? `\nBesonders wichtig – zusätzliche Wünsche für diesen Text:\n${zusatz.trim()}\n`
    : "";

  return `Schreibe die Beschreibung eines Szenarios – der Welt, in der eine Geschichte spielt und in der mehrere Charaktere leben.

Festlegungen:
${vorgaben || "- (keine – entwirf eine stimmige Welt frei)\n"}
Anforderungen:
- 2–3 kurze Absätze (insgesamt ca. 600–900 Zeichen).
- Beschreibe die Welt, nicht einzelne Personen und keine Handlung: Atmosphäre, Alltag, was diesen Ort zu dieser Zeit ausmacht, woran man ihn erkennt.
- Alles muss zu den Festlegungen oben passen. Erfinde nichts, was ihnen widerspricht; ergänze nur Stimmiges, wo sie schweigen.
- Konkret und sinnlich statt allgemein – ein Geräusch, ein Geruch, eine Gewohnheit sagen mehr als ein Adjektiv.
- Auf Deutsch, nüchtern und ohne Kitsch.
${zusatzBlock}
Antworte mit nichts als dem Text selbst – keine Überschrift, keine Aufzählung, kein Markdown.`;
}

/**
 * Was der Handlungsentwurf von einem Charakter braucht: **alles, was den
 * Menschen ausmacht**.
 *
 * Ursprünglich standen hier nur Kurzbeschreibung und drei Merkmale. Das war zu
 * wenig: Der lange Beschreibungstext enthält die **Vorgeschichte**, und aus
 * Vorgeschichte entsteht Konflikt – die Merkmalstabelle liefert die Eckdaten,
 * an denen sich Figuren konkret reiben (Herkunft, besondere Merkmale,
 * Interessen). Beide gehen jetzt **immer** mit, auch wenn Ansatzpunkte
 * vorhanden sind: die Ansatzpunkte sind eine Destillation des Textes und
 * ersetzen ihn nicht.
 */
export interface PlotCharacter {
  name: string;
  kurzbeschreibung: string;
  /** Der lange Fließtext – die Vorgeschichte. */
  beschreibung: string;
  /** Die vollständige Merkmalstabelle. */
  merkmale: CharacterTraits;
  /** Die Ansatzpunkte der Figur, sofern erzeugt. */
  storyHooks: string;
  /**
   * Protagonist des Szenarios? Nur `buildScenarioPlotPrompt` wertet es aus –
   * und **nur, wenn mindestens eine Figur markiert ist**; sonst bleibt der
   * Prompt unverändert (alle gleichrangig, wie bisher).
   */
  isProtagonist?: boolean;
}

/**
 * Baut den Prompt für den **Handlungsentwurf** eines Szenarios.
 *
 * Das Gegenstück zu `buildScenarioDescriptionPrompt`: Die Beschreibung bekommt
 * die Charaktere bewusst **nicht**, weil sie die Welt beschreiben soll und
 * nicht den heutigen Bestand. Dieser Prompt bekommt sie **ausdrücklich** – er
 * fragt genau danach, wer hier mit wem worüber aneinandergerät. Es ist die
 * einzige Stelle im Projekt, an der mehrere Figuren zugleich betrachtet werden.
 *
 * Die **Ansatzpunkte** der Figuren gehen mit und sind das eigentliche Material.
 * Bisher standen sie unverbunden nebeneinander: drei Ausgangslagen je Person,
 * die einander nie begegneten. Hier treffen sie aufeinander.
 *
 * Der Entwurf darf **keine neuen Hauptfiguren erfinden**. Sonst wäre er ein
 * Vorschlag für eine andere Besetzung, und die vorhandenen Charaktere – der
 * ganze Grund für das Szenario – wären Statisten in ihrer eigenen Geschichte.
 */
export function buildScenarioPlotPrompt(
  name: string,
  details: {
    genre?: string;
    ort?: string;
    zeit?: string;
    regeln?: string;
    beschreibung?: string;
    /**
     * **Wichtige Figuren** (Notizen aus dem Szenario, `details.figuren`) – noch
     * keine ausgearbeiteten Charaktere. Ist das Feld gefüllt, tritt es als
     * zusätzliche Besetzung in den Prompt (oder trägt sie ganz, wenn keine
     * Charaktere zugeordnet sind). **Leer = der Prompt ist zeichengenau der von
     * vorher.**
     */
    figuren?: string;
    /**
     * **Vorgegebene Handlungselemente** (die aktiven Karten aus
     * `details.handlungselemente`, als reiner Text ohne Markup). Ist etwas
     * gesetzt, sollen diese Aspekte im Entwurf vorkommen. **Leer = der Prompt
     * ist zeichengenau der von vorher** – der Aufrufer filtert inaktive/leere
     * heraus, hier wird nur auf „getrimmt nicht leer" geprüft.
     */
    handlungselemente?: string;
  },
  characters: PlotCharacter[],
  zusatz?: string,
  /**
   * Ein **bestehender Handlungsentwurf als Grundlage**. Ist er gesetzt, entsteht
   * keine Handlung aus dem Nichts, sondern eine **eigenständige neue Fassung**
   * des vorhandenen Entwurfs – die Stichwörter (`zusatz`) steuern zusätzlich,
   * wohin sie sich verschiebt. Ohne ihn bleibt es beim Entwurf aus Welt und
   * Figuren wie bisher.
   */
  basis?: string,
  /** **Ton und Sprache** (`STORY_TONES`-Wert). Leer/`neutral` = ohne Ton-Block. */
  ton?: string,
  /**
   * **Handlung weiterspinnen**: Statt einer Ausgangslage mit offenem Ausgang
   * skizziert der Entwurf eine **vollständige Geschichte** – von der
   * Ausgangslage über die Zuspitzung bis zu einem Ende. Gilt unabhängig von
   * `basis`: sowohl beim frischen Entwurf als auch beim Weiterspinnen eines
   * vorhandenen.
   */
  weiterspinnen?: boolean,
  /**
   * **Neue benannte Personen auf Wunsch.** 0 (Default) lässt die harte Regel
   * „keine neuen Hauptfiguren" unangetastet. Bei ≥1 wird sie gezielt gelockert:
   * Der Entwurf führt **genau so viele** neue, benannte Personen ein – die
   * vorhandenen Figuren bleiben tragend, die neuen treten hinzu. Gilt
   * unabhängig von `basis` und `weiterspinnen`. Auf `MAX_NEUE_PLOT_PERSONEN`
   * gedeckelt, damit frische Namen die Handlung nicht zersprengen.
   */
  neuePersonen?: number,
  /**
   * Optionale Vorgaben zu den neuen Personen (Namen/Rollen), z. B. „Mira
   * (Schwester); ein korrupter Beamter". Leer = das Modell erfindet sie stimmig
   * aus Welt und Konflikt. Wirkt nur zusammen mit `neuePersonen ≥ 1`.
   */
  neuePersonenWunsch?: string,
  /**
   * **Erzählform** (`STORY_FORMS`-Wert): Krimi, Liebe, Abenteuer … Leer/`allround`
   * = ohne Erzählform-Block (gemischt wie bisher). Prägt Konflikt und Schwerpunkt
   * des Entwurfs, nicht die Welt.
   */
  form?: string,
  /**
   * **Entwurf fortsetzen** statt neu erzeugen. Ist es gesetzt (und `basis`
   * vorhanden), knüpft der Text unmittelbar an das Ende des bisherigen Entwurfs
   * an und antwortet **nur mit der Fortsetzung** – der Aufrufer hängt sie an den
   * vorhandenen Text an. Bewusst getrennt von `basis` (das den Entwurf zu einer
   * eigenständigen neuen Fassung umformt): hier bleibt der bisherige Text stehen
   * und wächst weiter. `false` (Default) → der Prompt ist zeichengenau der von
   * vorher.
   */
  fortsetzenArg?: boolean,
  /**
   * **Personen einweben**: den bestehenden Entwurf (`basis`) **behutsam**
   * überarbeiten und die Figuren/Charaktere, die darin noch nicht vorkommen,
   * einflechten – Handlung, Aufbau und Ton bleiben. Anders als der gewöhnliche
   * `basis`-Fall (eine „eigenständige neue Fassung") wird hier **erhalten und
   * ergänzt**, nicht neu geworfen. Braucht `basis`, schließt sich mit
   * `fortsetzen` aus.
   */
  einwebenArg?: boolean,
): string {
  const nutzeBasis = !!basis?.trim();
  // Fortsetzen braucht einen vorhandenen Entwurf; ohne Basis fällt es auf das
  // gewöhnliche Verhalten zurück (der Aufrufer sperrt den Knopf zwar schon).
  const fortsetzen = !!fortsetzenArg && nutzeBasis;
  const einweben = !!einwebenArg && nutzeBasis && !fortsetzen;
  const anzahlNeue = Math.max(
    0,
    Math.min(MAX_NEUE_PLOT_PERSONEN, Math.floor(neuePersonen ?? 0)),
  );
  const welt =
    line("Szenario", name) +
    line("Genre", details.genre) +
    line("Ort", details.ort) +
    line("Zeit", details.zeit) +
    line("Regeln", details.regeln);

  const weltText = details.beschreibung?.trim()
    ? `\nBeschreibung der Welt:\n${details.beschreibung.trim()}\n`
    : "";

  /** Rückt einen mehrzeiligen Block ein, damit die Zuordnung zur Figur hält. */
  const einrücken = (text: string, tiefe = "     ") =>
    text
      .split("\n")
      .filter((z) => z.trim())
      .map((z) => tiefe + z.trim())
      .join("\n");

  const figuren = characters
    .map((c, i) => {
      const m = c.merkmale;
      /**
       * Die Merkmale laufen über `TRAIT_LABELS`, nicht als Aufzählung von
       * Hand. Anders als in `buildImagePrompt` ist das hier richtig: ins Bild
       * darf nur, was Aussehen ist (Hobbys gehören nicht hinein), in einen
       * Handlungsentwurf gehört **jedes** Merkmal – ein später ergänztes
       * genauso. Leere Werte bleiben draußen, sonst stünden bei
       * Altbeständen Zeilen ohne Inhalt.
       */
      const merkmale = (
        Object.keys(TRAIT_LABELS) as Array<keyof CharacterTraits>
      )
        .map((key) => {
          const wert = String(m[key] ?? "").trim();
          return wert && wert !== "0" ? `${TRAIT_LABELS[key]}: ${wert}` : null;
        })
        .filter(Boolean)
        .join(" · ");

      const zeilen = [
        c.kurzbeschreibung && `   ${c.kurzbeschreibung}`,
        merkmale && `   Merkmale: ${merkmale}`,
        c.beschreibung && `   Beschreibung:\n${einrücken(c.beschreibung)}`,
        c.storyHooks &&
          `   Offene Ansatzpunkte:\n${einrücken(c.storyHooks)}`,
      ].filter(Boolean);
      // Markierung nur, wenn überhaupt Protagonisten gewählt sind – sonst bleibt
      // die Zeile unverändert (kein markierter → `marke` überall leer).
      const marke = c.isProtagonist ? " (Protagonist)" : "";
      return [`${i + 1}. ${c.name}${marke}`, ...zeilen].join("\n");
    })
    .join("\n\n");

  // Dreht sich die Handlung um bestimmte Figuren? Nur dann kommt überhaupt eine
  // Protagonisten-Anweisung in den Prompt; ohne Markierung ist der Prompt
  // zeichengenau der von vorher (alle Figuren gleichrangig).
  const hatProtagonisten = characters.some((c) => c.isProtagonist);

  // Vorgegebene Handlungselemente – die aktiven Karten. Leer (nichts vorhanden
  // oder nichts aktiv) → Block ist "", der Prompt bleibt zeichengenau der von
  // vorher (dieselbe Regel wie beim Figuren-Feld).
  const handlungselemente = (details.handlungselemente ?? "").trim();
  const handlungselementeBlock = handlungselemente
    ? einweben
      ? // Beim Einweben wird der Entwurf nur behutsam ergänzt – die Elemente
        // tragen ihn längst, hier kein „mach sie zentral"-Druck, der die sanfte
        // Überarbeitung stören würde. Neu hinzugekommene werden mit eingewoben.
        `\nVorgegebene Handlungselemente – diese Aspekte tragen den Entwurf bereits; behalte sie bei und flicht neu hinzugekommene ebenso ein wie die neuen Personen:\n${handlungselemente}\n`
      : `\nVorgegebene Handlungselemente – diese Aspekte sollen den Entwurf tragen und darin vorkommen:\n${handlungselemente}\n`
    : "";

  const zusatzBlock = zusatz?.trim()
    ? `\nBesonders wichtig – zusätzliche Wünsche für diesen Entwurf:\n${zusatz.trim()}\n`
    : "";

  const tonBlock = tonHinweis(ton);
  const formBlock = formHinweis(form);

  // Auftrag: zwei Achsen, unabhängig voneinander. **Basis** – frisch aus Welt
  // und Figuren oder aus einem vorhandenen Entwurf. **Weiterspinnen** – eine
  // offene Ausgangslage oder eine vollständige Geschichte bis zum Ende.
  const auftrag = fortsetzen
    ? "Setze den vorhandenen Handlungsentwurf fort: Knüpf nahtlos an sein Ende an und erzähl weiter, was als Nächstes geschieht – dieselbe Welt, dieselben Figuren, derselbe Ton."
    : einweben
      ? "Überarbeite den vorhandenen Handlungsentwurf **behutsam** und flicht die Personen ein, die darin noch nicht vorkommen: dieselbe Welt, derselbe Konflikt, derselbe Ton. Es entsteht **keine neue Fassung**, sondern der bewährte Entwurf, um neue Fäden ergänzt."
      : nutzeBasis
      ? weiterspinnen
        ? "Überarbeite den vorhandenen Handlungsentwurf und spinne ihn zu einer vollständigen Geschichte weiter – dieselbe Welt, dieselben Figuren, aber von der Ausgangslage bis zu einem Ende."
        : "Überarbeite den vorhandenen Handlungsentwurf zu einer eigenständigen neuen Fassung – dieselbe Welt, dieselben Figuren, aber ein frischer Wurf."
      : weiterspinnen
        ? "Entwirf die Handlung für ein Szenario: eine vollständige Geschichte, die sich zwischen diesen Figuren entfaltet – von der Ausgangslage über die Zuspitzung bis zu einem Ende."
        : "Entwirf die Handlung für ein Szenario: die Ausgangslage, aus der sich eine Geschichte zwischen diesen Figuren entwickeln kann.";

  const basisBlock = nutzeBasis
    ? fortsetzen
      ? `\nBisheriger Handlungsentwurf, den du fortsetzt:\n${basis!.trim()}\n`
      : einweben
        ? `\nBisheriger Handlungsentwurf, den du behutsam ergänzt (lass ihn, wo möglich, unverändert):\n${basis!.trim()}\n`
        : `\nBisheriger Handlungsentwurf – deine Grundlage:\n${basis!.trim()}\n`
    : "";

  const basisAnforderung = fortsetzen
    ? "\n- Knüpfe unmittelbar an das Ende des bisherigen Entwurfs an und führe die Handlung weiter. Wiederhole nichts davon und formuliere es nicht um – schreibe ausschließlich, wie es weitergeht."
    : einweben
      ? "\n- Behalte die bestehende Handlung, ihre Figuren, ihren Aufbau und ihren Ton. Erkenne, welche der oben genannten Personen im bisherigen Entwurf **noch nicht** vorkommen, und webe **genau diese** ein – jede mit einem glaubhaften eigenen Faden, der ans Bestehende anknüpft (Verbündete, Widersacher, Angehörige o. Ä.). Wirf nichts Bewährtes um; du **ergänzt**, statt neu zu schreiben."
      : nutzeBasis
        ? "\n- Nimm den bisherigen Entwurf als Ausgangspunkt: Behalte seinen tragenden Konflikt und die beteiligten Figuren, forme daraus aber eine **eigenständige neue Fassung** – kein bloßes Umformulieren, sondern eine echte Alternative, die Schwerpunkte verschiebt und den Auslöser schärft."
        : "";

  // Länge und Ergebnis-Anforderung hängen am Weiterspinnen: eine vollständige
  // Geschichte braucht etwas mehr Platz und **schreibt** ihr Ende, eine offene
  // Ausgangslage lässt es bewusst weg.
  const laengeZeile = einweben
    ? "- Etwa so lang wie der bisherige Entwurf, plus den Raum für die neuen Fäden – ein paar Sätze mehr sind in Ordnung."
    : weiterspinnen
      ? "- Drei bis fünf kurze Absätze (insgesamt ca. 1000–1800 Zeichen)."
      : "- Drei bis vier kurze Absätze (insgesamt ca. 900–1400 Zeichen).";

  const ergebnisAnforderung = fortsetzen
    ? weiterspinnen
      ? "- Führe die Geschichte in dieser Fortsetzung bis zu einem Ende – Zuspitzung, Wendepunkt und ein Ausgang, der aus den Figuren und ihrem Konflikt folgt. Schreibe auch, **wie es ausgeht**."
      : "- Führe die Handlung eine deutliche Etappe weiter, ohne sie abzuschließen: eine neue Entwicklung, Zuspitzung oder Wendung. Lass den Ausgang offen."
    : einweben
      ? "- Behalte den Ausgang wie im bisherigen Entwurf: War er offen, bleibt er offen; war er abgeschlossen, bleibt er abgeschlossen. Gib den **vollständigen** überarbeiteten Entwurf zurück, nicht nur die Ergänzung."
      : weiterspinnen
        ? "- Skizziere eine **vollständige Geschichte**: von der Ausgangslage über Zuspitzung und Wendepunkt bis zu einem Ende, das aus den Figuren und ihrem Konflikt folgt. Schreibe auch, **wie es ausgeht**."
        : "- Kein fertiger Plot mit Auflösung: eine Ausgangslage mit offenem Ausgang. Schreibe nicht, wie es endet.";

  // Die Figuren-Regel hat zwei Fassungen. Ohne neue Personen (Default) die harte
  // Sperre wie bisher; auf Wunsch die gezielte Lockerung – genau so viele neue
  // benannte Personen, mit optionalen Namens-/Rollen-Vorgaben.
  const wunsch = neuePersonenWunsch?.trim();
  const figurenRegel =
    anzahlNeue >= 1
      ? `- **Führe genau ${anzahlNeue} neue, benannte ${
          anzahlNeue === 1 ? "Person" : "Personen"
        } ein**${
          wunsch ? ` (orientiere dich an: ${wunsch})` : ""
        }: ${anzahlNeue === 1 ? "eine Figur" : "Figuren"} mit vollständigem Namen und einer echten Rolle im Geschehen. Die oben genannten Figuren bleiben die tragenden Hauptfiguren; die neuen treten als Verbündete, Widersacher, Angehörige o. Ä. hinzu und dürfen mit ihnen in Konflikt geraten.${
          wunsch ? " Fülle Ungesagtes zu den Vorgaben stimmig auf." : ""
        }`
      : "- **Erfinde keine neuen Hauptfiguren.** Arbeite mit den Genannten. Nebenfiguren dürfen vorkommen, aber die Handlung muss von diesen Personen getragen werden.";

  const figurenEinleitung =
    anzahlNeue >= 1
      ? "Diese Figuren gibt es – sie tragen die Handlung (weitere neue Personen führst du wie unten angegeben zusätzlich ein):"
      : "Diese Figuren gibt es, und nur diese:";

  // Anweisung nur bei markierten Protagonisten – sonst leer, und der Prompt ist
  // zeichengenau der von vorher.
  const protagonisten = characters
    .filter((c) => c.isProtagonist)
    .map((c) => c.name.trim())
    .filter(Boolean);
  const protagonistBlock = hatProtagonisten
    ? `\n- **Die Handlung dreht sich um ${
        protagonisten.length === 1 ? "den Protagonisten" : "die Protagonisten"
      }** (oben mit „(Protagonist)" markiert): ${protagonisten.join(
        ", ",
      )}. Im Zentrum stehen ihre Entscheidungen und ihr Konflikt; die übrigen Figuren sind **Nebenfiguren**, die sie stützen, herausfordern oder mit ihnen ringen, ohne selbst die Hauptrolle zu spielen.`
    : "";

  // Die Besetzung im Prompt. Bei **leerem** `figuren`-Feld und vorhandenen
  // Charakteren ist `besetzung` zeichengenau `${figurenEinleitung}\n\n${figuren}`
  // wie zuvor – der ganze Prompt bleibt unverändert. Ist das Feld gefüllt,
  // treten seine Notizen hinzu (oder tragen die Besetzung ganz, wenn keine
  // Charaktere zugeordnet sind – dann lässt die Route den Aufruf überhaupt zu).
  const figurenNotizen = (details.figuren ?? "").trim();
  const notizenBlock = figurenNotizen
    ? `Wichtige Figuren – Notizen (noch keine ausgearbeiteten Charaktere, aber sie sollen im Entwurf vorkommen):\n${figurenNotizen}`
    : "";
  const besetzung =
    characters.length > 0
      ? notizenBlock
        ? `${figurenEinleitung}\n\n${figuren}\n\n${notizenBlock}`
        : `${figurenEinleitung}\n\n${figuren}`
      : notizenBlock;

  return `${auftrag}

Die Welt steht fest:
${welt}${weltText}
${besetzung}
${basisBlock}
Anforderungen:${basisAnforderung}
${laengeZeile}
${figurenRegel}${protagonistBlock}
- Benenne, **wer was von wem will** und woran es sich entzündet. Ein Konflikt braucht mindestens zwei Personen mit unvereinbaren Absichten.
- Lies die Beschreibungen genau: Dort steht die Vorgeschichte, und dort liegen die Reibungsflächen zwischen den Figuren. Auch scheinbare Nebensachen aus den Merkmalen – Herkunft, eine Narbe, ein Hobby – taugen als Anknüpfungspunkt.
- Sind offene Ansatzpunkte genannt, greife sie auf und verbinde sie: Das Interessante entsteht dort, wo das Anliegen der einen die Wunde der anderen trifft.
- Nenne einen konkreten **Auslöser** – ein Ereignis, ein Termin, eine Nachricht –, der die Lage in Bewegung bringt.
- Alles muss den Regeln des Szenarios gehorchen. Was dort gilt, gilt auch hier.
${ergebnisAnforderung}
- Reiner Fließtext auf Deutsch, ohne Markdown, ohne Überschriften, ohne Aufzählung.
${formBlock}${tonBlock}${handlungselementeBlock}${zusatzBlock}
${
    fortsetzen
      ? "Antworte mit nichts als der Fortsetzung – dem Text, der unmittelbar auf den bisherigen Entwurf folgt. Wiederhole den bisherigen Text nicht."
      : "Antworte mit nichts als dem Entwurf selbst."
  }`;
}

/**
 * Kurzer Titel für einen **Handlungsentwurf** oder **Story Arc** – damit die
 * Reiter-Leiste einen wiedererkennbaren Namen trägt statt „Entwurf 1/2/3".
 *
 * Bewusst **sehr knapp** (wie `buildNamePrompt`): Die Route nutzt
 * `chat.completions.create` mit kleinem `max_tokens`, kein Structured Output –
 * ein Titel ist ein String, ein JSON-Schema drumherum wäre reiner Aufschlag.
 */
export function buildStoryTitlePrompt(
  text: string,
  art: "entwurf" | "arc",
): string {
  const was =
    art === "arc"
      ? "Story Arc (die dramaturgische Gliederung einer Geschichte in Stationen)"
      : "Handlungsentwurf für eine Geschichte";
  return `Gib einen **kurzen, treffenden Titel** für den folgenden ${was}. Zwei bis fünf Wörter, kein ganzer Satz, kein Punkt am Ende, keine Anführungszeichen. Der Titel soll die Geschichte auf einen Blick wiedererkennbar machen – der Kern des Konflikts, ein Motiv oder ein Ort, nicht eine allgemeine Gattung.

${text.trim()}

Antworte mit nichts als dem Titel.`;
}

/**
 * Baut den Prompt für den **Namen eines Szenarios** – ein Name für die Welt
 * einer Geschichte, damit ein Szenario nicht „Neues Szenario" heißen muss.
 *
 * Zuschnitt wie `buildStoryTitlePrompt`/`buildNamePrompt`: **Freitext**, wenige
 * Wörter, kein JSON. Grundlage sind bewusst nur **Beschreibung, Ort, Zeit und
 * Regeln** – die Welt-Felder. **Genre, Figuren und Handlung** gehen nicht ein:
 * ein Szenario-Name benennt den Ort/die Stimmung, nicht die Gattung oder eine
 * einzelne Geschichte darin. Leere Felder bleiben weg; ist alles leer, bittet
 * der Prompt um einen offenen, stimmungsvollen Namen.
 */
export function buildScenarioNamePrompt(details: ScenarioDetails): string {
  const felder = [
    ["Beschreibung", details.beschreibung],
    ["Ort", details.ort],
    ["Zeit", details.zeit],
    ["Regeln", details.regeln],
  ]
    .map(([label, wert]) => [label, wert.trim()] as const)
    .filter(([, wert]) => wert)
    .map(([label, wert]) => `${label}: ${wert}`)
    .join("\n");

  return `Gib einen **kurzen, treffenden Namen** für das folgende Szenario – die Welt, in der eine Geschichte spielt. Zwei bis fünf Wörter, kein ganzer Satz, kein Punkt am Ende, keine Anführungszeichen. Der Name soll die Welt auf einen Blick wiedererkennbar machen – ein Ort, ein Motiv oder eine Stimmung –, keine allgemeine Gattung.

${felder || "(keine näheren Angaben – erfinde einen stimmungsvollen, offenen Namen)"}

Antworte mit nichts als dem Namen.`;
}

/**
 * Baut den Prompt für den **Story Arc** – die dramaturgische Zerlegung eines
 * Handlungsentwurfs in eine geordnete Folge von Stationen (Fünfakter).
 *
 * Das Gegenstück zu `buildScenarioPlotPrompt`: Der Entwurf sagt *worum es geht*,
 * der Arc *in welcher Reihenfolge es sich entfaltet*. Er erfindet **keine neue
 * Geschichte**, sondern gliedert die vorhandene – dieselbe Abgrenzung wie
 * Beschreibung ↔ Handlungsentwurf, eine Fassung derselben Sache auf anderer
 * Ebene, die der Quelle nie widersprechen darf.
 *
 * Die dokumentierten Lehren des Projekts zahlen sich hier direkt aus:
 *
 * - **Prüfbarer Endzustand statt Verfahren.** Nicht „arbeite den Entwurf in
 *   Akte um", sondern: am Ende müssen genau N Stationen dastehen, die den
 *   Entwurf lückenlos abschreiten und jeweils die Lage verändern. (Wie beim
 *   „Rahmen + zwei Schauplätze" der Ortserzeugung.)
 * - **Zerlegung, keine Neuerfindung.** Der Entwurf ist die Obergrenze der
 *   Wahrheit – die `eng`-Bindung der Ansatzpunkte, hier als Default.
 * - **Rückbindung mit Nachweis.** Jede Stufe nennt die tragenden Figuren, und
 *   die müssen aus der Besetzung stammen (grobe Nachprüfung serverseitig).
 * - **Ausgabeform ausdrücklich.** Keine Nummerierung – Nummern zählt das Modell
 *   nicht zu „Aufzählung", das musste bei der Ortserzeugung explizit werden.
 *
 * Wie bei `buildScenarioPlotPrompt` gehen Kurzbeschreibung, langer Text,
 * Merkmale **und** Ansatzpunkte der Figuren mit – die Vorgeschichte trägt die
 * Konflikte, die eine Station braucht.
 */
export function buildStoryArcPrompt(
  handlung: string,
  characters: PlotCharacter[],
  anzahl: number,
  /**
   * `spiel` macht aus den Stationen **spielbare Szenen** (etwas, das eine
   * Gruppe tut), `buch` **Erzählabschnitte**. Nur eine Tonlage im Prompt.
   */
  format: "buch" | "spiel" = "buch",
  /** Zusätzliche Wünsche für diesen Lauf (Stichwörter) – optional. */
  zusatz?: string,
  /**
   * **Kreative Impulse** (bei gesetztem „kreativ"-Haken) – zufällige
   * erzählerische Anregungen aus `storyArcSparks.ts`. Optional und dem Entwurf
   * untergeordnet: Was nicht passt, lässt das Modell fallen.
   */
  sparks?: string[],
  /**
   * **Handlung weiterspinnen** (Checkbox): Der Handlungsentwurf ist bewusst eine
   * Ausgangslage mit offenem Ausgang. Angehakt **entwickelt** der Arc daraus
   * eine vollständige Geschichte (er erfindet Zuspitzung, Wendepunkt und Ende),
   * statt die offene Lage nur zu gliedern. Damit löst sich der sonst eingebaute
   * Widerspruch – ein Arc über eine offene Lage müsste Fall und Auflösung ohnehin
   * erfinden, obwohl der Zerlege-Modus „kein neues Ende" verlangt.
   */
  weiterspinnen?: boolean,
  /** **Ton und Sprache** (`STORY_TONES`-Wert). Leer/`neutral` = ohne Ton-Block. */
  ton?: string,
  /**
   * **Erzählform** (`STORY_FORMS`-Wert): Krimi, Liebe, Abenteuer … Leer/`allround`
   * = ohne Erzählform-Block. Prägt den **Aufbau** des Arcs (welche Art von
   * Zuspitzung und Auflösung die Phasen tragen), nicht die Welt.
   */
  form?: string,
  /**
   * **Wichtige Figuren** (`details.figuren`) – Notizen zu Personen, die keine
   * ausgearbeiteten Charaktere sind. Ist das gefüllt, treten sie als zusätzliche
   * Besetzung hinzu und dürfen die Stationen-Namen tragen. **Leer = der Prompt
   * ist zeichengenau der von vorher.**
   */
  figurenNotizen?: string,
): string {
  /** Rückt einen mehrzeiligen Block ein, damit die Zuordnung zur Figur hält. */
  const einrücken = (text: string, tiefe = "     ") =>
    text
      .split("\n")
      .filter((z) => z.trim())
      .map((z) => tiefe + z.trim())
      .join("\n");

  const figuren = characters
    .map((c, i) => {
      const m = c.merkmale;
      const merkmale = (Object.keys(TRAIT_LABELS) as Array<keyof CharacterTraits>)
        .map((key) => {
          const wert = String(m[key] ?? "").trim();
          return wert && wert !== "0" ? `${TRAIT_LABELS[key]}: ${wert}` : null;
        })
        .filter(Boolean)
        .join(" · ");
      const zeilen = [
        c.kurzbeschreibung && `   ${c.kurzbeschreibung}`,
        merkmale && `   Merkmale: ${merkmale}`,
        c.beschreibung && `   Beschreibung:\n${einrücken(c.beschreibung)}`,
        c.storyHooks && `   Offene Ansatzpunkte:\n${einrücken(c.storyHooks)}`,
      ].filter(Boolean);
      // Markierung nur bei gewählten Protagonisten – sonst leer, Zeile
      // unverändert (byte-identisch wie bisher).
      const marke = c.isProtagonist ? " (Protagonist)" : "";
      return [`${i + 1}. ${c.name}${marke}`, ...zeilen].join("\n");
    })
    .join("\n\n");

  // Die Namen der Besetzung, an die die `figuren`-Rückbindung jeder Stufe
  // gebunden ist – im Prompt genannt, damit das Modell keine erfindet.
  const namen = characters
    .map((c) => c.name.trim())
    .filter(Boolean)
    .join(", ");

  // Dreht sich der Arc um bestimmte Figuren? Nur dann kommt eine Anweisung in
  // den Prompt; ohne Markierung bleibt er zeichengenau der von vorher.
  const hatProtagonisten = characters.some((c) => c.isProtagonist);
  const protagonisten = characters
    .filter((c) => c.isProtagonist)
    .map((c) => c.name.trim())
    .filter(Boolean);
  const protagonistZeile = hatProtagonisten
    ? `\n- **Der Arc dreht sich um ${
        protagonisten.length === 1 ? "den Protagonisten" : "die Protagonisten"
      }** (oben mit „(Protagonist)" markiert): ${protagonisten.join(
        ", ",
      )}. Die tragenden Stationen gehören ihnen und ihrem Weg; die übrigen Figuren treten stützend, herausfordernd oder als Gegenspieler hinzu, ohne den Arc selbst zu tragen.`
    : "";

  // Format-Tonlage: dieselbe Zerlegung, aber die Stationen sind mal
  // Erzählabschnitte, mal spielbare Szenen.
  const formatZeile =
    format === "spiel"
      ? "- Jede Station ist eine **spielbare Szene**: etwas, das eine Spielgruppe an einem Ort tut, mit den beteiligten Figuren. Beschreibe, was dort geschieht und woran es sich entscheidet."
      : "- Jede Station ist ein **Erzählabschnitt** eines Buches: ein zusammenhängender Ausschnitt der Handlung, der die Geschichte ein Stück weiterträgt.";

  const zusatzBlock = zusatz?.trim()
    ? `\nBesonders wichtig – zusätzliche Wünsche für diesen Arc:\n${zusatz.trim()}\n`
    : "";

  const sparksBlock = sparks?.length
    ? `\nKreative Impulse – lass dich davon frei inspirieren, wo sie zur Geschichte passen. Sie sind Anregung, keine Pflicht, und dürfen dem Handlungsentwurf nie widersprechen; was nicht passt, lässt du fallen:\n${sparks
        .map((s) => `- ${s}`)
        .join("\n")}\n`
    : "";

  // Die Phasenfolge **explizit** vorgeben statt sie das Modell aus einer Zahl
  // ableiten zu lassen: Gemessen liefert es sonst verlässlich fünf Stationen
  // (eine je genannter Phase), egal welche Zahl gefordert war – die dokumentierte
  // Lehre „prüfbarer Endzustand statt Verfahren". Wir verteilen die fünf Phasen
  // gleichmäßig über die geforderte Stationenzahl (Anfang exposition, Ende
  // aufloesung) und geben dem Modell die fertige Liste.
  const PHASEN = [
    "exposition",
    "steigerung",
    "hoehepunkt",
    "fall",
    "aufloesung",
  ];
  const folge = Array.from({ length: anzahl }, (_, i) =>
    anzahl <= 1
      ? PHASEN[0]
      : PHASEN[Math.round((i * (PHASEN.length - 1)) / (anzahl - 1))],
  );
  const folgeListe = folge.map((p, i) => `${i + 1}. ${p}`).join("\n");

  // Zwei grundverschiedene Aufträge: **zerlegen** (die vorhandene, offene
  // Ausgangslage nur gliedern) oder **weiterspinnen** (aus ihr eine ganze
  // Geschichte mit Ende entwickeln). Nur Einleitung und Kern-Anforderung
  // wechseln – Phasenfolge, Figurenbindung, Format und Ausgabeform bleiben.
  const einleitung = weiterspinnen
    ? "Der folgende Handlungsentwurf ist eine Ausgangslage mit offenem Ausgang. Spinne sie zu einer vollständigen Geschichte weiter und gliedere diese in einen Story Arc: eine geordnete Folge von Stationen, die von der Ausgangslage bis zu einem Ende führt."
    : "Zerlege den folgenden Handlungsentwurf in einen Story Arc: eine geordnete Folge von Stationen, die die Geschichte von ihrer Ausgangslage bis zu ihrer Auflösung abschreitet.";

  const kernAnforderung = weiterspinnen
    ? "- **Spinne die Handlung weiter.** Die Ausgangslage liefert Anfang, Figuren und Konflikt; daraus entwickelst du eine ganze Geschichte. Erfinde die Zuspitzung, den Wendepunkt und ein Ende, das aus Figuren und Konflikt zwingend folgt. Die späteren Phasen (Höhepunkt, Fall, Auflösung) sind hier **keine Zusammenfassung des Vorhandenen, sondern neue Handlung, die du erfindest** – bleib dabei Welt, Figuren und dem Kern des Konflikts treu und widersprich der Ausgangslage nie."
    : "- **Zerlege, erfinde nicht.** Der Entwurf ist die Obergrenze der Wahrheit: Baue keine Ereignisse ein, die nicht in ihm angelegt sind. Lässt er etwas offen, konkretisiere es aus den Figuren – aber erfinde keine neue Wendung und kein neues Ende.";

  // Besetzung im Prompt. Bei **leerem** Notiz-Feld und vorhandenen Charakteren
  // zeichengenau „Diese Figuren gibt es, und nur diese:\n\n${figuren}" wie zuvor.
  // Gefüllt: die Notizen treten hinzu (oder tragen die Besetzung ganz, wenn keine
  // Charaktere zugeordnet sind – dann lässt die Route den Aufruf überhaupt zu).
  const notizen = (figurenNotizen ?? "").trim();
  const notizenBlock = notizen
    ? `Wichtige Figuren – Notizen (noch keine ausgearbeiteten Charaktere, aber sie kommen im Handlungsentwurf vor):\n${notizen}`
    : "";
  const besetzung =
    characters.length > 0
      ? notizenBlock
        ? `Diese Figuren gibt es:\n\n${figuren}\n\n${notizenBlock}`
        : `Diese Figuren gibt es, und nur diese:\n\n${figuren}`
      : notizenBlock;

  // Die Namensbindung jeder Station. Ohne Notizen die harte Sperre auf die
  // Besetzung wie bisher; mit Notizen dürfen auch die notierten Figuren die
  // Stationen tragen (ihre Namen stehen nicht in `namen`).
  const namenZeile = notizen
    ? "- Jede Station nennt in ihren Figuren die Namen der beteiligten Personen – aus der oben genannten Besetzung (die zugeordneten Charaktere und die notierten wichtigen Figuren). Erfinde darüber hinaus keine neuen Hauptfiguren."
    : `- Jede Station nennt in ihren Figuren die Namen, die sie tragen – **ausschließlich** aus dieser Besetzung: ${namen}. Erfinde keine neuen Namen.`;

  return `${einleitung}

Der Handlungsentwurf:
${handlung.trim()}

${besetzung}

Die fünf Dramaturgie-Phasen bedeuten:
- exposition – die Ausgangslage: wer, wo, welche Spannung liegt in der Luft.
- steigerung – der Konflikt bricht auf und eskaliert.
- hoehepunkt – die Entscheidung, der Punkt ohne Umkehr.
- fall – die Folgen der Entscheidung, es wird enger.
- aufloesung – der neue Zustand, in dem die Geschichte zur Ruhe kommt.

Der Arc hat **genau ${anzahl} Stationen** mit diesen Phasen, in dieser Reihenfolge. Gib für jede Zeile genau einen Eintrag zurück, mit der angegebenen Phase – nicht mehr und nicht weniger:
${folgeListe}

Anforderungen:
${kernAnforderung}${protagonistZeile}
- Jede Station **verändert die Lage** gegenüber der vorigen. Keine zwei Stationen, die dasselbe noch einmal sagen.
${namenZeile}
${formatZeile}
- Titel kurz und prägnant (2–5 Wörter).
- **Jede Stationsbeschreibung ist ein ausgearbeiteter Fließtext von mindestens 700 Zeichen** (etwa fünf bis acht Sätze): Schildere ausführlich und konkret, was in der Station geschieht, wie sich die Lage gegenüber der vorigen verändert, welche Figuren wie beteiligt sind und woran es sich entscheidet. Am Ende muss **jede** Beschreibung diese Länge erreichen. Als Fließtext, ohne Nummerierung, ohne Aufzählungszeichen.
- Alles auf Deutsch.
${formHinweis(form)}${tonHinweis(ton)}${sparksBlock}${zusatzBlock}`;
}

/**
 * Baut den Prompt für die **Kapitel einer Story-Arc-Station** – eine wählbare
 * Zahl (Spanne `min`–`max`), jedes mit Überschrift und zwei bis drei Sätzen (im
 * Kreativ-Modus mehr).
 *
 * Bewusst die Zerlegung **der Station**, nicht der Besetzung: Kapitel gliedern
 * den Stationstext feiner auf (eine Ebene unter dem Akt), sie erfinden nichts
 * Neues. Deshalb braucht der Prompt weder Welt noch volle Charaktere – die
 * Station trägt Beschreibung und beteiligte Figuren schon in sich. Dieselbe
 * Abgrenzung wie Arc ↔ Handlungsentwurf, nur eine Ebene tiefer.
 */
export function buildStoryArcChaptersPrompt(
  stufe: {
    titel: string;
    beschreibung: string;
    figuren: string[];
  },
  options: {
    kreativ?: boolean;
    sparks?: string[];
    /** Spanne der Kapitelzahl. Vorgabe 2–3 (die bisherige feste Zahl). */
    min?: number;
    max?: number;
    /** **Ton und Sprache** (`STORY_TONES`-Wert). */
    ton?: string;
    /** **Erzählform** (`STORY_FORMS`-Wert). Leer/`allround` = ohne Block. */
    form?: string;
    /**
     * **Mindestlänge der Zusammenfassung je Kapitel** in Zeichen. Als prüfbarer
     * Endzustand im Prompt – knappe Modelle (etwa Gemini) liefern sonst zu kurze
     * Zusammenfassungen. Default 450 (s. `MIN_KAPITEL_LEN` in der Route).
     */
    minZeichen?: number;
    /**
     * **Vorgegebene Abschnitte** aus den `---`-Kapitelgrenzen der Beschreibung.
     * Bei ≥ 2 Einträgen schaltet der Prompt in den **Segment-Modus**: genau ein
     * Kapitel je Abschnitt, in Reihenfolge, ohne Zusammenfassen oder feineres
     * Teilen. Leer/ein Eintrag → modellgesteuerte Zerlegung wie bisher.
     */
    segmente?: string[];
  } = {},
): string {
  const kreativ = !!options.kreativ;
  const min = options.min ?? 2;
  const max = options.max ?? 3;
  const minZeichen = options.minZeichen ?? 450;
  const segmente = options.segmente ?? [];
  const segmentModus = segmente.length >= 2;
  const anzahlText = `${min} bis ${max} Kapitel`;
  const figuren = stufe.figuren.filter((f) => f.trim());
  const figurenZeile =
    figuren.length > 0 ? `\nBeteiligte Figuren: ${figuren.join(", ")}.` : "";

  // Kreativ: ausgemalt, mit erlaubter Detailerfindung; sonst rein zerlegend.
  // Beide fordern eine **ausführliche** Zusammenfassung (Mindestlänge unten) –
  // eine knappe Satzzahl reicht Gemini als Ausrede für zu kurze Texte.
  const satzVorgabe = kreativ
    ? "mehreren Sätzen, die die Handlung des Kapitels konkret ausmalen"
    : "mehreren Sätzen, die konkret sagen, was in dem Kapitel passiert";

  const ausarbeitung = kreativ
    ? "- **Arbeite aus.** Bleib im Rahmen der Station (kein neues Großereignis, keine neuen Hauptfiguren, kein anderer Ausgang), aber fülle sie mit konkreten Details: ein Bild, ein Sinneseindruck, eine kleine Handlung, ein Satz Dialog, eine innere Regung. Die Kapitel dürfen erzählerisch atmen und Zwischentöne setzen."
    : "- **Zerlege, erfinde nicht.** Bleib in dem, was die Station hergibt – konkretisiere, aber füge keine neuen Ereignisse oder Figuren hinzu.";

  const sparksBlock =
    kreativ && options.sparks?.length
      ? `\nKreative Impulse – lass dich davon frei inspirieren, wo sie zur Station passen. Anregung, keine Pflicht; was nicht passt, lässt du fallen, und keiner darf der Station widersprechen:\n${options.sparks
          .map((s) => `- ${s}`)
          .join("\n")}\n`
      : "";

  // Segment-Modus: Die Beschreibung ist bereits per `---` in feste Abschnitte
  // geteilt. Jeder Abschnitt wird zu **genau einem** Kapitel – die Grenzen sind
  // vorgegeben, das Modell fasst nicht zusammen und teilt nicht feiner. Als
  // prüfbarer Endzustand formuliert (die Erfahrung aus den Szenariofeldern: eine
  // am Ergebnis prüfbare Bedingung hält besser als eine Verfahrensanweisung).
  if (segmentModus) {
    const abschnitte = segmente
      .map((s, i) => `Abschnitt ${i + 1}:\n${s}`)
      .join("\n\n");
    return `Formuliere die folgende Station eines Story Arcs zu **genau ${segmente.length} Kapiteln** aus.

Station: ${stufe.titel.trim() || "(ohne Titel)"}${figurenZeile}

Die Station ist bereits in ${segmente.length} Abschnitte vorgegeben. Schreibe **genau ein Kapitel je Abschnitt**, in dieser Reihenfolge. Fasse keine Abschnitte zusammen und teile keinen weiter auf – die Grenzen sind gesetzt. Jedes Kapitel bleibt in dem, was **sein** Abschnitt hergibt, und greift nicht auf spätere Abschnitte vor.

${abschnitte}

Am Ende müssen genau ${segmente.length} Kapitel dastehen – eines je Abschnitt, in Reihenfolge.

Jedes Kapitel besteht aus:
- einer kurzen Überschrift (2–6 Wörter),
- ${satzVorgabe}.

Anforderungen:
${ausarbeitung}
- Am Ende muss die Zusammenfassung **jedes** Kapitels mindestens ${minZeichen} Zeichen lang sein – lieber ausführlich und konkret als knapp. Zu kurze Kapitel sind unbrauchbar.
- Alles auf Deutsch, ohne Nummerierung und ohne Aufzählungszeichen im Text.
${formHinweis(options.form)}${tonHinweis(options.ton)}${sparksBlock}`;
  }

  // Ein einzelnes Kapitel (Wahl „1") verlangt eine andere Grammatik als eine
  // Spanne: kein „zerlege in", kein „keine zwei". Für alle übrigen Wahlen
  // (Spanne) bleiben die Sätze zeichengleich wie bisher.
  const einzeln = min === 1 && max === 1;
  const auftrag = einzeln
    ? "Fasse die folgende Station eines Story Arcs in **genau ein Kapitel** zusammen"
    : `Zerlege die folgende Station eines Story Arcs in ${anzahlText}`;
  const abschlussSatz = einzeln
    ? "Am Ende muss genau ein Kapitel dastehen, das die Station als Ganzes abdeckt."
    : `Am Ende müssen ${anzahlText} dastehen. Sie schreiten die Station in ihrer Reihenfolge ab und decken sie zusammen lückenlos ab.`;
  const fortschrittBullet = einzeln
    ? "- Das Kapitel deckt die Station als Ganzes ab, ohne sie bloß aufzuzählen."
    : "- Jedes Kapitel trägt die Handlung ein Stück weiter; keine zwei, die dasselbe sagen.";

  return `${auftrag}.

Station: ${stufe.titel.trim() || "(ohne Titel)"}
Was in ihr geschieht:
${stufe.beschreibung.trim() || "(keine Beschreibung)"}${figurenZeile}

${abschlussSatz}

Jedes Kapitel besteht aus:
- einer kurzen Überschrift (2–6 Wörter),
- ${satzVorgabe}.

Anforderungen:
${ausarbeitung}
${fortschrittBullet}
- Am Ende muss die Zusammenfassung **jedes** Kapitels mindestens ${minZeichen} Zeichen lang sein – lieber ausführlich und konkret als knapp. Zu kurze Kapitel sind unbrauchbar.
- Alles auf Deutsch, ohne Nummerierung und ohne Aufzählungszeichen im Text.
${formHinweis(options.form)}${tonHinweis(options.ton)}${sparksBlock}`;
}

/**
 * Eine Figur, wie sie der **Kapitel-Prosatext** braucht: genug, um sie stimmig
 * und wiedererkennbar zu schildern. Weniger als der Handlungsentwurf verlangt
 * (der die ganze Vorgeschichte will) – hier zählt, wie die Person **wirkt** und
 * aussieht, nicht ihr kompletter Lebenslauf.
 */
export interface ChapterCharacter {
  name: string;
  kurzbeschreibung: string;
  /** Die vollständige Merkmalstabelle – Aussehen und Eckdaten. */
  merkmale: CharacterTraits;
}

/**
 * Baut den Prompt für den **ausformulierten Prosatext eines Kapitels**.
 *
 * Eine Ebene unter `buildStoryArcChaptersPrompt`: Der zerlegt eine Station in
 * Kapitel (Überschrift + zwei bis drei Sätze, *was* passiert); dieser hier macht
 * aus **einem** solchen Kapitel eine ausgeschriebene Szene. Der `inhalt` des
 * Kapitels ist das Gerüst – der Text soll ihn erfüllen, nicht überschreiten.
 *
 * Die drei ausdrücklich verlangten Zutaten stehen als prüfbare Anforderungen im
 * Prompt (die Lehre aus dem Szenario-Feld: ein prüfbarer Endzustand hält besser
 * als eine Verfahrensanweisung): **genaue Personen und ihre Tätigkeiten**, die
 * **Atmosphäre des Ortes**, **Dialog in wörtlicher Rede**.
 *
 * Die bekannten Figuren gehen mit ihren Merkmalen ein, damit der Text sie
 * konsistent schildert. Andere Personen, die nur im Kapitel vorkommen (etwa aus
 * dem Handlungsentwurf hinzuerfundene), zeichnet der Text aus dem, was `inhalt`
 * und Station über sie sagen.
 */
export function buildChapterTextPrompt(
  welt: {
    genre?: string;
    ort?: string;
    zeit?: string;
    regeln?: string;
    beschreibung?: string;
  },
  stufe: { titel: string; beschreibung: string },
  /**
   * **Alle** Kapitel der Station in Reihenfolge – nicht nur das gewählte. Der
   * Prompt braucht die Nachbarn, um die Grenze zu kennen: Ohne sie behandelt das
   * Modell die Stationsbeschreibung als das Auszuschreibende und schreibt die
   * ganze Station statt nur des einen Kapitels.
   */
  kapitelListe: { titel: string; inhalt: string }[],
  /** Welches Kapitel aus `kapitelListe` ausgeschrieben wird. */
  kapitelIndex: number,
  figuren: ChapterCharacter[],
  options: {
    ton?: string;
    form?: string;
    /** **Kapitellänge** (`KAPITEL_LAENGEN`-Wert) – steuert die Prosalänge. */
    kapitelLaenge?: string;
    /**
     * **Werkform** (`WERKFORMEN`-Wert) – prägt den Prosastil (verdichtet ↔
     * ausladend). Leer/`frei` = kein Stil-Block, der Prompt bleibt wie zuvor.
     */
    werkform?: string;
  } = {},
): string {
  const ziel = kapitelListe[kapitelIndex] ?? { titel: "", inhalt: "" };
  const mehrere = kapitelListe.length > 1;

  // Die Kapitel der Station mit Markierung des gewählten – so sieht das Modell
  // die Grenzen und schreibt nur diesen einen Ausschnitt.
  const kapitelUebersicht = mehrere
    ? `\nDie Station ist in diese Kapitel geteilt (in Reihenfolge). Du schreibst **nur das mit ▶ markierte** aus:\n${kapitelListe
        .map((k, idx) => {
          const marke = idx === kapitelIndex ? "▶" : " ";
          const titel = k.titel.trim() || `Kapitel ${idx + 1}`;
          const inhalt = k.inhalt.trim() ? ` – ${k.inhalt.trim()}` : "";
          return `${marke} ${idx + 1}. ${titel}${inhalt}`;
        })
        .join("\n")}\n`
    : "";

  const weltZeilen =
    line("Genre", welt.genre) +
    line("Ort", welt.ort) +
    line("Zeit", welt.zeit) +
    line("Regeln", welt.regeln);
  const weltText = welt.beschreibung?.trim()
    ? `\nZur Welt:\n${welt.beschreibung.trim()}\n`
    : "";

  const figurenBlock = figuren.length
    ? figuren
        .map((c) => {
          const m = c.merkmale;
          const merkmale = (
            Object.keys(TRAIT_LABELS) as Array<keyof CharacterTraits>
          )
            .map((key) => {
              const wert = String(m[key] ?? "").trim();
              return wert && wert !== "0"
                ? `${TRAIT_LABELS[key]}: ${wert}`
                : null;
            })
            .filter(Boolean)
            .join(" · ");
          return [
            `- ${c.name}`,
            c.kurzbeschreibung && `  ${c.kurzbeschreibung}`,
            merkmale && `  Merkmale: ${merkmale}`,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n")
    : "";

  const figurenTeil = figurenBlock
    ? `\nBekannte Figuren (schildere sie stimmig zu diesen Angaben):\n${figurenBlock}\n`
    : "";

  // Länge aus der **Kapitellänge** (entkoppelt vom „kreativ"-Haken). `mittel`
  // liefert exakt die frühere Vorgabe – der Standardfall bleibt zeichengleich.
  const laenge = kapitelLaengeHint(options.kapitelLaenge ?? "");

  // Werkform-Stil (verdichtet ↔ ausladend) – als eigener Bullet nach der Länge.
  // Leer bei `frei`/unbekannt, dann bleibt der Prompt wie zuvor.
  const werkformBlock = werkformStil(options.werkform ?? "");

  // Ton – nur bei nicht-neutralem Ton. `neutral`/leer liefert `""`, dann bleibt
  // der Prompt exakt wie zuvor (auch das „ohne Kitsch" unten). Bei gesetztem Ton
  // dagegen **verstärkt**: der Ton steht als Wichtigstes oben (nicht bloß als
  // eine Zeile unter vielen), verlangt ausdrücklich, den **ganzen** Text zu
  // prägen (nicht nur den Dialog), und wird am Ende noch einmal eingeschärft. Im
  // langen Prosatext geht ein einzelner Ton-Satz sonst im vielen neutralen
  // Beschreibungsgewebe unter.
  const hint = toneHint(options.ton ?? "");
  const hatTon = hint !== "";
  const tonKopf = hatTon
    ? `\n**Der Ton ist das Wichtigste an diesem Text:** ${hint}\nDieser Ton prägt den **gesamten** Text – nicht nur die wörtliche Rede, sondern auch, wie du die Personen, ihre Tätigkeiten und die Atmosphäre schilderst. Fall nie ins neutral Berichtende zurück.\n`
    : "";
  const tonFuss = hatTon
    ? "\n- Halte den oben genannten Ton **durchgehend bis zum letzten Satz** durch, auch in den Beschreibungen."
    : "";
  // „Ohne Kitsch" kämpft gegen gefühlsbetonte Töne (leidenschaftlich,
  // romantisch) – deshalb nur im neutralen Ton. Bei gesetztem Ton trägt ihn der
  // Ton selbst.
  const stilZeile = hatTon
    ? "- Auf Deutsch, lebendig und plastisch."
    : "- Auf Deutsch, lebendig und plastisch, aber ohne Kitsch.";

  // Erzählform prägt auch die einzelne Szene: worauf der Blick fällt (Spuren im
  // Krimi, Nähe in der Liebesgeschichte, Gefahr im Thriller). Leer bei
  // `allround`, dann bleibt der Prompt wie zuvor.
  const formBlock = formHinweis(options.form);

  const grenzAnforderung = mehrere
    ? "- **Schreibe ausschließlich das markierte Kapitel aus – nicht die ganze Station.** Die anderen Kapitel oben sind nicht dein Gegenstand; ihr Inhalt gehört in ihre eigenen Texte. Beginne dort, wo dieses Kapitel öffnet, und höre auf, wo das nächste beginnt."
    : "- **Schreibe nur dieses eine Kapitel aus** – bleib bei seinem Inhalt, geh nicht darüber hinaus.";

  // Folgekapitel (Index > 0) schließen an ein vorheriges an und werden mit ihm
  // hintereinander gelesen. Ohne Hinweis eröffnet das Modell jedes Kapitel mit
  // einer frischen Stimmungs-Einstimmung – beim ersten richtig, beim zweiten
  // eine Dopplung, weil Ort und Stimmung schon dastehen. Deshalb: direkt in die
  // laufende Handlung, Atmosphäre nur beiläufig statt als Auftakt.
  const anschluss = kapitelIndex > 0;
  const vorheriges =
    kapitelListe[kapitelIndex - 1]?.titel.trim() || `Kapitel ${kapitelIndex}`;
  const anschlussAnforderung = anschluss
    ? `- **Dieses Kapitel setzt „${vorheriges}" unmittelbar fort** – die Kapitel werden hintereinander gelesen. Ort, Zeit und Grundstimmung sind bereits eingeführt: **beginne nicht mit einer erneuten Einstimmung**, sondern steig direkt in die laufende Handlung ein, dort wo das vorige Kapitel aufhört. Schauplatz und Stimmung neu schildern nur dann, wenn die Szene an einen anderen Ort oder in eine andere Zeit springt.`
    : "";

  // Die Atmosphäre-Anforderung selbst wird im Folgekapitel entschärft: kein
  // frisches Einfangen der ganzen Szene, sondern eingewobene Details dort, wo
  // sich etwas ändert. Im ersten Kapitel bleibt sie wie zuvor.
  const atmosphaereBullet = anschluss
    ? "- **Atmosphäre beiläufig, nicht als Auftakt**: Der Schauplatz steht schon aus dem vorigen Kapitel. Schildere ihn nicht von vorn – streu sinnliche Details (Licht, Geräusch, Geruch, Temperatur) dort ein, wo sich etwas ändert oder die Handlung sie berührt."
    : "- **Fange die Atmosphäre des Ortes ein**: Licht, Geräusche, Gerüche, Temperatur, Stimmung – passend zu Ort und Zeit oben.";

  return `Schreibe den ausformulierten Prosatext für **ein einzelnes Kapitel** einer Geschichte – eine ausgeschriebene Szene, nicht eine Zusammenfassung.
${tonKopf}${formBlock}
Die Welt:
${weltZeilen}${weltText}
Die Station „${stufe.titel.trim() || "(ohne Titel)"}" – nur zur Einordnung, **nicht** ausschreiben:
${stufe.beschreibung.trim() ? `${stufe.beschreibung.trim()}\n` : "(keine Beschreibung)\n"}${kapitelUebersicht}
Auszuschreibendes Kapitel: ${ziel.titel.trim() || "(ohne Titel)"}
Was darin geschieht (dein Gerüst – erfülle genau dies, nicht mehr):
${ziel.inhalt.trim() || "(keine Angabe – halte dich an die Station und die Welt, aber bleib bei diesem einen Kapitel)"}
${figurenTeil}
Anforderungen:
${grenzAnforderung}${anschlussAnforderung ? "\n" + anschlussAnforderung : ""}
- ${laenge}${werkformBlock ? "\n- " + werkformBlock + (hatTon ? " Der Ton oben bleibt dabei **bindend**: Er bestimmt Deutlichkeit und Wortwahl – auch bei intimen, körperlichen oder drastischen Szenen –, die Werkform nur Tempo und Tiefe. Nichts davon wird durch die Werkform abgemildert oder ausgespart." : "") : ""}
- **Beschreibe die Personen genau** – ihr Aussehen und Auftreten – und schildere ihre **Tätigkeiten** Schritt für Schritt, konkret und sichtbar.
${atmosphaereBullet}
- **Baue Dialog in wörtlicher Rede ein** (mit Anführungszeichen), der die Figuren charakterisiert und die Handlung trägt. Nicht nur berichten, was gesagt wird – lass sie sprechen.
- Gehorche den Regeln der Welt. Erfinde nichts, was ihnen widerspricht; führe keine neuen tragenden Personen ein.
- **Erzähle durchgehend in der Vergangenheitsform (Präteritum)** – „sie ging", „er sah", „es geschah". Halte diese Zeitform vom ersten bis zum letzten Satz konsequent durch und wechsle nie ins Präsens. Einzige Ausnahme ist die wörtliche Rede: Was eine Figur in Anführungszeichen sagt, steht in ihrer eigenen Zeit.
${stilZeile}
- Reiner Fließtext, keine Überschrift, kein Markdown, keine Aufzählung.${tonFuss}
Antworte mit nichts als dem Kapiteltext selbst.`;
}

/**
 * Baut den Prompt für ein **aus einem Charakter abgeleitetes Szenario**.
 *
 * Die Gegenrichtung zu `scenarioToInput`: dort prägt eine fertige Welt eine
 * neue Figur, hier spannt eine fertige Figur die Welt auf, in die sie gehört.
 * Beides muss gehen, weil beides vorkommt – mal steht die Welt zuerst fest,
 * mal fällt einem eine Person ein.
 *
 * **Ableiten, nicht dazuerfinden.** Das ist die ganze Schwierigkeit hier: Zu
 * einem Charakter lässt sich jede beliebige Welt behaupten, und ein Modell,
 * das man frei erfinden lässt, liefert die generische – eine Stadt, eine
 * Bedrohung, ein Geheimnis. Der Prompt verlangt deshalb, dass jede Festlegung
 * ihren **Beleg in der Figur** hat: Der Beruf sagt etwas über die Wirtschaft,
 * die Herkunft über Grenzen und Wege, die besonderen Merkmale über das, was
 * in dieser Welt möglich ist. Die Welt soll erklären, **warum es diesen
 * Menschen gibt** – nicht bloß einen Hintergrund abgeben, vor dem er steht.
 *
 * Die **Ansatzpunkte** gehen mit, sofern vorhanden: sie zeigen, worauf die
 * Figur zuläuft, und eine Welt, in der das unmöglich wäre, ist die falsche.
 * Sie sind hier aber nur Material – ein Szenario ist keine Handlung. Deshalb
 * liefert dieser Prompt auch **keinen** Handlungsentwurf; der braucht mehrere
 * Figuren und entsteht später in der Szenario-Detailansicht.
 */
export function buildScenarioFromCharacterPrompt(
  character: GeneratedCharacter,
  storyHooks?: string,
  /**
   * Das Setting-Feld aus den ursprünglichen Vorgaben, sofern vorhanden. Der
   * beste verfügbare Hinweis aufs Genre – die Merkmalstabelle nennt es nie
   * beim Namen, und aus dem Fließtext muss man es erschließen.
   *
   * „Weitere Wünsche" bleiben bewusst draußen: stammt die Figur aus einem
   * Szenario, steht dort dessen kompletter Weltkontext. Der Vorschlag wäre
   * dann eine Abschrift jenes Szenarios und keine Ableitung aus der Person.
   */
  setting?: string,
  /**
   * Das Genre aus den Vorgaben des Charakters. Es steht **fest** und ist keine
   * Aufgabe für das Modell: Die Figur wurde in diesem Genre angelegt, und die
   * Welt, in die sie gehört, kann keine andere sein. Hier steuert es nur noch,
   * wie Ort, Zeit und Regeln auszufallen haben.
   */
  genre?: string,
  /**
   * Würfel-Einträge des Genres als **Formbeispiel** – s. `scenarioSamples.ts`.
   * Gezogen wird in der Route, nicht hier: So bleibt dieser Prompt bei
   * gleichen Eingaben derselbe und lässt sich vergleichen.
   */
  beispiele?: ScenarioSamples | null,
): string {
  const m = character.merkmale;

  const merkmale = (Object.keys(TRAIT_LABELS) as Array<keyof CharacterTraits>)
    .map((key) => {
      const wert = String(m[key] ?? "").trim();
      return wert && wert !== "0" ? `- ${TRAIT_LABELS[key]}: ${wert}` : null;
    })
    .filter(Boolean)
    .join("\n");

  const hooksBlock = storyHooks?.trim()
    ? `\nOffene Ansatzpunkte für Geschichten mit dieser Figur:\n${storyHooks.trim()}\n`
    : "";

  const settingZeile = line("Ursprünglich angelegt als", setting);
  const genreZeile = line(
    "Genre (steht fest)",
    genre ? genreLabel(genre) : undefined,
  );

  // Formbeispiele aus den Würfel-Listen des Genres. Der Warnsatz steht
  // **zweimal** – davor und danach –, weil dies der einzige Block im Prompt
  // ist, der konkretes, fertig formuliertes Material enthält: Was hier steht,
  // ist genau die Sorte Text, die auch die Antwort sein soll, und damit die
  // größte Versuchung zum Abschreiben im ganzen Prompt.
  const beispielBlock = beispiele
    ? `
Beispiele für die **Form** dieser drei Felder – aus einer Zufallsliste, sie haben mit diesem Charakter nichts zu tun:

Orte:
${beispiele.orte.map((s) => `- ${s}`).join("\n")}

Zeiten:
${beispiele.zeiten.map((s) => `- ${s}`).join("\n")}

Regeln:
${beispiele.regeln.map((s) => `- ${s}`).join("\n")}

Beachte an ihnen die Machart: Jeder Ort nennt etwas Kaputtes, Verschwiegenes oder Unfertiges. Jede Regel gilt für alle und nennt niemanden beim Namen. **Übernimm nichts davon inhaltlich** – kein Ort, keine Zahl, kein Motiv aus diesen Zeilen darf in deiner Antwort auftauchen. Sie zeigen dir den Ton, nicht die Welt.
`
    : "";

  return `Entwirf das Szenario – die Welt –, in die dieser Charakter gehört.

Charakter: ${character.name}
${character.kurzbeschreibung}
${genreZeile}${settingZeile}
Merkmale:
${merkmale}

Beschreibung:
${character.beschreibung}
${hooksBlock}
Deine Aufgabe: Diese Person ist dein **Zeuge**, nicht dein Thema. Frage bei jeder Festlegung: Was muss in dieser Welt gelten, damit es einen solchen Menschen überhaupt geben kann? Schreib dann diese Bedingung auf – und nicht den Menschen.

Anforderungen an die einzelnen Felder:
- **name**: Ein kurzer, prägnanter Titel für das Szenario (2–5 Wörter). Benenne die **Welt oder den Ort**, nicht die Person – der Titel muss auch dann noch passen, wenn fünf weitere Figuren dazukommen.
- **ort**: Kein einzelner Schauplatz, sondern ein **Gebiet mit mehreren Orten**. Nenne zuerst den Rahmen (Land, Region, Stadt) in einem Satz: wovon er lebt und wo seine Grenzen verlaufen. Dann **zwei bis drei konkrete Orte** darin, an denen gespielt wird, je in einem Satz – und jeder mit einem Detail, das ihn kippen lässt: etwas Kaputtes, Verschwiegenes oder Unfertiges. Orte, die zueinander in Spannung stehen, sind besser als drei gleiche. Alles muss zum oben genannten Genre passen.
- **zeit**: Kein Zeitpunkt, sondern ein **Zeitraum**. Nenne die Epoche oder das Jahr als Rahmen und dazu die Spanne, über die sich Geschichten hier erstrecken – wenige Wochen, eine Saison, Jahre oder Jahrzehnte. Sag außerdem, **was sich in dieser Spanne verschiebt**: was am Anfang noch gilt und am Ende nicht mehr. Ein Zeitraum, in dem nichts in Bewegung ist, ist ein Zeitpunkt mit mehr Wörtern.
- **regeln**: Was in dieser Welt gilt und für **alle** Figuren darin wahr ist – Technikstand, Magie, gesellschaftliche und politische Ordnung, Tabus, Machtverhältnisse. Vollständige Sätze, jeder für sich verständlich.
- **beschreibung**: 2–3 kurze Absätze (ca. 600–900 Zeichen) über die Welt – Atmosphäre, Alltag, was diesen Ort zu dieser Zeit ausmacht. Konkret und sinnlich statt allgemein.
${beispielBlock}
Für alle Felder gilt:
- **Das Genre ist vorgegeben und nicht verhandelbar.** Ort, Zeit, Regeln und Beschreibung müssen erkennbar in diesem Genre spielen – auch dann, wenn der Charakter für sich genommen ebenso gut in ein anderes passen würde.
- **Prüfe jede Regel und jeden Ort so:** Wäre der Satz noch wahr, wenn diese Figur morgen wegzöge und nie wiederkäme? Wenn nein, streich ihn und schreib stattdessen die Bedingung auf, die dahintersteht. Aus „Handwerk wird hier hoch geachtet" wird so etwas, das auch ohne diese Handwerkerin gilt – oder es fällt weg.
- **Die Welt darf dem Charakter nicht widersprechen, muss aber nicht aus ihm bestehen.** Beruf, Herkunft und Hintergrund grenzen ein, was möglich ist; das meiste ergibt sich aus Genre, Ort und Zeit. Nimm dir dort die Freiheit, die die Figur dir lässt.
- Die Welt ist **größer als diese eine Figur**. Sie soll Platz für weitere Charaktere lassen: beschreibe Verhältnisse, nicht ihre persönliche Lage.
- Keine Handlung, kein Konflikt, keine Ereignisse – das kommt später und getrennt. Hier geht es um den Zustand der Welt.
- Alles auf Deutsch, nüchtern und ohne Kitsch, ohne Markdown.`;
}

/**
 * Baut den Prompt für einen einzelnen Namensvorschlag.
 *
 * Bewusst **sehr knapp**: hier zählt jedes Token, und für einen Namen sind
 * die meisten Formularfelder ohne Belang. Aussehen, Persönlichkeit und
 * „Weitere Wünsche" fließen deshalb gar nicht ein – sie machen den Prompt
 * teurer, ohne den Namen zu verbessern. Der Hintergrund wird gekürzt
 * mitgegeben, weil er oft das Entscheidende zum Nachnamen enthält
 * („Adelsfamilie aus Bath").
 *
 * Der lokale Würfel in `names.ts` deckt den Normalfall ab; dieser Prompt
 * existiert für das, was feste Listen nicht können – etwa eine im Freitext
 * angegebene Herkunft, für die es keine Liste gibt.
 */
export function buildNamePrompt(
  input: CharacterInput,
  /**
   * Merkmale eines bereits erzeugten Charakters (Galerie). Sie sind
   * konkreter als die Formular-Vorgaben – „britisch" schlägt ein leeres
   * Herkunftsfeld – und haben deshalb Vorrang.
   */
  traits?: CharacterTraits,
  /**
   * Gegenmittel gegen die Gleichförmigkeit: Namensverteilungen sind bei
   * gängigen Herkünften extrem „spitz", und identische Vorgaben liefern trotz
   * hoher Temperatur immer wieder den Prior-Kopf. `vorhandene` ist eine
   * **Ausschlussliste** (schon vorgeschlagene Namen – wähle einen anderen),
   * `initial` ein **zufälliger Anfangsbuchstabe**, der den Prompt dekorreliert
   * und das Modell in einen anderen Teil der Verteilung zwingt. Beide werden in
   * der **Route** gezogen, damit der Prompt-Baukasten deterministisch bleibt.
   */
  options: { vorhandene?: string[]; initial?: string } = {},
): string {
  const hintergrund = (input.background || "").trim().slice(0, 200);

  const geschlecht =
    traits?.geschlecht || (input.gender === "egal" ? "" : input.gender);
  const alter = traits ? String(traits.alter) : input.age;
  const herkunft = traits?.herkunft || input.ethnicity;

  const vorgaben =
    line("Geschlecht", geschlecht) +
    line("Alter", alter) +
    line("Herkunft/Ethnie", herkunft) +
    line("Setting/Genre", input.setting) +
    line("Beruf/Rolle", input.occupation) +
    line("Hintergrund", hintergrund);

  const ausschluss = options.vorhandene?.length
    ? `\nDiese Namen sind bereits vergeben oder wurden gerade vorgeschlagen – wähle einen **deutlich anderen** (anderer Vorname **und** Nachname):\n${options.vorhandene
        .map((n) => `- ${n}`)
        .join("\n")}\n`
    : "";

  const initialHinweis = options.initial
    ? `\n- Der **Vorname** soll möglichst mit „${options.initial}" beginnen; nur wenn das für die Herkunft unnatürlich wäre, weiche auf einen nahen, passenden Buchstaben aus.`
    : "";

  return `Erfinde einen vollständigen Namen (Vorname und Nachname) für einen Charakter mit diesen Vorgaben:

${vorgaben || "- (keine Vorgaben – wähle frei)\n"}${ausschluss}
Anforderungen:
- Authentisch zur Herkunft, aber **nicht** der naheliegendste Allerweltsname – trau dich zu selteneren, eigenständigen Namen.${initialHinweis}

Antworte mit nichts als dem Namen, ohne Anführungszeichen und ohne Erklärung.`;
}

/** Die Formularfelder, die sich per KI befüllen lassen (neben dem Namen). */
export type InputField =
  | "appearance"
  | "personality"
  | "occupation"
  | "background";

const INPUT_FIELD_LABELS: Record<InputField, string> = {
  appearance: "Aussehen",
  personality: "Persönlichkeit",
  occupation: "Beruf / Rolle",
  background: "Hintergrund",
};

/**
 * Die Aufgabe je Feld – bewusst auf denselben **Umfang und dieselbe Form** wie
 * der jeweilige Würfel gemünzt (s. `inspiration.ts`, `backgrounds.ts`,
 * `professions.ts`): Aussehen und Hintergrund mit **Semikolon** (die Einträge
 * enthalten selbst Kommas), Persönlichkeit mit Komma, Beruf ein einzelnes Wort.
 * So fügt sich das Ergebnis genauso ins Feld wie ein Wurf.
 */
const INPUT_FIELD_TASK: Record<InputField, string> = {
  appearance: `Nenne **4 bis 6 äußere Merkmale** – Haare, Augen, Statur, Haut, Kleidung, Auffälligkeiten. Stichwortartig, mit **Semikolon** getrennt (einzelne Merkmale dürfen ein Komma enthalten). Keine ganzen Sätze, keine Aufzählungszeichen.`,
  personality: `Nenne **3 bis 4 Wesenszüge**, mit Komma getrennt. Nur die Züge, kein ganzer Satz.`,
  occupation: `Nenne **einen einzigen** Beruf oder eine Rolle – nur die Bezeichnung, kein Satz, keine Beschreibung.`,
  background: `Nenne **1 bis 3 prägende Lebensstationen oder Ereignisse** als kurze Halbsätze, mit **Semikolon** getrennt. **Subjektlos** – beginne mit dem Verb, kein „Sie"/„Er" (z. B. „wuchs in einem Fischerdorf auf; verlor früh die Eltern").`,
};

/**
 * Baut den Prompt fürs **KI-Befüllen eines einzelnen Formularfeldes** (Aussehen,
 * Persönlichkeit, Beruf, Hintergrund). Das schlaue Gegenstück zum Würfel: Der
 * zieht kontextblind aus Listen, dieser liest die **übrigen ausgefüllten
 * Felder** und erzeugt etwas Stimmiges im selben Umfang wie ein Wurf.
 *
 * Das **Zielfeld selbst geht nicht mit** – der Knopf ersetzt seinen Inhalt (wie
 * der Würfel), und wiederholtes Klicken soll Varianten liefern statt den Text
 * anwachsen zu lassen. Das Genre steht immer im Kontext (Default „Gegenwart"),
 * ist also ein verlässlicher Anker, selbst wenn sonst nichts ausgefüllt ist.
 */
export function buildInputFieldPrompt(
  feld: InputField,
  input: CharacterInput,
): string {
  const geschlecht =
    input.gender && input.gender !== "egal" ? input.gender : "";

  // Alle übrigen Felder als Kontext, ohne das Zielfeld. `line` lässt leere weg.
  const nachbar: Array<[InputField | "andere", string, string]> = [
    ["andere", "Geschlecht", geschlecht],
    ["andere", "Alter", input.age],
    ["andere", "Herkunft/Ethnie", input.ethnicity],
    ["andere", "Setting", input.setting],
    ["occupation", "Beruf / Rolle", input.occupation],
    ["appearance", "Aussehen", input.appearance],
    ["personality", "Persönlichkeit", input.personality],
    ["background", "Hintergrund", input.background],
    ["andere", "Weitere Wünsche", input.notes],
  ];

  const kontext =
    line("Genre", genreLabel(input.genre)) +
    nachbar
      .filter(([owner]) => owner !== feld)
      .map(([, label, wert]) => line(label, wert))
      .join("");

  return `Fülle für einen Charakter das Feld „${INPUT_FIELD_LABELS[feld]}".

${INPUT_FIELD_TASK[feld]}

Diese Angaben stehen schon fest – dein Ergebnis muss dazu passen und darf ihnen nicht widersprechen:
${kontext}
Alles auf Deutsch. Antworte mit nichts als dem Inhalt für dieses eine Feld – keine Vorrede, keine Anführungszeichen, keine Beschriftung.`;
}

/**
 * Baut den Prompt für die **zufällige Figur** – das ganze Erstellen-Formular auf
 * einmal, als **Structured Output** (`randomInputSchema`).
 *
 * Der Kern ist die Regel „bereits Ausgefülltes bleibt, der Rest wird erfunden":
 * Die gesetzten Felder gehen als **feste Vorgabe** in den Prompt (und die Route
 * setzt sie danach ohnehin wieder darüber), die leeren sollen stimmig dazu
 * entstehen. Alles muss **zusammenpassen** – eine Figur, kein Zettelkasten.
 *
 * Das **Genre** ist ein Sonderfall: Das Formular hat immer eines gewählt (Default
 * „Gegenwart"), ein leeres gibt es nicht. Deshalb keine „ausfüllen, wenn leer"-
 * Regel, sondern „behalte das aktuelle, **wenn** es zum Konzept passt, sonst
 * wähle das passende" – so kippt eine bewusst gewählte Welt nicht grundlos, ein
 * bloß stehengebliebener Default aber schon.
 *
 * `freitext` ist die freie Vorgabe aus dem Modal: das Thema, dem die Figur folgen
 * soll. Leer = völliger Zufall.
 *
 * `genreWuerfeln` steuert das oben beschriebene Sonderproblem: Ist es **false**
 * (Standard), steht das aktuelle Genre **fest** und alle Felder müssen dazu
 * passen – so kippt eine bewusst gewählte Welt nie. Ist es **true**, wählt das
 * Modell das passende Genre frei aus der Liste (die Checkbox „Genre auch
 * zufällig wählen"). Das Formular hat immer ein Genre gewählt, ein „leeres" gibt
 * es nicht – deshalb diese ausdrückliche Wahl statt einer „ausfüllen, wenn
 * leer"-Regel.
 */
export function buildRandomInputPrompt(
  input: CharacterInput,
  freitext: string,
  genreWuerfeln = false,
): string {
  // „egal" beim Geschlecht heißt „überrasch mich" – dann ist es **nicht** fest,
  // sondern soll konkret gewählt werden.
  const geschlechtFest =
    input.gender && input.gender !== "egal" ? input.gender : "";

  // Die füllbaren Textfelder in Anzeige-Reihenfolge. Ein gesetztes Feld ist
  // fest, ein leeres wird erfunden.
  const felder: Array<[string, string]> = [
    ["Name", input.name],
    ["Geschlecht", geschlechtFest],
    ["Alter", input.age],
    ["Herkunft / Ethnie", input.ethnicity],
    ["Aussehen", input.appearance],
    ["Setting", input.setting],
    ["Beruf / Rolle", input.occupation],
    ["Hintergrund", input.background],
    ["Persönlichkeit", input.personality],
    ["Weitere Wünsche", input.notes],
  ];

  const fest = felder.filter(([, wert]) => wert.trim());
  const offen = felder.filter(([, wert]) => !wert.trim());

  const festBlock = fest.length
    ? `Diese Felder sind bereits festgelegt und dürfen **nicht** geändert werden – alles Übrige muss zu ihnen passen:\n${fest
        .map(([label, wert]) => `- ${label}: ${wert.trim()}`)
        .join("\n")}\n`
    : "Es ist noch nichts festgelegt – erfinde die ganze Figur frei.\n";

  const offenBlock = offen.length
    ? `\nDiese Felder sollst du stimmig ausfüllen:\n${offen
        .map(([label]) => `- ${label}`)
        .join("\n")}\n`
    : "";

  const genreliste = GENRE_TEMPLATES.map(
    (g) => `${g.id} (${g.label})`,
  ).join(", ");

  const themaBlock = freitext.trim()
    ? `\nVorgabe für die Figur – die ganze Figur soll dazu passen:\n${freitext.trim()}\n`
    : "\nEs gibt keine besondere Vorgabe – überrasch mit einer originellen, in sich stimmigen Figur.\n";

  // Zwei Fassungen: festes Genre (Default) oder frei gewählt (Checkbox). In
  // beiden Fällen erzwingt die Route den Wert zusätzlich – der Prompt sorgt nur
  // dafür, dass die übrigen Felder zum richtigen Genre passen.
  const genreBlock = genreWuerfeln
    ? `Zum **Genre**: Wähle das am besten zur Figur passende aus dieser Liste (gib die Id im Feld „genre" zurück): ${genreliste}. Alle Felder müssen zum gewählten Genre passen.`
    : `Zum **Genre**: Die Figur spielt im Genre „${genreLabel(input.genre)}" (${input.genre}) – das steht **fest** und darf nicht gewechselt werden. Gib im Feld „genre" genau „${input.genre}" zurück, und alle Felder müssen zu diesem Genre passen.`;

  return `Erfinde eine **vollständige, in sich stimmige** Figur und fülle damit ein Charakter-Formular. Es entsteht **noch kein** Beschreibungstext – nur die Vorgaben, wie sie ein Mensch ins Formular tippen würde: knapp und konkret.

${festBlock}${offenBlock}${themaBlock}
${genreBlock}

Anforderungen:
- Alle Felder ergeben **eine** Figur – Beruf, Herkunft, Aussehen und Wesen greifen ineinander und passen zu Genre und Setting.
- Jeder Wert ist **knapp** wie eine Formulareingabe: Name aus Vor- und Nachname; Alter kurz; Aussehen ein bis zwei Sätze (Haare, Augen, Statur, Kleidung); Setting wenige Worte; Beruf eine Rolle; Hintergrund zwei bis drei Sätze; Persönlichkeit einige Wesenszüge; „Weitere Wünsche" eine einzelne prägende Eigenheit.
- Das Geschlecht ist konkret (weiblich, männlich oder divers), nie „egal".
- Alles auf Deutsch.`;
}

/**
 * Baut den Prompt für ein **zufälliges Szenario** – das Anlege-Formular auf
 * einmal, als **Structured Output** (`randomScenarioSchema`). Das Gegenstück zu
 * `buildRandomInputPrompt` beim Charakter, mit denselben zwei Regeln:
 * bereits Ausgefülltes bleibt (feste Vorgabe im Prompt, von der Route erzwungen),
 * und das Genre bleibt fest, außer `genreWuerfeln` erlaubt die freie Wahl.
 *
 * Erzeugt wird die **Welt**, nicht die Geschichte darin: Name, Ort, Zeit, Regeln
 * und Beschreibung. **Kein Handlungsentwurf** – der braucht Figuren.
 */
export function buildRandomScenarioPrompt(
  name: string,
  details: {
    genre?: string;
    ort?: string;
    zeit?: string;
    regeln?: string;
    beschreibung?: string;
    figuren?: string;
    handlungselemente?: string;
  },
  freitext: string,
  genreWuerfeln = false,
): string {
  const felder: Array<[string, string]> = [
    ["Name", name],
    ["Ort", details.ort ?? ""],
    ["Zeit", details.zeit ?? ""],
    ["Regeln", details.regeln ?? ""],
    ["Beschreibung", details.beschreibung ?? ""],
    ["Figuren", details.figuren ?? ""],
    ["Handlungselemente", details.handlungselemente ?? ""],
  ];

  const fest = felder.filter(([, wert]) => wert.trim());
  const offen = felder.filter(([, wert]) => !wert.trim());

  const festBlock = fest.length
    ? `Diese Felder sind bereits festgelegt und dürfen **nicht** geändert werden – alles Übrige muss zu ihnen passen:\n${fest
        .map(([label, wert]) => `- ${label}: ${wert.trim()}`)
        .join("\n")}\n`
    : "Es ist noch nichts festgelegt – erfinde die Welt frei.\n";

  const offenBlock = offen.length
    ? `\nDiese Felder sollst du stimmig ausfüllen:\n${offen
        .map(([label]) => `- ${label}`)
        .join("\n")}\n`
    : "";

  const genreliste = GENRE_TEMPLATES.map(
    (g) => `${g.id} (${g.label})`,
  ).join(", ");
  const aktuellesGenre = details.genre?.trim() || DEFAULT_GENRE;

  const themaBlock = freitext.trim()
    ? `\nVorgabe für das Szenario – die ganze Welt soll dazu passen:\n${freitext.trim()}\n`
    : "\nEs gibt keine besondere Vorgabe – überrasch mit einer originellen, in sich stimmigen Welt.\n";

  const genreBlock = genreWuerfeln
    ? `Zum **Genre**: Wähle das am besten zur Welt passende aus dieser Liste (gib die Id im Feld „genre" zurück): ${genreliste}. Alle Felder müssen zum gewählten Genre passen.`
    : `Zum **Genre**: Die Welt spielt im Genre „${genreLabel(aktuellesGenre)}" (${aktuellesGenre}) – das steht **fest** und darf nicht gewechselt werden. Gib im Feld „genre" genau „${aktuellesGenre}" zurück, und alle Felder müssen zu diesem Genre passen.`;

  return `Erfinde ein **vollständiges, in sich stimmiges Szenario** – eine Welt, in der Geschichten spielen können – und fülle damit ein Formular. Es entstehen die Festlegungen, wie sie ein Mensch einträgt.

${festBlock}${offenBlock}${themaBlock}
${genreBlock}

Anforderungen:
- Alle Felder ergeben **eine** Welt – Ort, Zeit, Regeln und Beschreibung greifen ineinander und passen zum Genre.
- **Name**: kurz und treffend (2–5 Wörter), kein ganzer Satz.
- **Ort**: ein Gebiet – ein Rahmen (Stadt, Landstrich, Station) und zwei bis drei Schauplätze darin, jeder mit einer Reibungsfläche. Kein einzelner Punkt.
- **Zeit**: ein Zeitraum – ein Rahmen (Epoche, Jahreszeit) und eine Spanne, über die sich etwas verschiebt. Kein bloßes Datum.
- **Regeln**: vollständige Sätze über den Technik-/Weltenstand, mit Leerzeichen verbunden. Keine Zahlen, keine Eigennamen – zwei Regeln müssen nebeneinander stehen können.
- **Beschreibung**: zwei bis drei Absätze, konkret und sinnlich (Atmosphäre, Alltag), ohne den übrigen Feldern zu widersprechen.
- **Figuren**: zwei bis vier wichtige Personen, um die es gehen könnte – je Zeile ein Name und ein bis zwei Sätze zu Rolle, Wesen und einem Riss (ein Wunsch, ein Geheimnis, ein Konflikt). Noch keine ausgearbeiteten Charaktere, sondern Anhaltspunkte, aus denen später ein Handlungsentwurf entsteht. Sie müssen in diese Welt passen.
- **Handlungselemente**: ein bis drei knappe Bausteine für eine mögliche Geschichte – je Zeile eines: ein Konflikt, ein Ereignis, ein Geheimnis, ein Ziel oder eine Wendung. Enthält die Vorgabe oben Ansätze zur Handlung, halte **genau diese** hier fest; sonst schlage passende vor. Noch kein ausgearbeiteter Handlungsentwurf, sondern Ausgangspunkte für einen.
- Alles auf Deutsch.`;
}

/**
 * Die Welt, in der ein Bild spielt – je Genre-Id aus `templates.ts`.
 *
 * Der Bild-Prompt war vorher fest auf Gegenwart verdrahtet („Contemporary,
 * present-day clothing", „a fitting modern real-world environment"). Das ist
 * genau eines von neun Genres: Eine Fantasy-Figur bekam eine Straßenszene und
 * einen Mantel von heute, obwohl im Text eine Burg stand. Der Stil bestimmt,
 * **wie** gemalt wird, das Genre **was** zu sehen ist – erst beides zusammen
 * ergibt ein passendes Bild.
 *
 * Anders als bei den Würfeln in `backgrounds.ts` liegt hier **kein** eigener
 * Vorrat je Genre, sondern vier Textbausteine: Die Stilbeschreibungen bleiben
 * dieselben Sätze, nur die Welt darin wechselt. Ein neues Genre kostet damit
 * einen Eintrag und keine neue Stilbeschreibung.
 */
type Bildwelt = {
  /** Epoche für Kleidung und Ausstattung, ohne Punkt am Ende. */
  epoche: string;
  /** Umgebung, wie sie in den meisten Bausteinen steht. */
  umgebung: string;
  /**
   * Dieselbe Umgebung für die Illustration. Existiert **nur**, weil der
   * Gegenwarts-Prompt dort „real-world" sagt und zeichengenau erhalten bleiben
   * muss; für Fantasy oder Science Fiction wäre „real-world" schlicht falsch.
   * Bei allen anderen Genres steht deshalb dasselbe wie in `umgebung`.
   */
  umgebungIllu: string;
  /** Beispielschauplätze, die zum Genre passen. */
  orte: string;
  /**
   * Kleidungshinweis für die Büste („Skizze"), die keine Umgebung zeigt und
   * die Welt deshalb allein über die Kleidung transportiert.
   *
   * Bei Gegenwart **leer**: Der bisherige Skizzen-Prompt sagt zur Epoche
   * nichts, und er bleibt unverändert. Das kostet dort auch nichts – ohne
   * Angabe malen die Modelle ohnehin Gegenwart.
   */
  bueste: string;
};

const BILDWELTEN: Record<string, Bildwelt> = {
  gegenwart: {
    epoche: "Contemporary, present-day",
    umgebung: "modern environment",
    umgebungIllu: "modern real-world environment",
    orte: "a city street, workplace, studio or interior",
    bueste: "",
  },
  fantasy: {
    epoche: "High-fantasy, medieval-inspired",
    umgebung: "high-fantasy environment",
    umgebungIllu: "high-fantasy environment",
    orte: "a castle hall, a market town, a forest road or a candlelit chamber",
    bueste:
      "Clothing is high-fantasy and medieval-inspired: wool, linen, leather, simple metal fittings — no modern garments.",
  },
  steampunk: {
    epoche: "Victorian-industrial steampunk",
    umgebung: "steampunk environment",
    umgebungIllu: "steampunk environment",
    orte: "a brass-fitted workshop, an airship deck, a gaslit street or a cluttered laboratory",
    bueste:
      "Clothing is Victorian-industrial steampunk: waistcoats, leather, brass fittings, goggles — no modern garments.",
  },
  cyberpunk: {
    epoche: "Near-future cyberpunk",
    umgebung: "cyberpunk environment",
    umgebungIllu: "cyberpunk environment",
    orte: "a neon-lit street at night, a cramped apartment, a back-alley clinic or a corporate lobby",
    bueste:
      "Clothing is near-future cyberpunk: technical fabrics, worn synthetics, subtle visible implants — nothing historical.",
  },
  historisch: {
    epoche: "Historical, period-appropriate",
    umgebung: "historical period environment",
    umgebungIllu: "historical period environment",
    orte: "a cobbled street, a workshop, a manor interior or a harbour front",
    bueste:
      "Clothing is historical and period-appropriate — nothing modern, no contemporary garments.",
  },
  western: {
    epoche: "19th-century American frontier",
    umgebung: "Old West frontier environment",
    umgebungIllu: "Old West frontier environment",
    orte: "a dusty main street, a saloon interior, a ranch yard or open prairie",
    bueste:
      "Clothing is 19th-century frontier: worn cotton and leather, neckerchief, wide-brimmed hat — nothing modern.",
  },
  scifi: {
    epoche: "Far-future science-fiction",
    umgebung: "science-fiction environment",
    umgebungIllu: "science-fiction environment",
    orte: "a starship corridor, a research station, a colony settlement or a docking bay",
    bueste:
      "Clothing is far-future science fiction: functional jumpsuits, sleek technical fabrics, utility gear — nothing historical.",
  },
  maerchen: {
    epoche: "Timeless fairy-tale",
    umgebung: "fairy-tale environment",
    umgebungIllu: "fairy-tale environment",
    orte: "a deep forest, a thatched cottage, a watermill or a snowy village lane",
    bueste:
      "Clothing is timeless fairy-tale: simple homespun cloth, aprons, cloaks, worn boots — nothing modern.",
  },
  superhelden: {
    epoche: "Contemporary comic-book superhero",
    umgebung: "modern comic-book city environment",
    umgebungIllu: "modern comic-book city environment",
    orte: "a city rooftop at dusk, a busy street, a back alley or a laboratory interior",
    bueste:
      "Clothing is contemporary comic-book superhero: either a costume or an everyday outfit with a heroic edge.",
  },
};

/**
 * Baut den Prompt für die Bildgenerierung aus den generierten Merkmalen.
 */
export function buildImagePrompt(
  character: GeneratedCharacter,
  imageStyle: string,
  options: {
    includeTraits?: boolean;
    visualDetails?: string;
    extraPrompt?: string;
    /**
     * Genre-Id des Charakters (`input.genre`). Eine unbekannte oder fehlende
     * Id fällt auf Gegenwart zurück – dieselbe Regel wie bei den Würfeln, und
     * hier zusätzlich die Garantie, dass Altbestände denselben Prompt
     * bekommen wie bisher.
     */
    genre?: string;
  } = {},
): string {
  const { includeTraits = true, visualDetails, extraPrompt } = options;
  const m = character.merkmale;
  const welt = BILDWELTEN[options.genre ?? ""] ?? BILDWELTEN[DEFAULT_GENRE];

  const stilBeschreibung: Record<string, string> = {
    illustration: `Stylized modern character concept art, in the style of high-end digital concept art / movie key art (Leonardo Kino XL look). Clearly an illustration and NOT a photograph: visible digital brushwork and painterly rendering, slightly stylized and idealized features and shapes, artistic illustrative shading rather than photoreal pores and skin texture. Still polished, detailed and with good anatomy. ${welt.epoche} clothing and styling. Cinematic lighting and rich, slightly heightened color grading. The character is set within a fitting ${welt.umgebungIllu} that suits their background and personality (e.g. ${welt.orte}), rendered in the same illustrative style, with natural depth of field and atmosphere — NOT an empty studio backdrop.`,
    malerisch: `Expressive painterly portrait, in the style of a fine-art oil / gouache painting. Clearly a hand-painted artwork with visible brush strokes, thick impasto texture, blended colors and an artistic, slightly loose rendering — NOT a photograph and not a clean digital render. Rich, harmonious color palette and warm painterly lighting. ${welt.epoche} clothing. The character is set within a fitting ${welt.umgebung} rendered in the same loose painterly manner, with soft atmospheric depth.`,
    fotorealistisch: `Photorealistic portrait photograph. Shot on a full-frame camera, natural lighting, shallow depth of field, sharp focus, realistic skin texture and pores, high detail. ${welt.epoche} setting. Looks like a real photograph, not an illustration.`,
    // Die Büste zeigt keine Umgebung – die Welt steckt hier allein in der
    // Kleidung, und bei Gegenwart ist der Zusatz leer (Prompt wie bisher).
    skizze: `Soft painted character study, like a digital sketch in gouache or matte oil. Muted, warm earthy palette (ochre, cream, olive, soft browns) with gentle, diffuse light and no dramatic contrast or color grading. Visible dry brush strokes and loose, sketchy edges — the painting fades out towards the borders and looks slightly unfinished, on a subtly textured paper-like surface. Calm, quiet, intimate mood. Clearly a hand-painted study, NOT a photograph and NOT polished concept art.${welt.bueste ? ` ${welt.bueste}` : ""}`,
  };
  const stil = stilBeschreibung[imageStyle] || stilBeschreibung.illustration;

  // Bildaufbau je Stil. „Skizze" ist bewusst ohne Umgebung – das ist der Kern
  // dieses Looks und würde sonst von der Standard-Vorgabe überschrieben.
  const framingBeschreibung: Record<string, string> = {
    skizze:
      "Framing: head-and-shoulders bust portrait, centered, the character calmly facing the viewer. Plain, unadorned warm paper-toned background with soft painterly texture — NO scenery, NO room, NO environment and no depth of field. Only one person in the image, no text, no watermark.",
  };
  const framing =
    framingBeschreibung[imageStyle] ||
    `Framing: half-body / upper-body composition with a natural, candid pose (the character may look slightly off-camera). The fitting ${welt.umgebung} is visible behind them with depth of field. Only one person in the image, no text, no watermark.`;

  // Ohne Umgebung (Skizze) darf der Kontext nur Kleidung und Ausstrahlung
  // steuern – sonst zieht er doch wieder einen Schauplatz ins Bild.
  const kontext = character.kurzbeschreibung
    ? imageStyle === "skizze"
      ? `\nCharacter context (use it for clothing, expression and mood only, not for any background): ${character.kurzbeschreibung}\n`
      : `\nScene context (use it to choose a fitting ${welt.umgebung} and outfit): ${character.kurzbeschreibung}\n`
    : "";

  const merkmaleBlock = includeTraits
    ? `
Character details:
- Name: ${character.name}
- Age: ${m.alter} years
- Gender: ${m.geschlecht}
- Height/build: ${m.groesse}, ${m.koerperbau}
- Hair: ${m.haarfarbe}, ${m.frisur}
- Eyes: ${m.augenfarbe}
- Skin tone: ${m.hautton}
- Origin: ${m.herkunft}
- Distinguishing features: ${m.besondereMerkmale}
- Personality: ${m.persoenlichkeit}
Let this personality clearly show in the character's facial expression, gaze, posture and body language.`
    : `
Character: ${character.name}.`;

  const detailsBlock = visualDetails
    ? `
Additional visual details taken from the character description (clothing, environment, props, mood): ${visualDetails}`
    : "";

  const extraBlock = extraPrompt?.trim()
    ? `
Additional instructions from the user (important – incorporate these even if they add attributes not mentioned above): ${extraPrompt.trim()}`
    : "";

  return `Portrait of a single human character. ${stil}.
${kontext}${merkmaleBlock}${detailsBlock}${extraBlock}

${framing}`;
}

/**
 * Baut den Prompt, der die **Personen aus einem Handlungsentwurf** heraussucht.
 *
 * Der Handlungsentwurf entsteht aus den Figuren eines Szenarios, erfindet dabei
 * aber regelmäßig weitere: den Vorgesetzten, die Schwester, den Mann am Hafen.
 * Diese Personen sind bisher eine Sackgasse gewesen – sie stehen im Text, und
 * wer sie anlegen wollte, musste alles von Hand ins Formular übertragen.
 *
 * Die **bereits zugeordneten Namen gehen mit**, und zwar als Ausschlussliste:
 * Gesucht ist, wer im Entwurf vorkommt und noch **nicht** zum Szenario gehört.
 * Der Abgleich dort statt hier im Code zu machen ist Absicht – ein Entwurf
 * nennt „Thora" auch dann, wenn die Figur „Thora Eisenbach" heißt, und ein
 * Zeichenvergleich würde sie für eine zweite Person halten.
 *
 * Extrahiert wird **nur, was dasteht**. Der Prompt verlangt ausdrücklich leere
 * Felder statt Erfindungen: Was hier entsteht, sind die *Vorgaben* für einen
 * Charakter, und die sollen aus dem Entwurf stammen. Ausgedacht wird später,
 * beim Erzeugen des Charakters – dort gehört es hin und ist sichtbar.
 */
export function buildPlotPersonsPrompt(
  handlung: string,
  /** Namen der Figuren, die dem Szenario schon zugeordnet sind. */
  bekannte: string[],
): string {
  const bekanntBlock = bekannte.length
    ? `Diese Figuren gehören bereits zum Szenario:
${bekannte.map((n) => `- ${n}`).join("\n")}

- Sie sind **nicht** gesucht. Lass sie weg, auch wenn der Entwurf sie nur mit dem Vornamen oder einer Kurzform nennt („Thora" für „Thora Eisenbach").
- Erkenne dabei auch abweichende Schreibweisen und Beugungen als dieselbe Person.
`
    : "Dem Szenario ist bisher niemand zugeordnet – alle genannten Personen sind gesucht.\n";

  return `Finde in diesem Handlungsentwurf alle **Personen**, die noch nicht zum Szenario gehören.

Handlungsentwurf:
${handlung.trim()}

${bekanntBlock}
Was zählt als Person:
- Ein benannter Mensch mit einer Rolle in der Handlung.
- **Keine** Gruppen („die Ratsversammlung", „die Dorfbewohner"), keine Orte, keine Organisationen, keine Gegenstände.
- Keine Person, die nur als Rolle ohne Namen vorkommt („ein Bote", „die Wirtin") – ohne Namen lässt sie sich später nicht wiederfinden.
- Im Deutschen ist jedes Substantiv großgeschrieben. Großschreibung allein macht ein Wort **nicht** zu einem Namen: „Der Schmied Bengt" enthält genau einen Namen.

Für jede gefundene Person:
- **name**: exakt die Schreibweise aus dem Text, im Nominativ. Nennt der Entwurf Vor- und Nachnamen, gib beide an.
- **geschlecht**: „weiblich", „männlich" oder „divers" – nur wenn der Text es hergibt (Pronomen, Anrede, Endungen). Sonst leer.
- **alter**, **beruf**, **hintergrund**, **persoenlichkeit**, **aussehen**: nur, was der Entwurf tatsächlich sagt.

Wichtig: **Erfinde nichts.** Sagt der Entwurf zum Aussehen nichts, bleibt das Feld leer. Ein leeres Feld ist richtig, eine plausible Erfindung ist falsch – diese Angaben werden später als Vorgaben angezeigt, und was darin steht, soll aus dem Entwurf stammen.

Kommt keine neue Person vor, gib eine leere Liste zurück.
Alle Angaben auf Deutsch.`;
}

/**
 * Baut den Prompt für die **Personensuche im Figuren-Feld** eines Szenarios –
 * das Gegenstück zu `buildPlotPersonsPrompt`, aber für die **Notizen zu
 * wichtigen Figuren** statt für einen Handlungsentwurf.
 *
 * Ein wichtiger Unterschied: Der Plot-Prompt lässt **namenlose Rollen** bewusst
 * weg („ein Bote" ließe sich im Fließtext später nicht wiederfinden). Hier ist
 * das Feld selbst die Quelle, und der Nutzer will ausdrücklich **auch
 * Bezeichnungen**, die für eine Person stehen („die Hafenmeisterin", „der alte
 * Schmied"). Steht kein Eigenname da, wird die Bezeichnung selbst zum `name` –
 * im Formular lässt er sich noch ändern.
 */
export function buildFigurePersonsPrompt(
  figuren: string,
  /** Namen der Figuren, die dem Szenario schon zugeordnet sind. */
  bekannte: string[],
): string {
  const bekanntBlock = bekannte.length
    ? `Diese Figuren gehören bereits zum Szenario:
${bekannte.map((n) => `- ${n}`).join("\n")}

- Sie sind **nicht** gesucht. Lass sie weg, auch wenn die Notizen sie nur mit dem Vornamen oder einer Kurzform nennen („Thora" für „Thora Eisenbach").
- Erkenne dabei auch abweichende Schreibweisen und Beugungen als dieselbe Person.
`
    : "Dem Szenario ist bisher niemand zugeordnet – alle genannten Personen sind gesucht.\n";

  return `Finde in diesen Notizen zu wichtigen Figuren alle **Personen**, die noch nicht zum Szenario gehören.

Notizen (Figuren-Feld des Szenarios):
${figuren.trim()}

${bekanntBlock}
Was zählt als Person:
- Ein **einzelner Mensch** – mit Eigennamen („Bengt Eisenhauer") **oder** nur mit einer Bezeichnung, die für **eine bestimmte Person** steht („der alte Schmied", „die Hafenmeisterin", „ein geheimnisvoller Fremder").
- **Keine** Gruppen („die Ratsversammlung", „die Dorfbewohner"), keine Orte, keine Organisationen, keine Gegenstände.
- Im Deutschen ist jedes Substantiv großgeschrieben. Großschreibung allein macht ein Wort **nicht** zu einer Person: „Der Schmied Bengt am Hafen" ist **eine** Person (Bengt), nicht drei.

Für jede gefundene Person:
- **name**: Hat sie einen Eigennamen, gib ihn exakt an (Vor- und Nachname, wenn genannt), im Nominativ. Steht **nur** eine Bezeichnung da, gib **diese** als Name an (z. B. „Die Hafenmeisterin") – sie lässt sich im Formular noch ändern.
- **beruf**: die Rolle oder Funktion, wenn die Notiz eine nennt (auch die Bezeichnung selbst, wenn sie eine Rolle ist).
- **geschlecht**: „weiblich", „männlich" oder „divers" – nur wenn die Notiz es hergibt (Artikel, Endung, Anrede). Sonst leer.
- **alter**, **hintergrund**, **persoenlichkeit**, **aussehen**: nur, was die Notiz tatsächlich sagt.

Wichtig: **Erfinde nichts.** Sagt die Notiz zum Aussehen nichts, bleibt das Feld leer. Ein leeres Feld ist richtig, eine plausible Erfindung ist falsch – diese Angaben werden später als Vorgaben angezeigt, und was darin steht, soll aus den Notizen stammen.

Kommt keine neue Person vor, gib eine leere Liste zurück.
Alle Angaben auf Deutsch.`;
}

/**
 * Baut den Prompt für das **Ergänzen einer einzelnen Festlegung** eines
 * Szenarios (Ort, Zeit oder Regeln).
 *
 * Der Unterschied zum Würfel: Der zieht aus Listen und weiß nicht, was schon
 * dasteht – „Berlin" und ein Dorfgasthof können nebeneinander landen. Dieser
 * Prompt bekommt beides: **was im Feld selbst steht** und **was in den
 * erlaubten Nachbarfeldern steht** (`SCENARIO_READS`, gefiltert von der Route).
 * Das ist genau das, was eine feste Liste prinzipiell nicht kann.
 *
 * **Das Vorhandene ist Vorgabe, nicht Vorschlag.** Es geht wörtlich in den
 * Prompt und bleibt unangetastet – dieselbe Regel wie bei `regenerate-text`,
 * wo Name und Merkmale eingehen und nicht verändert werden. Ein Knopf, der
 * „Berlin" durch „Hamburg" ersetzt, weil das besser zu seinem Einfall passt,
 * wäre unbrauchbar. Deshalb heißt er „ergänzen" und nicht „erzeugen".
 */
export function buildScenarioFieldPrompt(
  feld: "ort" | "zeit" | "regeln",
  name: string,
  /** Nur die Felder, die dieses Feld laut `SCENARIO_READS` lesen darf. */
  umfeld: Partial<Record<string, string>>,
  /** Was im Feld selbst steht – darf leer sein. */
  vorhanden: string,
  zusatz?: string,
  /**
   * Höchstlänge des Feldes in Zeichen (`SCENARIO_MAXLENGTHS[feld]`). Bei
   * „ergänzen" enthält die Antwort das Vorhandene **mit** – die ganze Antwort
   * muss also ins Feld passen, nicht nur das Neue. Steht sie im Prompt, hält
   * sich das Modell meist daran; die Route deckelt zusätzlich `max_tokens`.
   */
  maxLen?: number,
): string {
  const kontext =
    line("Szenario", name) +
    line("Genre", umfeld.genre ? genreLabel(umfeld.genre) : undefined) +
    line("Ort", umfeld.ort) +
    line("Zeit", umfeld.zeit) +
    line("Regeln", umfeld.regeln);

  const bestand = vorhanden.trim();

  // Die Aufgabe je Feld. Zwei Fassungen: mit und ohne Bestand – die Aufgabe
  // ist eine andere, nicht bloß eine Abwandlung. „Fülle auf, was fehlt" an ein
  // leeres Feld gerichtet ergäbe nichts.
  const AUFGABE = {
    ort: {
      leer: `Entwirf den **Ort** dieses Szenarios: zuerst den Rahmen (Land, Region, Stadt) in einem Satz – wovon er lebt und wo seine Grenzen verlaufen –, dann zwei bis drei konkrete Schauplätze darin, je in einem Satz.`,
      // Als **Endzustand** formuliert und nicht als Verfahren („prüfe erst,
      // dann ergänze"). Gemessen: Mit der Verfahrensfassung hängte das Modell
      // an „In einem anonymen Wohnblock" drei weitere Schauplätze an und ließ
      // den Rahmen weg – es klassifizierte gar nicht erst. Eine Bedingung, die
      // am fertigen Text prüfbar ist, hält besser als eine Anweisung, die
      // unterwegs eine Entscheidung verlangt.
      voll: `**Ergänze** den Ort dieses Szenarios. Am Ende muss im Feld **beides** stehen:

1. **ein Rahmen** – Land, Region oder Stadt: worin das Ganze spielt, wovon es lebt, wo seine Grenzen verlaufen;
2. **zwei bis drei Schauplätze darin**, je in einem Satz.

Sieh nach, was davon schon dasteht, und ergänze nur das Fehlende. Steht dort bloß ein Stadt- oder Ländername, fehlen die Schauplätze. Steht dort ein einzelner Ort – eine Werkstatt, ein Wohnblock, ein Gasthaus –, dann fehlt der **Rahmen**: Nenne zuerst die Stadt oder Gegend, in der er liegt und die zu ihm passt, und ergänze ein bis zwei weitere Orte auf seiner Höhe.`,
      regeln: `- Jeder Schauplatz nennt **ein Detail, das ihn kippen lässt**: etwas Kaputtes, Verschwiegenes oder Unfertiges. Ein Ort ohne Riss ist eine Kulisse.
- **Die richtige Höhe ist der öffentliche Ort, nicht die Adresse.** Ein Szenario hält fest, was für *alle* Figuren gilt; eine bestimmte Wohnung ist der Schauplatz einer Szene und gehört nicht hierher. Prüfe jeden Ort so: Haben dort mehrere Menschen zu tun, die einander nicht kennen? Wenn nein, nimm die Ebene darüber.
- Orte, die zueinander in Spannung stehen, sind besser als drei gleichartige.`,
    },
    zeit: {
      leer: `Entwirf die **Zeit** dieses Szenarios: die Epoche oder das Jahr als Rahmen, die Spanne, über die sich Geschichten hier erstrecken (wenige Wochen bis Jahrzehnte), und was sich in dieser Spanne verschiebt.`,
      // Ebenfalls als Endzustand – aus demselben Grund wie beim Ort.
      voll: `**Ergänze** die Zeit dieses Szenarios. Am Ende muss im Feld **alles drei** stehen:

1. **der Rahmen** – Epoche, Jahr oder Jahreszeit;
2. **die Spanne**, über die sich Geschichten hier erstrecken: wenige Wochen, eine Saison, Jahre, Jahrzehnte;
3. **was sich in dieser Spanne verschiebt** – was am Anfang noch gilt und am Ende nicht mehr.

Sieh nach, was davon schon dasteht, und ergänze nur das Fehlende. Steht dort bloß eine Jahreszahl oder eine Jahreszeit, fehlen Spanne und Verschiebung.`,
      regeln: `- Die **Verschiebung** ist der Kern: Was gilt am Anfang noch und am Ende nicht mehr? Ein Zeitraum, in dem nichts in Bewegung ist, ist ein Zeitpunkt mit mehr Wörtern.
- Keine Handlung und keine Figuren – nur der Zustand der Welt und seine Bewegung.`,
    },
    regeln: {
      leer: `Entwirf die **Regeln** dieses Szenarios: was darin gilt und für **alle** Figuren wahr ist – Technikstand, Magie, gesellschaftliche und politische Ordnung, Tabus, Machtverhältnisse. Zwei bis vier Sätze.`,
      voll: `**Ergänze** die Regeln dieses Szenarios um ein bis zwei weitere. Sie müssen zu den vorhandenen passen, ohne sie zu wiederholen – eine Regel, die dasselbe in anderen Worten sagt, ist keine zweite.`,
      regeln: `- Vollständige Sätze, jeder für sich verständlich und ohne die anderen lesbar.
- Sie gelten für **alle**: keine Aussage über eine einzelne Person, keine Eigennamen, keine Jahreszahlen.
- Nichts über Ort und Zeit – dafür gibt es die anderen Felder.`,
    },
  }[feld];

  const bestandBlock = bestand
    ? `\nDas steht bereits im Feld und ist **Vorgabe, nicht Vorschlag** – übernimm es unverändert und baue darum herum:\n${bestand}\n`
    : "";

  const zusatzBlock = zusatz?.trim()
    ? `\nBesonders wichtig – zusätzliche Wünsche für dieses Feld:\n${zusatz.trim()}\n`
    : "";

  // Das Feld hat eine harte Obergrenze, und bei „ergänzen" zählt das Vorhandene
  // mit hinein – die **ganze** Antwort muss hineinpassen, nicht nur das Neue.
  // Deshalb der verbleibende Rest, nicht das volle Limit: Steht schon viel im
  // Feld, ist wenig Platz für Neues, und das Modell soll es wissen, bevor es
  // schreibt. Fällt der Rest knapp aus, wird die Grenze als „knapp" benannt –
  // eine reine Zahl verleitet das Modell, sie punktgenau auszureizen.
  const budgetBlock = maxLen
    ? (() => {
        const rest = maxLen - bestand.length;
        const knapp = rest < maxLen * 0.35;
        return `- **Länge:** Die gesamte Antwort (das Vorhandene eingeschlossen) muss unter ${maxLen} Zeichen bleiben.${
          bestand
            ? ` Für Neues sind damit noch etwa ${Math.max(rest, 0)} Zeichen frei${
                knapp ? " – fasse dich also knapp" : ""
              }.`
            : " Schreibe kompakt."
        }\n`
      })()
    : "";

  return `${bestand ? AUFGABE.voll : AUFGABE.leer}

Was über dieses Szenario schon feststeht:
${kontext || "- (noch nichts)\n"}${bestandBlock}
Anforderungen:
${AUFGABE.regeln}
${budgetBlock}- **Alles muss zu den Festlegungen oben passen.** Widersprich ihnen nie; wo sie schweigen, ergänze Stimmiges. Das Genre bindet dabei am stärksten: Was zu ihm nicht passt, gehört nicht hierher, auch wenn es für sich genommen gut wäre.
- Halte dich an die Welt, die schon dasteht: Nennt sie einen echten Ort, bleib bei echten; ist sie erfunden, erfinde weiter.
- Konkret und sinnlich statt allgemein – ein Geräusch, ein Geruch, eine Gewohnheit sagen mehr als ein Adjektiv.
- Auf Deutsch, nüchtern und ohne Kitsch.
${zusatzBlock}
Form der Antwort: ${
    feld === "regeln"
      ? "vollständige Sätze hintereinander, als Fließtext."
      : "**eine Zeile je Angabe**, durch Zeilenumbrüche getrennt, jede ein einzelner Satz."
  } Keine Nummerierung, keine Spiegelstriche, keine Doppelpunkt-Überschriften wie „Hafenviertel: …", kein Markdown, keine Einleitung und keine Erklärung. Antworte mit **nichts als dem fertigen Feldinhalt** – einschließlich des Vorhandenen, an der richtigen Stelle eingefügt.`;
}

/**
 * Baut den Prompt fürs **KI-Ergänzen des Figuren-Feldes** – ein Set von etwa
 * drei Figuren, passend zur ganzen Welt (Genre, Ort, Zeit, Regeln, Beschreibung).
 *
 * Das Gegenstück zum Würfel (`scenarioFigures.ts`): Der mischt Bausteine blind,
 * dieser liest die Festlegungen **und** die schon vorhandenen Figuren und macht
 * die neuen dazu passend. Wie bei `buildScenarioFieldPrompt` ist das Vorhandene
 * **Vorgabe, nicht Vorschlag**: Es geht wörtlich mit und bleibt unverändert;
 * ergänzt werden nur weitere Figuren.
 *
 * Die Form ist bewusst dieselbe wie beim Würfel und beim zufälligen Szenario –
 * „Name: was sie tut; woran sie kippt." –, damit sich die drei Quellen im Feld
 * mischen lassen, ohne dass ein Bruch entsteht.
 */
/** Eine bereits angelegte Person des Szenarios – Kontext für die Figuren-Erzeugung. */
export interface FigurCharakterKontext {
  name: string;
  kurzbeschreibung: string;
  isProtagonist: boolean;
}

export function buildScenarioFiguresPrompt(
  name: string,
  /** Nur die Felder, die `figuren` laut `SCENARIO_READS` lesen darf. */
  umfeld: Partial<Record<string, string>>,
  /** Was im Feld schon steht – bleibt unverändert und prägt die neuen Figuren. */
  vorhanden: string,
  zusatz?: string,
  /** Höchstlänge des Feldes (`SCENARIO_MAXLENGTHS.figuren`); die ganze Antwort zählt. */
  maxLen?: number,
  /** Wie viele Figuren erzeugt/ergänzt werden (Selektor am Feld). */
  anzahl = 3,
  /**
   * Die **schon angelegten Charaktere** des Szenarios (Protagonisten markiert).
   * Sie gehen als Kontext mit: neue Figuren sollen zu ihnen in Beziehung treten,
   * dürfen sie aber **nicht doppeln** – sonst erfindet das Modell einen bereits
   * bestehenden Charakter als Figur nochmal (z. B. wenn ein Stichwort ihn nennt).
   */
  charaktere: FigurCharakterKontext[] = [],
  /**
   * Frische Namens-Bausteine (Vor-/Nachnamen) aus dem genre-passenden
   * Kulturkreis (`namensBausteine` aus `names.ts`). Bricht die „Lieblingsnamen"
   * des Modells und erdet die Namen; je Aufruf ein anderer Satz.
   */
  bausteine?: { kultur: string; vornamen: string[]; nachnamen: string[] },
): string {
  const kontext =
    line("Szenario", name) +
    line("Genre", umfeld.genre ? genreLabel(umfeld.genre) : undefined) +
    line("Ort", umfeld.ort) +
    line("Zeit", umfeld.zeit) +
    line("Regeln", umfeld.regeln) +
    line("Beschreibung", umfeld.beschreibung);

  const charaktereBlock = charaktere.length
    ? `\n=== NUR KONTEXT – diese Zeilen NIEMALS ausgeben ===
In diesem Szenario sind folgende Personen bereits **als Charaktere angelegt** (keine Figuren-Notizen). Übernimm sie **nicht** in deine Antwort, erzeuge **keine** Figur mit einem dieser Namen. Die neuen Figuren sollen sich nur zu ihnen **verhalten** (Reibung, Abhängigkeit, gemeinsame Geschichte), besonders zu den Protagonist:innen (★):
${charaktere
        .map(
          (c) =>
            `  › ${c.name}${c.isProtagonist ? " (★ Protagonist:in)" : ""}${
              c.kurzbeschreibung.trim() ? `: ${c.kurzbeschreibung.trim()}` : ""
            }`,
        )
        .join("\n")}
=== ENDE KONTEXT ===\n`
    : "";

  const bestand = vorhanden.trim();

  const bestandBlock = bestand
    ? `\nDiese Figuren stehen schon fest – **übernimm sie wörtlich und unverändert** und ergänze weitere, die zu ihnen passen (gemeinsame Geschichte, Abhängigkeiten, Gegnerschaft sind willkommen):\n${bestand}\n`
    : "";

  const zusatzBlock = zusatz?.trim()
    ? `\nBesonders wichtig – berücksichtige diese Stichwörter:\n${zusatz.trim()}\n`
    : "";

  const namensBlock =
    bausteine && bausteine.vornamen.length
      ? `\nNamensvielfalt (wichtig): Greife **nicht** immer zu denselben Standardnamen. Bilde die Namen der neuen Figuren – sofern die Stichwörter keinen Namen vorgeben – aus diesen frischen Bausteinen (${bausteine.kultur}; Vor- und Nachname frei kombinierbar):\n- Vornamen: ${bausteine.vornamen.join(", ")}\n- Nachnamen: ${bausteine.nachnamen.join(", ")}\n`
      : "";

  const budgetBlock =
    bestand && maxLen
      ? (() => {
          const rest = maxLen - bestand.length - 1;
          const knapp = rest < 400;
          return `- Das ganze Feld – Vorhandenes **und** Neues – muss unter ${maxLen} Zeichen bleiben.${
            rest > 0
              ? ` Für die neuen Figuren sind noch etwa ${rest} Zeichen frei${
                  knapp ? " – ergänze also nur ein bis zwei" : ""
                }.`
              : " Es ist kaum Platz – ergänze höchstens eine sehr knappe Figur."
          }\n`;
        })()
      : "";

  return `${
    bestand
      ? "Ergänze die Besetzung eines Szenarios um weitere Figuren."
      : "Entwirf die Besetzung eines Szenarios: die Menschen, um die es in ihm gehen könnte."
  }

Was über dieses Szenario schon feststeht:
${kontext || "- (noch nichts)\n"}${charaktereBlock}${bestandBlock}
Anforderungen:
- ${
    bestand
      ? `Ergänze **${anzahl}** weitere ${anzahl === 1 ? "Figur" : "Figuren"}`
      : `Entwirf **${anzahl}** ${anzahl === 1 ? "Figur" : "Figuren"}`
  }, jede in **einer Zeile**.
- Form je Zeile: „Name: was die Figur in dieser Welt tut; und die Spannung, die in ihr steckt." – erst ein Name, dann ihre Rolle, dann nach einem Semikolon ihr **Riss**.
- Der **Riss** ist der Kern: eine Spannung, aus der eine Geschichte entstehen kann – etwas Verschwiegenes, Ersehntes oder Ungelöstes, ein Widerspruch, ein Ehrgeiz oder eine Sehnsucht. Er muss **nicht** dunkel oder tragisch sein und die Figur nicht „zerbrechen"; er soll sie interessant machen. **Variiere die Formulierung** – nicht immer „zerbricht an …". Ein bloßer Beruf ist kein Riss.
- Nennen die Stichwörter eine **Persönlichkeit oder Stimmung** (z. B. „positiv", „fröhlich", „loyal"), **verkörpert die Figur genau diese** – der Riss passt dann **dazu** und widerspricht ihr nicht: eine positive Figur bleibt positiv, ihre Spannung ist dann eher ein Wunsch, ein Ehrgeiz oder eine leise Sorge, kein Bruch.
- Die Namen passen zu Herkunft und Genre; die Figuren passen zueinander und zur Welt und bergen Reibung.
- **Alles muss zu den Festlegungen oben passen** – widersprich ihnen nie; das Genre bindet am stärksten.${
    charaktere.length
      ? "\n- Nenne **keine** neue Figur wie eine der oben gelisteten, bereits angelegten Personen. Nennt ein Stichwort eine solche Person, ist die neue Figur eine **andere** Person **mit Bezug zu ihr** – niemals diese Person selbst."
      : ""
  }
${namensBlock}${budgetBlock}${zusatzBlock}
Form der Antwort: **eine Figur je Zeile**, durch Zeilenumbrüche getrennt. Keine Nummerierung, keine Spiegelstriche, kein Markdown, keine Einleitung und keine Erklärung. Antworte mit **nichts als den Figuren-Zeilen**${
    bestand ? " – die vorhandenen zuerst, wörtlich, dann die neuen" : ""
  }.${
    charaktere.length
      ? " Die oben als Kontext gelisteten **Charaktere** gehören **nicht** in die Antwort."
      : ""
  }`;
}

/**
 * Baut den Prompt für das **Szenario-Bild** – einen Establishing-Shot der Welt.
 *
 * Der entscheidende Unterschied zum Charakter-Bild: Ein Szenario ist kein
 * Mensch, sondern ein **Ort zu einer Zeit**. Das Bild zeigt deshalb die
 * Umgebung und **keine Figuren** – nicht nur, weil das die Entscheidung war,
 * sondern weil ein Szenario für viele Figuren zugleich gilt und keine einzelne
 * es bebildern sollte. Das „keine Personen" steht daher betont und mehrfach im
 * Prompt: Bild-Modelle setzen sonst reflexhaft einen Menschen in die Szene.
 * Über `options.ohneMenschen` (Default an) lässt sich das abschalten – dann
 * fallen beide „keine Personen"-Stellen weg und der Prompt bleibt zur Frage der
 * Figuren neutral (fordert Menschen aber nicht aktiv ein).
 *
 * Wiederverwendet wird die Welt-Karte `BILDWELTEN` (Genre → Epoche, Umgebung,
 * Beispielorte) und dieselbe **Stilauswahl** wie beim Charakter
 * (`IMAGE_STYLES`); die Stiltexte sind hier aber auf eine **Szene** statt auf
 * ein Portrait gemünzt. „Skizze" zeigt beim Charakter eine Büste ohne Umgebung –
 * das ergäbe für ein Weltbild keinen Sinn, hier ist es eine lose gemalte
 * Landschaftsstudie.
 *
 * Quelle ist `ScenarioDetails`: **Ort** trägt das Motiv, **Zeit** und Genre die
 * Epoche, **Beschreibung** die Stimmung. Ort und Beschreibung können lang sein
 * (bis 2000 Zeichen mit mehreren Schauplätzen); für ein einzelnes Bild wird
 * daraus der Anfang genommen und das Modell angewiesen, **einen** Blick zu
 * wählen, nicht alle Schauplätze zugleich zu zeigen. Die **Regeln** gehen
 * bewusst nicht ein – Technikstand und Gesellschaftsordnung sind selten ein
 * Bildmotiv und lenken eher ab.
 */
export function buildScenarioImagePrompt(
  details: ScenarioDetails,
  imageStyle: string,
  options: { extraPrompt?: string; ohneMenschen?: boolean } = {},
): string {
  // Default an: die Welt ohne Figuren zeigen (bisheriges Verhalten). Aus =
  // die „keine Personen"-Einschränkung fällt aus dem Prompt; das Modell darf
  // dann Menschen setzen, wird aber nicht dazu aufgefordert.
  const ohneMenschen = options.ohneMenschen ?? true;
  const welt = BILDWELTEN[details.genre ?? ""] ?? BILDWELTEN[DEFAULT_GENRE];

  // Ort und Beschreibung tragen das Motiv bzw. die Stimmung, dürfen aber lang
  // sein. Für einen Bild-Prompt genügt der Anfang – der Rahmen steht vorn, die
  // einzelnen Schauplätze und Verschiebungen dahinter (s. Ableitungs-Prompt).
  const ort = details.ort.trim().slice(0, 600);
  const zeit = details.zeit.trim().slice(0, 300);
  const stimmung = details.beschreibung.trim().slice(0, 600);

  // Szenen-Stiltexte, parallel zu `buildImagePrompt`, aber auf eine Umgebung
  // statt ein Gesicht gemünzt.
  const stilBeschreibung: Record<string, string> = {
    illustration: `Stylized environment concept art, in the style of high-end digital concept art / movie key art. Clearly an illustration and NOT a photograph: visible digital brushwork and painterly rendering, slightly stylized and idealized shapes, artistic illustrative shading. Polished and detailed, with cinematic lighting, atmospheric depth and rich, slightly heightened color grading.`,
    malerisch: `Expressive painterly landscape, in the style of a fine-art oil / gouache painting. Clearly a hand-painted artwork with visible brush strokes, thick impasto texture and an artistic, slightly loose rendering — NOT a photograph. Rich, harmonious palette and warm painterly light, with soft atmospheric depth.`,
    fotorealistisch: `Photorealistic establishing photograph of a place. Shot on a full-frame camera, natural lighting, realistic textures and materials, high detail, deep depth of field. Looks like a real photograph, not an illustration.`,
    skizze: `Soft painted environment study, like a loose digital sketch in gouache or matte oil. Muted, warm earthy palette (ochre, cream, olive, soft browns) with gentle, diffuse light and no dramatic contrast. Visible dry brush strokes and loose, sketchy edges — the painting fades out towards the borders and looks slightly unfinished, on a subtly textured paper-like surface. Calm, quiet, intimate mood.`,
  };
  const stil = stilBeschreibung[imageStyle] || stilBeschreibung.illustration;

  const setzung =
    line("Place", ort) +
    line("Era / time", [zeit, welt.epoche].filter(Boolean).join(" — ")) +
    line("Mood and atmosphere", stimmung);

  const extraBlock = options.extraPrompt?.trim()
    ? `\nAdditional instructions from the user (important – incorporate these): ${options.extraPrompt.trim()}\n`
    : "";

  // „Keine Personen" doppelt: einmal als Bildinhalt, einmal als Rahmen. Das
  // Modell setzt sonst gern eine einzelne Figur als „Anker" in die Szene. Beide
  // Stellen fallen weg, wenn `ohneMenschen` aus ist – dann bleibt der Prompt zur
  // Frage der Figuren neutral (fordert sie aber nicht aktiv).
  const openerMenschen = ohneMenschen
    ? ", depicted as an empty scene with NO people"
    : "";
  const framingMenschen = ohneMenschen
    ? " Absolutely NO people, NO characters, NO figures, NO portraits, NO crowds — an unpopulated scene."
    : "";
  return `Establishing shot of a place — the world of a story${openerMenschen}. ${stil}
${setzung || `- A ${welt.umgebung} (e.g. ${welt.orte})\n`}${extraBlock}
Show a single, coherent view of this world — if several locations are described, choose ONE fitting vantage point rather than combining them. Convey the era through architecture, materials, vehicles and objects.

Framing: wide environmental / landscape composition, the place itself is the subject, with atmospheric depth.${framingMenschen} No text, no watermark, no labels.`;
}
