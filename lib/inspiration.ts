/**
 * Bausteine für die Würfel-Knöpfe an den Freitextfeldern „Aussehen" und
 * „Persönlichkeit". Rund 100 Einträge je Liste, rein lokal wie `names.ts` und
 * `professions.ts`. Die Längen sind bewusst nicht fixiert – `pickSome` zieht
 * aus der Liste, wie lang sie auch ist, und jede Liste darf jederzeit wachsen.
 * Der Hintergrund steht in `backgrounds.ts`, weil er als Einziges nach Genre
 * getrennt ist.
 *
 * Beim Aussehen sind es **drei** Listen: eine für weibliche, eine
 * für männliche Charaktere und eine, die für beide gilt. Das ist der einzige
 * Bereich, in dem das Geschlecht zählt – Bart, Haarschnitt und Schnitt der
 * Kleidung lesen sich sonst falsch. Augen, Narben und Gewohnheiten sind davon
 * unberührt und stehen deshalb gemeinsam in `NEUTRAL_APPEARANCE`.
 *
 * Nach **Genre** ist hier dagegen nichts getrennt, und das ist Absicht: die
 * Einträge sind so formuliert, dass sie in jedem Setting funktionieren.
 * Deshalb beschreibt „Aussehen" Körper, Gesicht und Auftreten statt konkreter
 * Kleidungsstücke. Eine Narbe und ein schiefes Lächeln gibt es in Fantasy wie
 * in der Cyberpunk-Megacity – einen Konzernvertrag nicht, und genau deshalb
 * hat der Hintergrund eine eigene Datei.
 *
 * Gewürfelt werden **mehrere** Bausteine auf einmal – genau in der Form, die
 * die Platzhalter der Felder vorgeben.
 */

/**
 * Aussehen weiblicher Charaktere: Haar, Gesicht, Statur, Auftreten, Kleidung.
 * Was hier steht, liest sich an einer Frau selbstverständlich – ein Bart oder
 * ein Stiernacken täte das nicht, deshalb die Trennung.
 */
export const FEMALE_APPEARANCE: string[] = [
  // Haare
  "lange rote Haare, offen getragen",
  "ein kunstvoll geflochtener Zopf",
  "kupferrotes Haar, hochgesteckt",
  "schulterlange blonde Wellen",
  "eine kurze, kinnlange Frisur",
  "dichte schwarze Locken, kaum zu bändigen",
  "ein loser Dutt, aus dem ständig Strähnen fallen",
  "zwei geflochtene Zöpfe",
  "aschblondes Haar mit hellem Ansatz",
  "sehr langes, glattes Haar bis zur Hüfte",
  "ein streng zurückgebundener Knoten im Nacken",
  "kastanienbraunes Haar mit rötlichem Schimmer",
  "ein tief sitzender Pferdeschwanz",
  "silbergraues Haar, mit Stolz getragen",
  "kurzgeschorenes Haar, fast bis auf die Kopfhaut",
  "eine gerade geschnittene Ponyfranse",
  "eine einzelne weiße Strähne im dunklen Haar",
  "feines Haar, das bei jedem Wind auffliegt",
  "eine Flechtkrone um den Kopf",
  "widerspenstige Locken, meist zusammengebunden",
  "haselnussbraunes Haar, an den Spitzen ausgeblichen",
  "ein Haarband, das nie fehlt",
  "eine Strähne, die immer ins Gesicht fällt",
  "Haar, das nach Kräutern riecht",
  "rabenschwarzes Haar mit blauem Schimmer",

  // Gesicht
  "hohe, feine Wangenknochen",
  "ein herzförmiges Gesicht",
  "volle Lippen",
  "ein breiter, offener Mund",
  "ein schmales, blasses Gesicht",
  "ein rundes, weiches Gesicht",
  "Sommersprossen über Nase und Wangen",
  "ein Grübchen in der linken Wange",
  "eine kleine, gerade Nase",
  "eine leicht gebogene Nase, die dem Gesicht Charakter gibt",
  "ein spitzes Kinn",
  "ein kräftiges Kinn, das nichts Weiches hat",
  "dunkle, dichte Wimpern",
  "hohe, schmal gezupfte Brauen",
  "volle, ungezähmte Augenbrauen",
  "ein Muttermal über der Oberlippe",
  "eine feine Narbe an der Schläfe",
  "ein Gesicht, das jünger wirkt als das Alter",
  "tiefe Lachfältchen",
  "Wangen, die schnell rot werden",

  // Statur & Haltung
  "zierlich, fast zerbrechlich wirkend",
  "hochgewachsen und schlank",
  "kräftig gebaut, mit breiten Schultern",
  "klein und drahtig",
  "weiche, runde Formen",
  "eine schmale Taille und breite Hüften",
  "eine flache, sehnige Gestalt",
  "auffallend lange Beine",
  "sehr kleine Hände",
  "schmale Schultern",
  "ein kräftiger Rücken von schwerer Arbeit",
  "eine aufrechte, fast stolze Haltung",
  "eine leicht eingezogene Haltung",
  "steht meist mit dem Gewicht auf einem Bein",
  "wirkt größer, als sie ist",
  "wirkt kleiner, als sie ist",
  "kräftige Unterarme",
  "ein federnder, leichter Gang",
  "ein ausgreifender, schneller Schritt",
  "ausgesprochen dürr",
  "abgemagert",
  "deutlich sichtbare Rippen",
  "hervorstehende Schlüsselbeine",
  "lang und dürr",
  "knochiger Körper",
  "flache Brust",

  // Stimme & Auftreten
  "eine helle, klare Stimme",
  "eine tiefe, rauchige Stimme",
  "ein warmes, tiefes Lachen",
  "lacht selten, dann aber laut",
  "spricht leise, sodass man näher rücken muss",
  "eine Stimme, die im Streit sofort trägt",
  "ein schiefes, spöttisches Lächeln",
  "hält beim Zuhören den Kopf schief",
  "legt anderen beim Reden die Hand auf den Arm",
  "verschränkt fast immer die Arme",
  "blickt Menschen zu lange in die Augen",
  "senkt den Blick, sobald sie angesprochen wird",
  "streicht sich ständig das Haar aus dem Gesicht",
  "kaut auf der Unterlippe",
  "spielt beim Nachdenken mit einem Ring",
  "ein Lächeln, das die Augen nicht erreicht",
  "eine Art, den Raum sofort einzunehmen",

  // Kleidung & Schmuck
  "schlichte, praktische Kleidung ohne Zierat",
  "ein hochgeschlossenes, streng geschnittenes Gewand",
  "weite, fließende Kleidung",
  "eng geschnürte Kleidung, in der sie kaum atmet",
  "Männerkleidung, weil sie bequemer ist",
  "ein auffälliger roter Schal",
  "ein abgetragener Umhang, der zu ihr gehört",
  "schwere Ohrringe",
  "ein Reif am Handgelenk, der bei jeder Bewegung klingt",
  "eine Kette mit einem kleinen Anhänger",
  "ein Ring, der nie abgelegt wird",
  "sorgfältig gepflegte, kurz geschnittene Fingernägel",
  "bemalte Fingernägel, oft abgeblättert",
  "dezent geschminkt",
  "auffällig geschminkte Augen",
  "der Geruch eines schweren Parfüms",
  "eine Haarnadel, die auch als Werkzeug taugt",
  "abgetragene Stiefel unter einem guten Kleid",
  "eine Schürze, die selten abgelegt wird",
];

/** Dasselbe für männliche Charaktere – Bart, Statur, Auftreten, Kleidung. */
export const MALE_APPEARANCE: string[] = [
  // Haare & Bart
  "kurzgeschorenes dunkles Haar",
  "ein kahler Kopf",
  "eine Halbglatze mit dichtem Kranz",
  "dichtes, grau meliertes Haar",
  "ein streng gescheitelter Seitenscheitel",
  "eine widerspenstige Tolle",
  "halblanges braunes Haar, meist zerzaust",
  "schulterlanges Haar, im Nacken zusammengebunden",
  "rasierte Schläfen",
  "weißblondes, fast farbloses Haar",
  "dunkles Haar, das früh licht wird",
  "eine zurückweichende Stirn",
  "Haar, das sich an keinen Scheitel hält",
  "ein voller, gepflegter Bart",
  "ein wilder, ungestutzter Bart",
  "ein Dreitagebart",
  "ein schmaler Schnurrbart",
  "ein Backenbart bis zum Kinn",
  "ein Ziegenbart",
  "glatt rasiert, ausnahmslos",
  "ein Bart mit grauen Strähnen",
  "borstige, zusammengewachsene Augenbrauen",
  "Brusthaar, das über dem Kragen hervorsteht",
  "behaarte Unterarme",
  "ein Bart, in dem Krümel hängen bleiben",
  "Haar, das nach Rauch riecht",
  "eine tief in die Stirn gezogene Kopfbedeckung",
  "eine Narbe, die eine Lücke in die Braue schneidet",

  // Gesicht
  "ein kantiges Kinn",
  "eine markante Kieferpartie",
  "eine gebrochene Nase",
  "eine schwere, breite Nase",
  "tiefe Falten um den Mund",
  "eine zerfurchte Stirn",
  "ein schmaler, oft verkniffener Mund",
  "hängende Mundwinkel",
  "ein jungenhaftes Gesicht, das nicht altern will",
  "wettergegerbte Züge",
  "ein kräftiger Adamsapfel",
  "abstehende Ohren",
  "ein Ohr, dem ein Stück fehlt",
  "eine blasse Narbe über der Augenbraue",
  "eine Lippennarbe, die das Lächeln verzieht",
  "eine ausgeprägte Stirnpartie",
  "ein Gesicht, das im Ruhezustand streng wirkt",

  // Statur & Haltung
  "breitschultrig",
  "kompakt und muskulös",
  "hochgewachsen und schlaksig",
  "massig, mit schwerem Bauch",
  "hager, mit hervortretenden Rippen",
  "kurze Beine, langer Oberkörper",
  "ein Stiernacken",
  "schwere, hängende Schultern",
  "sehnige Unterarme",
  "große, schwere Hände",
  "schwielige, rissige Hände",
  "weiche, ungeübte Hände",
  "Knöchel, die schon oft aufgeplatzt sind",
  "eine kerzengerade, fast militärische Haltung",
  "eine leicht gebeugte Haltung",
  "eine steife Schulter",
  "ein leichtes Hinken",
  "steht breitbeinig",
  "nimmt beim Sitzen zu viel Platz ein",
  "ein schwerer, stampfender Gang",

  // Stimme & Auftreten
  "eine tiefe, dröhnende Stimme",
  "eine überraschend hohe Stimme",
  "eine heisere, brüchige Stimme",
  "spricht langsam und bedacht",
  "spricht schneller, als man folgen kann",
  "lacht laut und ansteckend",
  "räuspert sich vor jedem Satz",
  "nervöses Fingertrommeln",
  "reibt sich beim Nachdenken den Nacken",
  "streicht sich über den Bart, wenn er überlegt",
  "ein fester, zu langer Händedruck",
  "klopft anderen auf die Schulter",
  "hält beim Reden die Daumen im Gürtel",
  "ein schiefes Grinsen",
  "blickt an Gesprächspartnern vorbei",
  "steht immer mit dem Rücken zur Wand",

  // Kleidung & Kleinigkeiten
  "abgetragene, aber gepflegte Kleidung",
  "Kleidung, die eine Nummer zu groß wirkt",
  "stets makellos gekleidet",
  "gedeckte, unauffällige Farben",
  "ein abgewetzter Ledergürtel",
  "ein Hut, der zum Gesicht gehört",
  "schwere, gut eingelaufene Stiefel",
  "Hemdsärmel, immer hochgekrempelt",
  "ein zerschlissener Mantel, der jeden Winter überstand",
  "ein Kragen, der nie richtig sitzt",
  "ein Amulett unter dem Hemd",
  "ein Siegelring",
  "Tinte an den Fingern",
  "Erde unter den Fingernägeln",
  "ein Beutel, der nie aus der Hand gelegt wird",
  "ein verblasstes Tattoo am Unterarm",
  "ein Messer, das er ständig in der Hand dreht",
  "stets zu leicht angezogen, bei jedem Wetter",
  "der Geruch von Öl und Metall",
  "gepflegtes Äußeres",
];

/**
 * Merkmale, die an jedem Charakter funktionieren: Augen, Haut, Narben,
 * Bewegung, Gewohnheiten, Mitgeführtes. Kein Haarschnitt, kein Schnitt der
 * Kleidung – alles, was ein Geschlecht nahelegen würde, steht in den beiden
 * Listen darüber.
 */
export const NEUTRAL_APPEARANCE: string[] = [
  // Augen & Blick
  "hellgraue Augen",
  "tiefbraune, wache Augen",
  "grüne Augen mit goldenem Rand",
  "eisblaue Augen",
  "bernsteinfarbene Augen",
  "fast schwarze Augen",
  "leicht unterschiedlich gefärbte Augen",
  "ein blindes Auge, milchig getrübt",
  "schwere Lider",
  "tiefe Ringe unter den Augen",
  "ein forschender, direkter Blick",
  "ein Blick, der ständig abschweift",
  "Augen, die selten blinzeln",
  "Lachfältchen um die Augen",
  "kurzsichtig, kneift beim Lesen die Augen zusammen",
  "trägt eine dünne Brille",
  "ein Blick, der einen Raum in Sekunden erfasst",
  "zusammengezogene Brauen, auch ohne Grund",
  "wache Augen in einem müden Gesicht",
  "ein Blick, der schwer auszuhalten ist",

  // Haut & Spuren
  "sehr helle, fast durchsichtige Haut",
  "sonnengegerbte Haut",
  "dunkle, warme Hautfarbe",
  "olivfarbene Haut",
  "von Wind und Wetter gezeichnete Haut",
  "blasse Haut mit einem Netz feiner Adern",
  "ein Muttermal am Hals",
  "Brandnarben am Unterarm",
  "eine Brandwunde an der Handfläche",
  "eine lange Narbe quer über den Rücken",
  "Narben an den Fingerknöcheln",
  "Schnittspuren an den Händen",
  "altersfleckige Hände",
  "eine Hautstelle, die stets bedeckt bleibt",
  "ein Tattoo, dessen Bedeutung niemand erklärt bekommt",
  "eine Tätowierung am Hals, halb verblasst",
  "sommersprossige Unterarme",
  "rissige Lippen",
  "trockene, schuppige Haut an den Händen",
  "eine Narbe, die bei Kälte schmerzt",

  // Hände, Statur, Bewegung
  "auffallend lange Finger",
  "kurze, kräftige Finger",
  "abgekaute Fingernägel",
  "eine Hand, an der Finger fehlen",
  "bedächtige, sparsame Bewegungen",
  "fahrige, unruhige Bewegungen",
  "bewegt sich völlig geräuschlos",
  "stolpert häufig über die eigenen Füße",
  "eine Verletzung, die nie ganz verheilte",
  "eine Hand, die manchmal zittert",
  "hält den Kopf leicht gesenkt",
  "reckt beim Sprechen das Kinn",
  "sitzt nie ganz still",
  "kann stundenlang reglos verharren",
  "geht immer einen Schritt zu schnell",
  "bleibt beim Gehen ständig stehen",
  "eine schiefe Schulterhaltung von jahrelanger Arbeit",
  "eine Narbe am Bein, die den Gang verändert",
  "atmet hörbar, sobald die Anstrengung steigt",
  "wirkt selbst im Sitzen sprungbereit",

  // Ausdruck & Gewohnheiten
  "ein Gesicht, das nichts verrät",
  "jede Regung sofort im Gesicht ablesbar",
  "hebt beim Zweifeln eine Braue",
  "nickt beim Zuhören ständig",
  "unterbricht sich selbst mitten im Satz",
  "sucht lange nach dem richtigen Wort",
  "spricht mit den Händen",
  "hält die Hände beim Reden völlig still",
  "eine Angewohnheit, sich zu wiederholen",
  "ein Akzent, den niemand zuordnen kann",
  "eine leichte Sprachstockung bei Aufregung",
  "flucht in einer anderen Sprache",
  "summt beim Arbeiten",
  "pfeift dieselbe Melodie, seit Jahren",
  "lacht an den falschen Stellen",
  "schweigt, wenn andere eine Antwort erwarten",
  "stellt mehr Fragen, als angenehm ist",
  "dankt für jede Kleinigkeit",
  "entschuldigt sich aus Gewohnheit",
  "antwortet erst nach einer Pause",

  // Kleidung & Mitgeführtes
  "Kleidung, die schon zu viele Reisen gesehen hat",
  "sorgfältig geflickte Stellen",
  "ein Kleidungsstück, das sichtbar nicht zum Rest passt",
  "gedeckte Farben, ein einziger heller Fleck darin",
  "barfuß, wann immer es geht",
  "stets zu warm angezogen",
  "ein Erbstück, das nie abgelegt wird",
  "ein Anhänger, der beim Nachdenken gedreht wird",
  "ein abgegriffenes Notizbuch, immer dabei",
  "Taschen voller nutzloser Kleinigkeiten",
  "der Geruch von Rauch, der immer anhaftet",
  "ein Geruch nach Kräutern und Salben",
  "Staub, der sich nie ganz auswaschen lässt",
  "immer ein Stück Brot in der Tasche",
  "eine Waffe, die eher Werkzeug ist",
  "ein Werkzeug, das eher Waffe ist",
  "ein Band um das Handgelenk, längst verblichen",
  "eine Münze, die zwischen den Fingern wandert",
  "ein Verband, der nie ganz verschwindet",
  "eine Tasche, die viel zu schwer aussieht",
];

/** Wesenszüge – Adjektive und kurze Wendungen, in jedem Setting brauchbar. */
export const PERSONALITY_TRAITS: string[] = [
  "sarkastisch",
  "loyal bis zur Selbstaufgabe",
  "misstrauisch gegenüber Autorität",
  "unerschütterlich ruhig",
  "aufbrausend",
  "nachtragend",
  "großzügig",
  "geizig",
  "neugierig bis zur Unvorsichtigkeit",
  "vorsichtig abwägend",
  "impulsiv",
  "methodisch",
  "verträumt",
  "bodenständig",
  "zynisch",
  "arglos",
  "herzlich",
  "abweisend",
  "humorvoll",
  "bitterernst",
  "stur",
  "anpassungsfähig",
  "ehrgeizig",
  "genügsam",
  "eitel",
  "selbstvergessen",
  "fürsorglich",
  "gleichgültig gegenüber Fremden",
  "schnell begeistert",
  "schwer zu beeindrucken",
  "redselig",
  "wortkarg",
  "taktvoll",
  "taktlos ehrlich",
  "diplomatisch",
  "streitlustig",
  "konfliktscheu",
  "nachdenklich",
  "pragmatisch",
  "idealistisch",
  "abergläubisch",
  "rational bis zur Kälte",
  "leichtgläubig",
  "wachsam",
  "verschlossen",
  "offenherzig",
  "spöttisch",
  "gutmütig",
  "rachsüchtig",
  "versöhnlich",
  "pflichtbewusst",
  "unzuverlässig",
  "pünktlich bis zur Pedanterie",
  "chaotisch",
  "ordnungsliebend",
  "verschwenderisch",
  "sparsam",
  "mutig",
  "ängstlich",
  "tollkühn",
  "besonnen",
  "ungeduldig",
  "langmütig",
  "eifersüchtig",
  "großmütig",
  "schadenfroh",
  "mitfühlend",
  "hartherzig",
  "verspielt",
  "würdevoll",
  "selbstironisch",
  "empfindlich gegenüber Kritik",
  "unbeirrbar",
  "wankelmütig",
  "gastfreundlich",
  "einzelgängerisch",
  "gesellig",
  "schüchtern",
  "aufdringlich",
  "zurückhaltend",
  "dominant",
  "gefällig",
  "skeptisch",
  "gläubig",
  "risikofreudig",
  "sicherheitsbedürftig",
  "lernbegierig",
  "belehrend",
  "bescheiden",
  "prahlerisch",
  "aufmerksam beobachtend",
  "zerstreut",
  "hochkonzentriert",
  "melancholisch",
  "lebenslustig",
  "pessimistisch",
  "unverbesserlich optimistisch",
  "ironisch distanziert",
  "warmherzig, aber schnell verletzt",
  "kühl im Umgang, verlässlich in der Sache",
];

/**
 * Zieht `min` bis `max` verschiedene Einträge. Über eine Kopie und Entnahme,
 * damit derselbe Baustein nicht zweimal im Ergebnis landet – bei einem
 * einfachen `Math.random()` je Zug wäre genau das der Normalfall.
 */
export function pickSome(
  list: readonly string[],
  min: number,
  max: number,
): string[] {
  const rest = [...list];
  const anzahl = min + Math.floor(Math.random() * (max - min + 1));
  const gezogen: string[] = [];
  for (let i = 0; i < anzahl && rest.length > 0; i++) {
    gezogen.push(...rest.splice(Math.floor(Math.random() * rest.length), 1));
  }
  return gezogen;
}

/**
 * Wählt die geschlechtsspezifische Liste. Freitext, damit sowohl die Auswahl
 * im Formular („weiblich") als auch das Merkmal eines gespeicherten Charakters
 * hineinpasst – dieselbe Prüfung wie in `names.ts`.
 *
 * Bei „egal"/„divers" fällt eine Münze, statt aus beiden Listen zu mischen:
 * ein Bart neben schweren Ohrringen wäre kein vielfältiger Charakter, sondern
 * ein widersprüchlicher. Der Würfel liefert lieber ein stimmiges Bild, das man
 * neu würfeln kann.
 */
function appearancePool(gender?: string): string[] {
  const g = (gender ?? "").trim().toLowerCase();
  if (g.startsWith("weib")) return FEMALE_APPEARANCE;
  if (g.startsWith("männ") || g.startsWith("mann")) return MALE_APPEARANCE;
  return Math.random() < 0.5 ? FEMALE_APPEARANCE : MALE_APPEARANCE;
}

/**
 * Zwei bis drei geschlechtsspezifische Merkmale plus ein bis zwei, die an
 * jedem Charakter funktionieren – zusammen drei bis fünf.
 *
 * Getrennt durch Semikolon, aus demselben Grund wie beim Hintergrund: viele
 * Einträge enthalten selbst Kommas („silbergraues Haar, mit Stolz getragen"),
 * und mit Komma verbunden verschwämme die Grenze zwischen zwei Merkmalen.
 */
export function randomAppearance(gender?: string): string {
  return [
    ...pickSome(appearancePool(gender), 2, 3),
    ...pickSome(NEUTRAL_APPEARANCE, 1, 2),
  ].join("; ");
}

/** Drei bis vier Wesenszüge, kommagetrennt. */
export function randomPersonality(): string {
  return pickSome(PERSONALITY_TRAITS, 3, 4).join(", ");
}

