import { DEFAULT_STORY_HOOK_ANCHOR, TRAIT_LABELS } from "./schema";
import { DEFAULT_GENRE, genreLabel } from "./templates";
import type {
  CharacterInput,
  CharacterTraits,
  GeneratedCharacter,
  StoryHookAnchor,
} from "./schema";

/** Hilfsfunktion: nur ausgefüllte Vorgaben in den Prompt aufnehmen. */
function line(label: string, value?: string): string {
  const v = (value || "").trim();
  return v ? `- ${label}: ${v}\n` : "";
}

/**
 * Baut den Prompt für die Textgenerierung. Das Modell soll strukturiertes
 * JSON zurückgeben (via Structured Outputs), daher beschreibt der Prompt nur
 * Inhalt und Ton – nicht das Format.
 */
export function buildTextPrompt(input: CharacterInput): string {
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
    ? "- Ein vollständiger, zum Setting passender Name."
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
  },
  characters: PlotCharacter[],
  zusatz?: string,
): string {
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
      return [`${i + 1}. ${c.name}`, ...zeilen].join("\n");
    })
    .join("\n\n");

  const zusatzBlock = zusatz?.trim()
    ? `\nBesonders wichtig – zusätzliche Wünsche für diesen Entwurf:\n${zusatz.trim()}\n`
    : "";

  return `Entwirf die Handlung für ein Szenario: die Ausgangslage, aus der sich eine Geschichte zwischen diesen Figuren entwickeln kann.

Die Welt steht fest:
${welt}${weltText}
Diese Figuren gibt es, und nur diese:

${figuren}

Anforderungen:
- Drei bis vier kurze Absätze (insgesamt ca. 900–1400 Zeichen).
- **Erfinde keine neuen Hauptfiguren.** Arbeite mit den Genannten. Nebenfiguren dürfen vorkommen, aber die Handlung muss von diesen Personen getragen werden.
- Benenne, **wer was von wem will** und woran es sich entzündet. Ein Konflikt braucht mindestens zwei Personen mit unvereinbaren Absichten.
- Lies die Beschreibungen genau: Dort steht die Vorgeschichte, und dort liegen die Reibungsflächen zwischen den Figuren. Auch scheinbare Nebensachen aus den Merkmalen – Herkunft, eine Narbe, ein Hobby – taugen als Anknüpfungspunkt.
- Sind offene Ansatzpunkte genannt, greife sie auf und verbinde sie: Das Interessante entsteht dort, wo das Anliegen der einen die Wunde der anderen trifft.
- Nenne einen konkreten **Auslöser** – ein Ereignis, ein Termin, eine Nachricht –, der die Lage in Bewegung bringt.
- Alles muss den Regeln des Szenarios gehorchen. Was dort gilt, gilt auch hier.
- Kein fertiger Plot mit Auflösung: eine Ausgangslage mit offenem Ausgang. Schreibe nicht, wie es endet.
- Reiner Fließtext auf Deutsch, ohne Markdown, ohne Überschriften, ohne Aufzählung.
${zusatzBlock}
Antworte mit nichts als dem Entwurf selbst.`;
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

  return `Entwirf das Szenario – die Welt –, in die dieser Charakter gehört.

Charakter: ${character.name}
${character.kurzbeschreibung}
${genreZeile}${settingZeile}
Merkmale:
${merkmale}

Beschreibung:
${character.beschreibung}
${hooksBlock}
Deine Aufgabe: Leite aus dieser Person die Welt ab, in der sie lebt. Nicht irgendeine Welt, in der sie auch vorkommen könnte, sondern die, die sie hervorgebracht hat.

Anforderungen an die einzelnen Felder:
- **name**: Ein kurzer, prägnanter Titel für das Szenario (2–5 Wörter). Benenne die **Welt oder den Ort**, nicht die Person – der Titel muss auch dann noch passen, wenn fünf weitere Figuren dazukommen.
- **ort**: Wo diese Geschichte spielt. Konkret genug, dass man es sich vorstellen kann. Es muss zum oben genannten Genre passen.
- **zeit**: Epoche, Jahr oder Jahreszeit.
- **regeln**: Was in dieser Welt gilt und für **alle** Figuren darin wahr ist – Technikstand, Magie, gesellschaftliche Ordnung, Tabus, Machtverhältnisse. Vollständige Sätze. Keine Aussage über diesen einen Charakter: was nur für ihn gilt, ist keine Regel der Welt.
- **beschreibung**: 2–3 kurze Absätze (ca. 600–900 Zeichen) über die Welt – Atmosphäre, Alltag, was diesen Ort zu dieser Zeit ausmacht. Konkret und sinnlich statt allgemein.

Für alle Felder gilt:
- **Das Genre ist vorgegeben und nicht verhandelbar.** Ort, Zeit, Regeln und Beschreibung müssen erkennbar in diesem Genre spielen – auch dann, wenn der Charakter für sich genommen ebenso gut in ein anderes passen würde.
- **Jede Festlegung muss ihren Anhalt im Charakter haben.** Beruf, Herkunft, Hintergrund und besondere Merkmale sagen dir, wie diese Welt wirtschaftet, wo ihre Grenzen verlaufen und was in ihr möglich ist. Erfinde nichts, was der Figur widerspricht.
- Ergänze nur dort frei, wo der Charakter schweigt – und dann so, dass es zu ihm passt.
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

  return `Erfinde einen vollständigen Namen (Vorname und Nachname) für einen Charakter mit diesen Vorgaben:

${vorgaben || "- (keine Vorgaben – wähle frei)\n"}
Antworte mit nichts als dem Namen, ohne Anführungszeichen und ohne Erklärung.`;
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
