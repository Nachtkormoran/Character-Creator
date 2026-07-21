import { pickSome } from "./inspiration";

/**
 * **Kreative Impulse für den Story Arc.**
 *
 * Zufällige Anregungen, die – bei gesetztem „kreativ"-Haken – in die Erzeugung
 * eines Arcs oder seiner Kapitel einfließen. Sie sind bewusst **erzählerische
 * Kniffe, keine Inhalte**: kein Ort, keine Figur, kein konkretes Ereignis,
 * sondern eine Art, die vorhandene Handlung reicher zu erzählen. So bleibt der
 * Arc die Zerlegung des Handlungsentwurfs (er darf ihm nicht widersprechen), und
 * der Impuls würzt nur, wie sie ausfällt.
 *
 * **Genre-agnostisch** wie `inspiration.ts` und aus demselben Grund: Die
 * Einträge sind so formuliert, dass sie in jeder Welt funktionieren – ein
 * Motiv, ein Rhythmus, eine Erzählhaltung, nichts, was an eine Epoche oder ein
 * Genre gebunden wäre. Über die Liste wird nie nach Genre getrennt.
 *
 * Sie sind **optional und untergeordnet**: Der Prompt sagt ausdrücklich, dass
 * ein Impuls fallengelassen wird, wo er nicht passt. Deshalb schadet ein Impuls,
 * der gerade nicht trägt, nichts – er wird einfach nicht aufgegriffen.
 */
export const STORY_ARC_SPARKS: readonly string[] = [
  "Ein Gegenstand taucht mehrfach auf und wechselt mit jedem Mal seine Bedeutung.",
  "Eine Figur sagt nie offen, was sie wirklich will – man erkennt es nur an ihrem Handeln.",
  "Etwas, das früh beiläufig erwähnt wird, entscheidet später alles.",
  "Zwei Figuren wollen dasselbe aus entgegengesetzten Gründen.",
  "Eine Wahrheit kommt zur denkbar ungünstigsten Zeit ans Licht.",
  "Ein Versprechen bricht leise, ohne dass es jemand ausspricht.",
  "Eine Nebenfigur sieht mehr, als alle glauben.",
  "Ein Ort verändert seine Stimmung, während sich die Lage zuspitzt.",
  "Jemand tut das Richtige aus dem falschen Grund.",
  "Ein Missverständnis wird nicht aufgeklärt, sondern wächst.",
  "Eine Figur bekommt, was sie wollte, und merkt, dass es das Falsche war.",
  "Zwei Zeitebenen spiegeln sich: Was früher geschah, wiederholt sich verändert.",
  "Ein Detail am Rande verrät mehr als jede Aussage.",
  "Vertrauen wird an genau der Stelle geschenkt, an der es am gefährlichsten ist.",
  "Eine Entscheidung wird durch Zögern getroffen, nicht durch Handeln.",
  "Ein Ritual oder eine Gewohnheit bekommt einen Riss.",
  "Jemand schützt einen anderen, indem er ihn belügt.",
  "Der Wendepunkt fällt mit einem alltäglichen, unscheinbaren Moment zusammen.",
  "Eine Figur wird an ihrer größten Stärke verwundbar.",
  "Was als Hilfe gemeint ist, richtet den größten Schaden an.",
  "Ein Schweigen sagt mehr als das folgende Gespräch.",
  "Eine Grenze – räumlich, gesellschaftlich, moralisch – wird überschritten und lässt sich nicht zurücknehmen.",
  "Zwei Figuren tauschen im Verlauf unmerklich die Rollen.",
  "Ein Geräusch, ein Geruch oder ein Licht kehrt an einem Kipppunkt wieder.",
  "Jemand wartet auf eine Nachricht, die nie so kommt, wie er hofft.",
  "Eine kleine Freundlichkeit hat eine unerwartet große Folge.",
  "Der Preis für die Lösung wird erst sichtbar, als er schon gezahlt ist.",
  "Eine Figur handelt gegen ihre eigene Überzeugung und rechtfertigt es sich hinterher.",
  "Etwas Verlorenes taucht wieder auf – aber es ist nicht mehr dasselbe.",
  "Die eigentliche Auseinandersetzung findet unter der Oberfläche eines höflichen Gesprächs statt.",
];

/**
 * Zieht `min`–`max` Impulse ohne Wiederholung. Nutzt `pickSome` (dieselbe
 * Zieh-Funktion wie die Würfel im Projekt), damit „kreativ" bei jedem Klick
 * andere Anregungen liefert.
 */
export function randomSparks(min = 2, max = 3): string[] {
  return pickSome(STORY_ARC_SPARKS, min, max);
}
