/**
 * Bausteine für die Würfel-Knöpfe an den Freitextfeldern „Aussehen",
 * „Persönlichkeit" und „Hintergrund". Je 100 Einträge, rein lokal wie
 * `names.ts` und `professions.ts`.
 *
 * Anders als bei den Berufen gibt es hier **keine Genre-Markierung**, und das
 * ist Absicht: die Einträge sind so formuliert, dass sie in jedem Setting
 * funktionieren. Deshalb beschreibt „Aussehen" Körper, Gesicht und Auftreten
 * statt Kleidungsstücke, und „Hintergrund" sammelt prägende Lebensereignisse
 * („verlor früh die Eltern") statt setting-gebundener Stationen. Ein
 * Fischerdorf gibt es in Fantasy wie in der Gegenwart, einen Netrunner nicht.
 *
 * Gewürfelt werden **mehrere** Bausteine auf einmal, kommagetrennt – genau in
 * der Form, die die Platzhalter der Felder vorgeben.
 */

/** Körper, Gesicht, Haltung, Auftreten – bewusst ohne Kleidungsstücke. */
export const APPEARANCE_FRAGMENTS: string[] = [
  // Haare & Bart
  "lange rote Haare",
  "kurzgeschorenes dunkles Haar",
  "silbergraue Strähnen an den Schläfen",
  "dichte schwarze Locken",
  "ein aschblonder Zopf",
  "halblanges braunes Haar, meist zerzaust",
  "ein streng gescheitelter Seitenscheitel",
  "kupferrotes Haar, hochgesteckt",
  "eine widerspenstige Tolle",
  "rasierte Schläfen",
  "weißblondes, fast farbloses Haar",
  "dunkles Haar mit einer einzelnen weißen Strähne",
  "ein loser Dutt, aus dem ständig Strähnen fallen",
  "wellige, schulterlange Haare",
  "sehr feines, dünnes Haar",
  "ein voller, gepflegter Bart",
  "ein Dreitagebart",
  "ein schmaler Schnurrbart",
  "ein kahler Kopf",
  "borstige Augenbrauen",

  // Augen & Blick
  "hellgraue Augen",
  "tiefbraune, wache Augen",
  "grüne Augen mit goldenem Rand",
  "eisblaue Augen",
  "dunkle Augen, die selten blinzeln",
  "leicht unterschiedlich gefärbte Augen",
  "schwere Lider",
  "tiefe Ringe unter den Augen",
  "ein forschender, direkter Blick",
  "ein Blick, der ständig abschweift",
  "kurzsichtig, trägt eine dünne Brille",
  "Lachfältchen um die Augen",

  // Gesicht
  "hohe Wangenknochen",
  "ein kantiges Kinn",
  "ein rundes, weiches Gesicht",
  "eine gebrochene Nase",
  "eine schmale, gerade Nase",
  "volle Lippen",
  "ein schmaler, oft verkniffener Mund",
  "Sommersprossen über Nase und Wangen",
  "ein Grübchen in der linken Wange",
  "eine blasse Narbe über der Augenbraue",
  "ein Muttermal am Kinn",
  "eine markante Kieferpartie",
  "ein jungenhaftes Gesicht",
  "tiefe Falten um den Mund",

  // Haut
  "sehr helle, fast durchsichtige Haut",
  "sonnengegerbte Haut",
  "dunkle, warme Hautfarbe",
  "olivfarbene Haut",
  "von Wind und Wetter gezeichnete Haut",
  "blasse Haut mit einem Netz feiner Adern",
  "Brandnarben am Unterarm",
  "ein verblasstes Tattoo am Hals",

  // Statur & Hände
  "hochgewachsen und schlaksig",
  "klein und drahtig",
  "breitschultrig",
  "kräftig gebaut",
  "zierlich, fast zerbrechlich wirkend",
  "kompakt und muskulös",
  "auffallend lange Finger",
  "schwielige, rissige Hände",
  "eine leicht gebeugte Haltung",
  "eine kerzengerade Haltung",
  "eine steife Schulter",
  "ein leichtes Hinken",
  "sehnige Unterarme",
  "weiche, ungeübte Hände",

  // Bewegung, Stimme, Gewohnheiten
  "ein federnder, schneller Gang",
  "bedächtige, sparsame Bewegungen",
  "nervöses Fingertrommeln",
  "lacht laut und ansteckend",
  "spricht leise und langsam",
  "eine rauchige, tiefe Stimme",
  "eine helle, klare Stimme",
  "ein schiefes Lächeln",
  "verschränkt fast immer die Arme",
  "hält beim Zuhören den Kopf schief",
  "kaut auf der Unterlippe",
  "blickt Menschen zu lange in die Augen",
  "hält den Kopf leicht gesenkt",
  "abgekaute Fingernägel",
  "vernarbte Knöchel",

  // Gepflegtheit & kleine Details
  "abgetragene, aber gepflegte Kleidung",
  "stets makellos gekleidet",
  "Kleidung, die eine Nummer zu groß wirkt",
  "ein abgewetzter Ledergürtel",
  "gedeckte, unauffällige Farben",
  "ein auffälliger roter Schal",
  "ein Ring, der nie abgelegt wird",
  "eine Kette mit einem kleinen Anhänger",
  "Tinte an den Fingern",
  "Erde unter den Fingernägeln",
  "der Geruch von Rauch, der immer anhaftet",
  "ein Amulett unter dem Hemd",
  "ein Beutel, der nie aus der Hand gelegt wird",
  "stets zu warm angezogen",
  "barfuß, wann immer es geht",
  "ein Hut, der zum Gesicht gehört",
  "eine Brandwunde an der Handfläche",
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
 * Prägende Lebensereignisse. Bewusst ohne Berufe, Orte oder Technik – ein
 * verlorener Vater und ein gebrochener Schwur funktionieren im Mittelalter
 * wie in der Cyberpunk-Megacity.
 */
export const BACKGROUND_HOOKS: string[] = [
  // Herkunft & Kindheit
  "wuchs bei den Großeltern auf",
  "verlor früh die Eltern",
  "ist das älteste von fünf Geschwistern",
  "wuchs als Einzelkind auf",
  "kennt den eigenen Vater nicht",
  "wurde als Kind weggegeben",
  "wuchs in großer Armut auf",
  "stammt aus einer wohlhabenden Familie",
  "stammt aus einer angesehenen Familie, die alles verlor",
  "wuchs in einem abgelegenen Dorf auf",
  "wuchs in einer großen Stadt auf und kennt nichts anderes",
  "zog als Kind ständig um",
  "wuchs zwischen zwei Kulturen auf",
  "lernte früh, für sich selbst zu sorgen",
  "wurde von einem Fremden aufgezogen",
  "wuchs in einem Haushalt voller Bücher auf",
  "durfte nie lesen lernen",
  "brach die Ausbildung kurz vor dem Abschluss ab",
  "war die große Hoffnung der Familie",
  "galt als Enttäuschung der Familie",

  // Ortswechsel & Brüche
  "floh aus der Heimat",
  "wurde aus der Heimatstadt verbannt",
  "kehrte nach Jahren zurück und fand nichts wieder",
  "hat die Heimat nie verlassen",
  "überlebte als Einziger ein Unglück",
  "trägt Schuld an einem Unfall",
  "wurde für etwas bestraft, das ein anderer tat",
  "saß eine Zeit lang in Haft",
  "wurde freigesprochen, aber nie rehabilitiert",
  "hat einen falschen Namen angenommen",
  "lebt unter falscher Identität",
  "hat die Vergangenheit sorgfältig verwischt",
  "wird von jemandem gesucht",
  "sucht selbst nach jemandem",

  // Bindungen
  "hat einen Bruder, von dem seit Jahren nichts zu hören ist",
  "hat ein Kind, das nichts davon weiß",
  "verließ die Familie über Nacht",
  "wurde von der Familie verstoßen",
  "versöhnte sich zu spät",
  "pflegte jahrelang ein krankes Elternteil",
  "verlor den Partner",
  "wurde vor der Hochzeit verlassen",
  "liebt jemanden, der davon nichts weiß",
  "ging eine Verbindung aus Vernunft ein",
  "zog ein fremdes Kind groß",
  "verlor ein Kind",
  "hat einen Freund verraten",
  "wurde von einem Freund verraten",
  "rettete einmal jemandem das Leben",
  "wurde einmal gerettet und schuldet dafür etwas",

  // Geld, Arbeit, Aufstieg und Fall
  "schuldet jemandem viel Geld",
  "verlor alles bei einem Handel",
  "kam durch Glück zu Geld",
  "gab ein sicheres Auskommen für eine Idee auf",
  "arbeitete jahrelang für jemanden, den er verachtete",
  "stieg vom Gehilfen zum Meister auf",
  "wurde aus dem Beruf gedrängt",
  "wechselte den Beruf nach einem Zusammenbruch",
  "hat schon fünf Tätigkeiten ausprobiert",
  "folgt der Familientradition widerwillig",
  "brach mit der Familientradition",
  "lernte das Handwerk von einer strengen Lehrmeisterin",
  "hat einen Mentor, der später zum Gegner wurde",
  "wurde von einem Rivalen geprägt",
  "gewann einmal einen Wettstreit, der alles veränderte",
  "verlor einmal einen Wettstreit und kam nie darüber hinweg",

  // Gewalt, Katastrophen, Reisen
  "diente einige Jahre unter Waffen",
  "desertierte",
  "überlebte eine Belagerung",
  "überlebte eine Seuche",
  "überlebte einen Brand, der alles nahm",
  "verlor die Heimat durch eine Katastrophe",
  "war lange auf Reisen",
  "kehrte von einer langen Reise verändert zurück",
  "war jahrelang auf See",
  "kennt Wege, die sonst niemand geht",
  "lebte eine Zeit lang allein in der Wildnis",
  "verbrachte Jahre in völliger Abgeschiedenheit",

  // Gemeinschaft, Glaube, Schwüre
  "gehörte einer Gemeinschaft an, die zerfiel",
  "wurde aus einer Gemeinschaft ausgeschlossen",
  "hat einen Glauben verloren",
  "fand spät zu einem Glauben",
  "leistete einen Schwur, der bis heute bindet",
  "brach einen Schwur",
  "hütet ein Geheimnis für jemand anderen",
  "kennt ein Geheimnis, das jemanden ruinieren könnte",
  "wurde Zeuge von etwas, das niemand glauben will",
  "sucht die Wahrheit über einen alten Vorfall",

  // Unerledigtes & Antrieb
  "hat einen Auftrag nie zu Ende gebracht",
  "gab ein Versprechen, das nicht zu halten ist",
  "trägt seit Jahren dieselbe unerledigte Sache mit sich",
  "will es einem bestimmten Menschen beweisen",
  "will vergessen werden",
  "will unbedingt in Erinnerung bleiben",
  "hat sich neu erfunden und fürchtet die Rückkehr des Alten",
  "lebt sparsam, weil einmal alles weg war",
  "vertraut seither niemandem ganz",
  "sammelt seither Dinge, die andere wegwerfen",
  "hat gelernt, nie um Hilfe zu bitten",
  "sucht einen Ort, an dem es sich bleiben ließe",
];

/**
 * Zieht `min` bis `max` verschiedene Einträge. Über eine Kopie und Entnahme,
 * damit derselbe Baustein nicht zweimal im Ergebnis landet – bei einem
 * einfachen `Math.random()` je Zug wäre genau das der Normalfall.
 */
function pickSome(list: readonly string[], min: number, max: number): string[] {
  const rest = [...list];
  const anzahl = min + Math.floor(Math.random() * (max - min + 1));
  const gezogen: string[] = [];
  for (let i = 0; i < anzahl && rest.length > 0; i++) {
    gezogen.push(...rest.splice(Math.floor(Math.random() * rest.length), 1));
  }
  return gezogen;
}

/** Drei bis vier Merkmale zum Aussehen, kommagetrennt. */
export function randomAppearance(): string {
  return pickSome(APPEARANCE_FRAGMENTS, 3, 4).join(", ");
}

/** Drei bis vier Wesenszüge, kommagetrennt. */
export function randomPersonality(): string {
  return pickSome(PERSONALITY_TRAITS, 3, 4).join(", ");
}

/**
 * Ein bis zwei prägende Ereignisse. Getrennt durch Semikolon, nicht durch
 * Komma: die Einträge enthalten selbst Kommas („gewann einmal einen
 * Wettstreit, der alles veränderte"), und mit Komma verbunden verschwämme die
 * Grenze zwischen zwei Ereignissen.
 */
export function randomBackground(): string {
  return pickSome(BACKGROUND_HOOKS, 1, 2).join("; ");
}
