/**
 * Namensvorrat für den Zufallsnamen im Erstellen-Formular.
 *
 * Bewusst **rein lokal, ohne API-Aufruf**: ein Würfel-Knopf lebt davon, dass
 * man ihn mehrmals hintereinander drückt, bis ein Name sitzt. Über die API
 * wären das jedes Mal Wartezeit, ein Ladezustand und ein Fehlerfall – für
 * etwas, das eine Liste genauso gut kann. Die Tokenkosten wären dabei nicht
 * einmal das Hauptargument (ein Namensaufruf läge im Bereich von 0,05 Cent).
 *
 * Je Kulturkreis rund 200 Namen (70 weiblich, 70 männlich, 60 Nachnamen).
 * Das ergibt pro Geschlecht über 4000 Kombinationen – Wiederholungen fallen
 * in der Praxis nicht auf.
 *
 * Die Listen sind eine **Stilhilfe, keine Volkszählung**: sie sollen den
 * Klang eines Settings treffen, nicht eine Region vollständig abbilden.
 */

export interface NameCulture {
  id: string;
  label: string;
  female: string[];
  male: string[];
  surnames: string[];
}

export const NAME_CULTURES: NameCulture[] = [
  {
    id: "deutsch",
    label: "Deutschsprachig",
    female: [
      "Amelie", "Anja", "Annika", "Antonia", "Astrid", "Beate", "Birgit",
      "Carla", "Charlotte", "Clara", "Cordula", "Dagmar", "Doreen",
      "Elisabeth", "Elke", "Emilia", "Erika", "Franziska", "Frieda",
      "Gabriele", "Gerlinde", "Gesine", "Greta", "Hanna", "Hedwig", "Heike",
      "Helena", "Helga", "Henriette", "Hilde", "Ilona", "Ingrid", "Irmgard",
      "Jana", "Johanna", "Josefine", "Julia", "Jutta", "Karin", "Katharina",
      "Kerstin", "Klara", "Konstanze", "Kristin", "Leonie", "Lieselotte",
      "Lina", "Luisa", "Magdalena", "Maike", "Manuela", "Margarete",
      "Marlene", "Martina", "Mathilde", "Melanie", "Meret", "Monika",
      "Nadine", "Nele", "Petra", "Renate", "Rosemarie", "Sabine", "Sigrid",
      "Sonja", "Susanne", "Theresa", "Ulrike", "Verena",
    ],
    male: [
      "Alexander", "Andreas", "Anton", "Armin", "Arne", "Benedikt", "Bernd",
      "Björn", "Bruno", "Christian", "Clemens", "Detlef", "Dieter",
      "Dietmar", "Eberhard", "Emil", "Erich", "Ernst", "Falk", "Felix",
      "Ferdinand", "Florian", "Frank", "Friedrich", "Georg", "Gerhard",
      "Gunnar", "Günther", "Hannes", "Hartmut", "Heiko", "Heinrich",
      "Helmut", "Holger", "Horst", "Ingo", "Jakob", "Joachim", "Johannes",
      "Jonas", "Jörg", "Jürgen", "Karl", "Klaus", "Konrad", "Lars",
      "Leopold", "Lorenz", "Ludwig", "Lukas", "Manfred", "Markus",
      "Matthias", "Maximilian", "Moritz", "Norbert", "Oskar", "Otto",
      "Paul", "Reinhard", "Rüdiger", "Sebastian", "Siegfried", "Stefan",
      "Sven", "Theodor", "Thorsten", "Tobias", "Ulrich", "Wilhelm",
    ],
    surnames: [
      "Albrecht", "Bachmann", "Baumgartner", "Becker", "Behrens", "Bergmann",
      "Böhm", "Brandt", "Bruckner", "Busch", "Dietrich", "Eberhardt",
      "Engel", "Fischer", "Freitag", "Fuchs", "Gerber", "Grünewald", "Haas",
      "Hartmann", "Herrmann", "Hoffmann", "Holzer", "Huber", "Jäger",
      "Kaiser", "Keller", "Klein", "Koch", "Köhler", "König", "Krämer",
      "Krause", "Kröger", "Lehmann", "Lindner", "Löwe", "Maier", "Meissner",
      "Neumann", "Osterkamp", "Pfeiffer", "Reinhardt", "Richter", "Sauer",
      "Schäfer", "Schmidt", "Schneider", "Schreiber", "Schröder", "Schulz",
      "Seidel", "Sommer", "Steinbach", "Vogel", "Wagner", "Weber", "Werner",
      "Winkler", "Zimmermann",
    ],
  },
  {
    id: "britisch",
    label: "Britisch / englischsprachig",
    female: [
      "Abigail", "Alice", "Amelia", "Amy", "Annabel", "Beatrice", "Bethany",
      "Bridget", "Caroline", "Catherine", "Charlotte", "Chloe", "Claire",
      "Daisy", "Diana", "Edith", "Eleanor", "Elizabeth", "Ella", "Emily",
      "Erin", "Esme", "Evelyn", "Fiona", "Florence", "Freya", "Georgia",
      "Grace", "Hannah", "Harriet", "Hazel", "Helen", "Imogen", "Isla",
      "Jane", "Jemima", "Jessica", "Jocelyn", "Josephine", "Joyce", "Julia",
      "Katherine", "Lauren", "Lily", "Louise", "Lucy", "Madeleine",
      "Margaret", "Martha", "Matilda", "Megan", "Mia", "Millie", "Naomi",
      "Nancy", "Nora", "Olivia", "Penelope", "Phoebe", "Poppy", "Rachel",
      "Rosalind", "Rose", "Ruth", "Sophie", "Tabitha", "Tessa", "Violet",
      "Wendy", "Willow",
    ],
    male: [
      "Adam", "Alan", "Albert", "Alfie", "Andrew", "Archie", "Arthur",
      "Barnaby", "Benjamin", "Bernard", "Callum", "Charles", "Christopher",
      "Clive", "Colin", "Daniel", "Dominic", "Douglas", "Duncan", "Edward",
      "Elliot", "Ewan", "Felix", "Finlay", "Francis", "Frederick", "Gareth",
      "George", "Gerald", "Gordon", "Graham", "Harold", "Harry", "Henry",
      "Hugh", "Ian", "Isaac", "Jack", "James", "Jasper", "Jonathan",
      "Joseph", "Julian", "Keith", "Lawrence", "Leo", "Lewis", "Malcolm",
      "Marcus", "Martin", "Matthew", "Miles", "Nathan", "Neil", "Nicholas",
      "Nigel", "Oliver", "Oscar", "Owen", "Patrick", "Percy", "Peter",
      "Philip", "Ralph", "Rupert", "Samuel", "Simon", "Stanley", "Thomas",
      "Toby",
    ],
    surnames: [
      "Abbott", "Ainsworth", "Ashcroft", "Bailey", "Barlow", "Bennett",
      "Blackwood", "Bradley", "Brookes", "Carter", "Chapman", "Clarke",
      "Coleman", "Cooper", "Davies", "Dawson", "Ellis", "Fairbanks",
      "Fletcher", "Foster", "Gibson", "Graham", "Hale", "Hardy",
      "Harrington", "Hawkins", "Hayes", "Holloway", "Hughes", "Jenkins",
      "Kendrick", "Lambert", "Lawson", "Lockhart", "Marsh", "Merrick",
      "Middleton", "Morgan", "Norwood", "Osborne", "Palmer", "Parker",
      "Pemberton", "Prescott", "Quinn", "Radcliffe", "Redmond", "Rivers",
      "Sinclair", "Spencer", "Stanton", "Sutton", "Thornton", "Turner",
      "Wakefield", "Walsh", "Weston", "Whitfield", "Wilkinson", "Winslow",
    ],
  },
  {
    id: "nordisch",
    label: "Nordisch / skandinavisch",
    female: [
      "Agnes", "Alva", "Anneli", "Annika", "Asta", "Astrid", "Birgitta",
      "Bodil", "Britta", "Dagny", "Ebba", "Eira", "Elin", "Ellinor", "Elsa",
      "Embla", "Erika", "Frida", "Gerd", "Gudrun", "Gunilla", "Hanne",
      "Hedda", "Helga", "Hilde", "Ida", "Idun", "Inga", "Ingeborg",
      "Ingrid", "Jorunn", "Kaja", "Karin", "Katla", "Kirsten", "Kristin",
      "Liv", "Lova", "Maja", "Malin", "Mari", "Marit", "Mette", "Nanna",
      "Nora", "Oda", "Ragnhild", "Randi", "Runa", "Saga", "Sanna", "Signe",
      "Sigrid", "Sigrun", "Silje", "Sofie", "Solveig", "Sunniva", "Svea",
      "Thora", "Tove", "Trine", "Tuva", "Ulla", "Unn", "Vega", "Vendela",
      "Vigdis", "Ylva", "Åsa",
    ],
    male: [
      "Anders", "Arne", "Asbjørn", "Bjarne", "Björn", "Bo", "Brage", "Dag",
      "Einar", "Eirik", "Elias", "Emil", "Erlend", "Eskil", "Espen", "Finn",
      "Frode", "Gunnar", "Halvard", "Håkon", "Harald", "Helge", "Henrik",
      "Ivar", "Jarl", "Jens", "Joar", "Johan", "Jonas", "Kai", "Kjell",
      "Knut", "Lars", "Leif", "Magnus", "Mats", "Mikkel", "Morten",
      "Niklas", "Nils", "Odd", "Olav", "Ole", "Oskar", "Per", "Ragnar",
      "Rasmus", "Rune", "Sigurd", "Sindre", "Sivert", "Sten", "Stian",
      "Svein", "Sverre", "Tarjei", "Thorbjørn", "Thore", "Tobias", "Tor",
      "Torbjörn", "Torstein", "Trygve", "Ulf", "Vidar", "Viggo", "Vilhelm",
      "Ørjan", "Åge", "Arvid",
    ],
    surnames: [
      "Aalberg", "Aasen", "Andersson", "Bakke", "Berg", "Berglund",
      "Bergström", "Björk", "Blomqvist", "Bratt", "Dahl", "Dahlberg", "Eek",
      "Ekström", "Eriksen", "Falk", "Fjeldstad", "Fossum", "Grimstad",
      "Gulbrandsen", "Hagen", "Halvorsen", "Hammer", "Hansen", "Haugen",
      "Hellström", "Holm", "Holmgren", "Isaksen", "Jansson", "Johansen",
      "Karlsson", "Kjellberg", "Kristiansen", "Larsen", "Lind", "Lindqvist",
      "Ljung", "Lundgren", "Moen", "Munthe", "Nordby", "Nordström",
      "Nygaard", "Olsen", "Pedersen", "Rasmussen", "Rydberg", "Sandvik",
      "Sjöberg", "Solberg", "Stenersen", "Strand", "Sundqvist", "Svendsen",
      "Thorvaldsen", "Vik", "Wallin", "Westergaard", "Ødegård",
    ],
  },
  {
    id: "slawisch",
    label: "Slawisch / osteuropäisch",
    female: [
      "Agnieszka", "Alena", "Alina", "Anastasia", "Anja", "Barbora",
      "Bogdana", "Danuta", "Daria", "Dobromila", "Dominika", "Dragana",
      "Ewa", "Galina", "Halina", "Hanna", "Irina", "Ivana", "Jadwiga",
      "Jana", "Jelena", "Julia", "Kamila", "Katarzyna", "Katja", "Klara",
      "Ksenia", "Lada", "Larisa", "Lena", "Lidia", "Ludmila", "Magda",
      "Malgorzata", "Marika", "Marina", "Marta", "Milena", "Mirjana",
      "Nadja", "Natalia", "Nina", "Oksana", "Olga", "Pavla", "Petra",
      "Polina", "Radmila", "Renata", "Sabina", "Sasha", "Slavena", "Sonja",
      "Stanislawa", "Svetlana", "Tamara", "Tatjana", "Vera", "Veronika",
      "Vesna", "Vlasta", "Wanda", "Weronika", "Yelena", "Zdenka", "Zofia",
      "Zora", "Zuzanna", "Zvezdana", "Bojana",
    ],
    male: [
      "Aleksander", "Alexej", "Andrej", "Anton", "Bogdan", "Bohumil",
      "Boleslaw", "Boris", "Branko", "Casimir", "Cyril", "Danilo",
      "Dimitri", "Dragan", "Dusan", "Emil", "Feliks", "Filip", "Goran",
      "Gregor", "Grigori", "Igor", "Ivan", "Jakub", "Jaroslav", "Jerzy",
      "Josip", "Jurij", "Kazimierz", "Konstantin", "Lech", "Leszek",
      "Lubomir", "Ludvik", "Marek", "Marko", "Matej", "Michal", "Milan",
      "Miroslav", "Nikodem", "Nikolai", "Oleg", "Ondrej", "Pavel", "Piotr",
      "Radek", "Radomir", "Rostislav", "Ruslan", "Sergej", "Slawomir",
      "Stanislav", "Stefan", "Svetozar", "Tadeusz", "Tomasz", "Vaclav",
      "Valentin", "Vasili", "Viktor", "Vladimir", "Vojtech", "Wojciech",
      "Yuri", "Zbigniew", "Zdenek", "Zoran", "Lubos", "Miloš",
    ],
    surnames: [
      "Adamczyk", "Antonov", "Baranov", "Bartos", "Beranek", "Blazek",
      "Bogdanov", "Cerny", "Chmielewski", "Dabrowski", "Dolinski", "Dvorak",
      "Fedorov", "Gajos", "Gorski", "Havel", "Horvat", "Jankovic",
      "Jelinek", "Kaminski", "Kovac", "Kowalski", "Kozlov", "Krupa",
      "Kucera", "Lebedev", "Lewandowski", "Makarov", "Malinowski",
      "Matejka", "Mazur", "Melnyk", "Michalski", "Mikhailov", "Novotny",
      "Nowak", "Orlov", "Ostrowski", "Pavlenko", "Petrov", "Pokorny",
      "Popov", "Prochazka", "Rudenko", "Sadowski", "Savitsky", "Sobczak",
      "Sokolov", "Stanek", "Stepanov", "Svoboda", "Szymanski", "Tomczak",
      "Vasiliev", "Vlasov", "Volkov", "Wojcik", "Zielinski", "Zukov",
      "Milosevic",
    ],
  },
  {
    id: "romanisch",
    label: "Romanisch (italienisch / spanisch)",
    female: [
      "Adriana", "Alba", "Alessandra", "Alma", "Amaia", "Ana", "Angela",
      "Antonella", "Aurora", "Beatriz", "Bianca", "Camila", "Carla",
      "Carmen", "Caterina", "Cecilia", "Chiara", "Clara", "Consuelo",
      "Daniela", "Delfina", "Dolores", "Elena", "Elisa", "Emilia",
      "Esperanza", "Eugenia", "Federica", "Fernanda", "Fiorella",
      "Francesca", "Gabriela", "Gemma", "Giovanna", "Giulia", "Graziella",
      "Ines", "Irene", "Isabel", "Julieta", "Laura", "Leonor", "Lucia",
      "Luisa", "Manuela", "Marcela", "Margarita", "Maria", "Mariana",
      "Marta", "Micaela", "Milena", "Miriam", "Noemi", "Nuria", "Ofelia",
      "Paloma", "Paola", "Patricia", "Pilar", "Renata", "Rosalia",
      "Rosario", "Sabrina", "Serena", "Silvia", "Simona", "Sofia",
      "Valentina", "Ximena",
    ],
    male: [
      "Adrian", "Alejandro", "Alessandro", "Alfonso", "Alonso", "Angelo",
      "Antonio", "Armando", "Bruno", "Carlo", "Cesare", "Cristiano",
      "Damian", "Diego", "Domenico", "Duarte", "Eduardo", "Emilio",
      "Enrique", "Enzo", "Esteban", "Ezio", "Fabio", "Federico", "Felipe",
      "Fernando", "Filippo", "Francesco", "Gabriel", "Gaspar", "Gennaro",
      "Gonzalo", "Guillermo", "Gustavo", "Hector", "Hugo", "Ignacio",
      "Iker", "Javier", "Joaquin", "Jorge", "Julian", "Leandro",
      "Leonardo", "Lorenzo", "Luca", "Luciano", "Manuel", "Marco", "Mateo",
      "Matteo", "Maurizio", "Miguel", "Nicolas", "Octavio", "Pablo",
      "Paolo", "Pascual", "Pietro", "Rafael", "Ramiro", "Raul", "Renzo",
      "Ricardo", "Rodrigo", "Salvatore", "Santiago", "Tomas", "Vicente",
      "Vittorio",
    ],
    surnames: [
      "Aguilar", "Alvarez", "Barbieri", "Benitez", "Bianchi", "Bruno",
      "Caballero", "Cabrera", "Caruso", "Castillo", "Colombo", "Conti",
      "Costa", "De Luca", "Delgado", "Esposito", "Ferrari", "Ferreira",
      "Fontana", "Gallo", "Garcia", "Gentile", "Giordano", "Gomez",
      "Greco", "Guerrero", "Herrera", "Iglesias", "Jimenez", "Lombardi",
      "Longo", "Marchetti", "Marino", "Martinez", "Mendoza", "Molina",
      "Montoya", "Moreno", "Moretti", "Navarro", "Ortega", "Pagano",
      "Palumbo", "Pereira", "Ponti", "Quiroga", "Ramirez", "Ricci", "Riva",
      "Rizzo", "Romano", "Rossi", "Ruiz", "Salazar", "Santoro", "Serrano",
      "Silva", "Sorrentino", "Vargas", "Vitale",
    ],
  },
  {
    id: "japanisch",
    label: "Japanisch",
    female: [
      "Ai", "Aiko", "Akane", "Akemi", "Asuka", "Atsuko", "Aya", "Ayaka",
      "Ayumi", "Chiaki", "Chieko", "Chiyo", "Emi", "Eriko", "Fumiko",
      "Hanae", "Haruka", "Haruna", "Hikari", "Hiroko", "Hitomi", "Honoka",
      "Junko", "Kaede", "Kanako", "Kaori", "Kasumi", "Kazue", "Keiko",
      "Kiyomi", "Kotone", "Kumiko", "Kyoko", "Madoka", "Mai", "Maki",
      "Mao", "Mariko", "Masako", "Mayu", "Megumi", "Michiko", "Midori",
      "Miho", "Mika", "Miki", "Minako", "Misaki", "Mitsuko", "Miyu",
      "Nanako", "Nao", "Naoko", "Natsuki", "Noriko", "Rei", "Reiko",
      "Rika", "Riko", "Rin", "Sachiko", "Sakura", "Saori", "Satomi",
      "Sayuri", "Shizuka", "Sumire", "Tomoko", "Yoko", "Yuriko",
    ],
    male: [
      "Akihiko", "Akira", "Arata", "Atsushi", "Daichi", "Daisuke", "Eiji",
      "Fumio", "Goro", "Hajime", "Haruki", "Haruto", "Hayato", "Hideo",
      "Hiroshi", "Hisashi", "Isamu", "Itsuki", "Jiro", "Junichi", "Kaito",
      "Kaoru", "Katsuo", "Kazuki", "Kazuo", "Keiji", "Kenji", "Kenta",
      "Kiyoshi", "Kohei", "Makoto", "Mamoru", "Masaru", "Masashi",
      "Minoru", "Naoki", "Noboru", "Nobuo", "Osamu", "Ren", "Riku", "Ryo",
      "Ryota", "Ryuji", "Saburo", "Satoshi", "Seiji", "Shigeru", "Shin",
      "Shinji", "Sho", "Shota", "Sora", "Sosuke", "Susumu", "Tadashi",
      "Takashi", "Takeshi", "Takumi", "Tamotsu", "Tatsuya", "Toru",
      "Toshio", "Tsuyoshi", "Wataru", "Yasuo", "Yoshio", "Yuji", "Yuki",
      "Yuto",
    ],
    surnames: [
      "Abe", "Aoki", "Arai", "Endo", "Fujimoto", "Fujita", "Fujiwara",
      "Fukuda", "Goto", "Hara", "Hasegawa", "Hashimoto", "Hayashi",
      "Hirano", "Ichikawa", "Iida", "Ikeda", "Imai", "Inoue", "Ishii",
      "Ishikawa", "Ito", "Iwamoto", "Kaneko", "Kato", "Kawaguchi",
      "Kimura", "Kobayashi", "Kondo", "Kono", "Kubo", "Kudo", "Maeda",
      "Masuda", "Matsuda", "Matsumoto", "Miura", "Miyazaki", "Mori",
      "Morita", "Murakami", "Nakagawa", "Nakamura", "Nakano", "Nishimura",
      "Noguchi", "Ogawa", "Okada", "Okamoto", "Ono", "Saito", "Sakamoto",
      "Sasaki", "Sato", "Shimizu", "Suzuki", "Tachibana", "Takahashi",
      "Tanaka", "Watanabe",
    ],
  },
  {
    id: "viktorianisch",
    label: "Viktorianisch (19. Jahrhundert)",
    female: [
      "Adelaide", "Agatha", "Agnes", "Alberta", "Almira", "Amelia",
      "Arabella", "Augusta", "Beatrix", "Blanche", "Cecily", "Charity",
      "Clarissa", "Clementine", "Constance", "Cordelia", "Delphine",
      "Dorothea", "Edith", "Eliza", "Emmeline", "Estella", "Ethel",
      "Eudora", "Euphemia", "Evangeline", "Faith", "Flora", "Georgiana",
      "Gertrude", "Gwendolen", "Harriet", "Henrietta", "Honoria",
      "Hortense", "Ida", "Isadora", "Jemima", "Josephine", "Lavinia",
      "Letitia", "Lilian", "Lucinda", "Mabel", "Marguerite", "Matilda",
      "Maud", "Mercy", "Millicent", "Minerva", "Muriel", "Ophelia",
      "Patience", "Pearl", "Philippa", "Prudence", "Rosamund", "Rowena",
      "Sybil", "Temperance", "Theodora", "Ursula", "Verity", "Victoria",
      "Wilhelmina", "Winifred", "Beatrice", "Cassandra", "Drusilla",
      "Octavia",
    ],
    male: [
      "Abraham", "Albert", "Alfred", "Ambrose", "Archibald", "Augustus",
      "Bartholomew", "Benedict", "Bertram", "Cecil", "Charles", "Clarence",
      "Cornelius", "Cuthbert", "Desmond", "Digby", "Edgar", "Edmund",
      "Edwin", "Ernest", "Eustace", "Ezekiel", "Fitzwilliam", "Frederick",
      "Gideon", "Godfrey", "Hamish", "Hector", "Herbert", "Horace",
      "Horatio", "Hubert", "Ignatius", "Isambard", "Jasper", "Jeremiah",
      "Josiah", "Leopold", "Lionel", "Llewellyn", "Marmaduke", "Matthias",
      "Montague", "Mortimer", "Nathaniel", "Obadiah", "Octavius", "Osbert",
      "Oswald", "Percival", "Phineas", "Quentin", "Reginald", "Rupert",
      "Septimus", "Sidney", "Silas", "Solomon", "Thaddeus", "Theobald",
      "Tobias", "Ulysses", "Vernon", "Victor", "Virgil", "Wilfred",
      "Winston", "Zachariah", "Barnabas", "Lucius",
    ],
    surnames: [
      "Ashcombe", "Ashdown", "Barrington", "Beckwith", "Bellingham",
      "Blackthorn", "Bramwell", "Brightwell", "Carmichael", "Cavendish",
      "Chadwick", "Chesterfield", "Cranbrook", "Crompton", "Dashwood",
      "Ellery", "Fairweather", "Farnsworth", "Featherstone", "Fitzgerald",
      "Gainsborough", "Gladstone", "Greaves", "Hargreaves", "Hawthorne",
      "Heathcote", "Hollingsworth", "Huxley", "Kingsley", "Ludlow",
      "Marchbanks", "Merriweather", "Montgomery", "Nightingale", "Ormsby",
      "Pemberton", "Pennyworth", "Pickering", "Rathbone", "Ravenscroft",
      "Redgrave", "Rutherford", "Saltonstall", "Shackleton", "Sheffield",
      "Somerset", "Stanhope", "Sterling", "Swinburne", "Thackeray",
      "Thistlewood", "Underwood", "Wadsworth", "Wentworth", "Whitmore",
      "Wickham", "Wolstenholme", "Ashbourne", "Trelawney", "Vane",
    ],
  },
  {
    id: "western",
    label: "Wilder Westen",
    female: [
      "Abigail", "Ada", "Adeline", "Annie", "Belle", "Bessie", "Bonnie",
      "Callie", "Carrie", "Cassie", "Clementine", "Cora", "Daisy", "Della",
      "Dixie", "Dolly", "Dora", "Effie", "Elsie", "Emma", "Etta", "Eula",
      "Fanny", "Flora", "Frankie", "Georgia", "Grace", "Hattie", "Hester",
      "Ida", "Ivy", "Jenny", "Josie", "June", "Kate", "Katie", "Laura",
      "Lena", "Lila", "Lillie", "Lottie", "Lucinda", "Lucy", "Mabel",
      "Maggie", "Mamie", "Martha", "Mary", "Mattie", "Maude", "Minnie",
      "Molly", "Myrtle", "Nellie", "Nettie", "Ola", "Opal", "Pearl",
      "Polly", "Rosa", "Ruby", "Sadie", "Sally", "Sarah", "Stella",
      "Susannah", "Tess", "Vada", "Willa", "Winnie",
    ],
    male: [
      "Abner", "Amos", "Angus", "Arlo", "Augustus", "Bart", "Bill", "Buck",
      "Caleb", "Carson", "Cash", "Cassidy", "Charlie", "Clay", "Cleve",
      "Cole", "Cyrus", "Dallas", "Dalton", "Duke", "Earl", "Eli", "Elijah",
      "Ephraim", "Ezra", "Frank", "Gabe", "Garrett", "Gus", "Hank",
      "Harlan", "Hiram", "Holt", "Hoyt", "Ike", "Jack", "Jed", "Jeremiah",
      "Jesse", "Job", "Joshua", "Judd", "Levi", "Luke", "Marshall",
      "Mason", "Merle", "Morgan", "Nate", "Ned", "Newt", "Obadiah", "Otis",
      "Owen", "Rafe", "Reuben", "Rufus", "Sam", "Seth", "Shep", "Silas",
      "Sterling", "Travis", "Virgil", "Wade", "Walt", "Wesley", "Wyatt",
      "Zeb", "Zeke",
    ],
    surnames: [
      "Abernathy", "Ashby", "Bannister", "Barlow", "Beaumont", "Blackburn",
      "Bowden", "Braddock", "Brennan", "Buckley", "Calhoun", "Carver",
      "Chandler", "Colter", "Crawford", "Crockett", "Dalton", "Dawson",
      "Doolin", "Driscoll", "Duvall", "Earp", "Everett", "Faraday",
      "Gallagher", "Gentry", "Hardin", "Hargrove", "Hatfield", "Holliday",
      "Hollis", "Kincaid", "Larkin", "Lawson", "Ledbetter", "Loomis",
      "Mabry", "Maddox", "McCall", "McCoy", "McGraw", "Mercer", "Morrow",
      "Mullins", "Nash", "Oakley", "Pickett", "Rawlins", "Reeves",
      "Ridley", "Sawyer", "Shelby", "Shepherd", "Slade", "Stoddard",
      "Sutter", "Tanner", "Vance", "Whitaker", "Younger",
    ],
  },
  {
    id: "fantasy",
    label: "Fantasy (erfunden)",
    female: [
      "Aelis", "Aerinne", "Alandra", "Alwyn", "Amariel", "Anwen",
      "Arienne", "Ashara", "Astraia", "Aurelys", "Avelina", "Branwen",
      "Briala", "Caelia", "Calliste", "Cerridwen", "Corvina", "Delwyn",
      "Eilwen", "Elandra", "Elara", "Elowen", "Ereni", "Esilde", "Faelith",
      "Fenna", "Fiora", "Gwenlyn", "Halla", "Idrilla", "Ilvara", "Ilyana",
      "Isolde", "Kaelith", "Kyra", "Liriel", "Lorwyn", "Lunara", "Maelis",
      "Marwen", "Melisande", "Merrilyn", "Mirabel", "Morwenna", "Naeris",
      "Nimue", "Nyressa", "Oriane", "Perrine", "Quenna", "Rhiannon",
      "Rowanne", "Sable", "Saerin", "Seraphine", "Sylvara", "Talia",
      "Thessaly", "Tirien", "Ulvira", "Vaella", "Verrin", "Vespera",
      "Wynne", "Xandria", "Yldra", "Zephyrine", "Elenwe", "Sorcha",
      "Maeve",
    ],
    male: [
      "Alaric", "Aldric", "Anselm", "Arden", "Arvel", "Baelan", "Bardric",
      "Berengar", "Brannoc", "Caedmon", "Calder", "Cassiel", "Cedric",
      "Corvin", "Dain", "Darrow", "Dorian", "Draven", "Eamon", "Edric",
      "Elric", "Emeric", "Eryndor", "Faelan", "Fendrel", "Galen",
      "Garrick", "Gethin", "Godric", "Hadrian", "Halric", "Harun", "Ilric",
      "Ivar", "Jareth", "Kael", "Kelric", "Korvan", "Lorcan", "Lucan",
      "Maelor", "Marrec", "Merric", "Mordecai", "Nolwen", "Oberon", "Orin",
      "Perrin", "Quillon", "Raelan", "Ragnvald", "Rhydian", "Roderic",
      "Rowan", "Sarian", "Silvan", "Sorren", "Tamlin", "Thalric", "Theron",
      "Torvald", "Ulrick", "Valen", "Varian", "Vesper", "Wendel",
      "Wyndham", "Xanther", "Yorick", "Zephyr",
    ],
    surnames: [
      "Amberfell", "Ashvale", "Blackbriar", "Bramblewood", "Brightmantle",
      "Caskwell", "Cinderfell", "Coldwater", "Crowmoor", "Dawnbreaker",
      "Duskbane", "Eldenwood", "Emberly", "Fairwind", "Fallowmere",
      "Frostmere", "Galewind", "Glimmerbrook", "Grayhelm", "Greenhollow",
      "Hallowbrook", "Harrowgate", "Hawkridge", "Highmoor", "Ironhold",
      "Ivyshade", "Larkspur", "Lightfoot", "Mistvale", "Moonhollow",
      "Nightbloom", "Northgate", "Oakenheart", "Ravenhurst", "Redmourne",
      "Riversong", "Rookwood", "Rosethorn", "Shadowmere", "Silverbrook",
      "Snowmantle", "Starfall", "Stonebrook", "Stormcaller", "Summerfell",
      "Sunmantle", "Thistledown", "Thornfield", "Tidewater", "Vexholm",
      "Wildemoor", "Willowbrook", "Winterbourne", "Wolfsbane", "Wyrmwood",
      "Yarrowfield", "Ashenmoor", "Brackenhall", "Hollowreach",
      "Marchwood",
    ],
  },
];

/**
 * Welche Kulturkreise zu welcher Genre-Vorlage passen (Ids aus
 * `templates.ts`). Mehrere Einträge werden gleich gewichtet gewürfelt – so
 * bleibt „Gegenwart" bunt, während Fantasy und Western eng geführt sind.
 */
/** Der Gegenwarts-Mix, weil zwei Genres ihn teilen und der Fallback ihn braucht. */
const GEGENWART_CULTURES = [
  "deutsch",
  "britisch",
  "nordisch",
  "slawisch",
  "romanisch",
  "japanisch",
];

export const GENRE_CULTURES: Record<string, string[]> = {
  gegenwart: GEGENWART_CULTURES,
  fantasy: ["fantasy"],
  steampunk: ["viktorianisch"],
  cyberpunk: ["japanisch", "britisch", "slawisch", "romanisch"],
  historisch: ["viktorianisch", "deutsch", "romanisch", "nordisch"],
  western: ["western"],
  // Diese drei greifen auf **bestehende** Namenslisten zu, statt eigene zu
  // bekommen: Eine Superheldenstadt ist eine Gegenwartsmetropole, und Science
  // Fiction ist die Gegenwart ohne den deutschen Schwerpunkt – die Herkünfte
  // haben sich vermischt, aber beliebig soll es nicht werden.
  // Das Märchen bekommt **zwei** Kreise: „fantasy" allein zieht anglophone
  // Klangnamen („Thessaly Riversong"), und die haben im Grimm’schen Register
  // nichts zu suchen. Erst mit „deutsch" daneben stimmt der Ton.
  scifi: ["britisch", "japanisch", "slawisch", "romanisch", "nordisch"],
  maerchen: ["deutsch", "fantasy"],
  superhelden: GEGENWART_CULTURES,
};

/** Kulturkreise, aus denen gewürfelt wird, wenn nichts anderes passt. */
const FALLBACK_CULTURES = GENRE_CULTURES.gegenwart;

/**
 * Stichwörter, mit denen eine im Freitext angegebene Herkunft einem
 * Kulturkreis zugeordnet wird. Bewusst **nur, was die Listen wirklich
 * abdecken** – „tibetisch" steht hier absichtlich nicht, dafür ist der
 * KI-Knopf da. Eine falsche Zuordnung wäre schlechter als gar keine.
 */
const HERKUNFT_HINTS: Record<string, string[]> = {
  deutsch: ["deutsch", "österreich", "schweiz", "bayer", "preuß", "sächsisch"],
  britisch: [
    "britisch", "englisch", "irisch", "schottisch", "walisisch",
    "amerikanisch", "kanadisch", "australisch",
  ],
  nordisch: [
    "nordisch", "skandinav", "schwed", "norweg", "dän", "isländ", "finn",
    "wiking",
  ],
  slawisch: [
    "slaw", "russ", "poln", "tschech", "ukrain", "serb", "kroat", "bulgar",
    "slowak",
  ],
  romanisch: [
    "italien", "spanisch", "portugies", "romanisch", "mexikan", "argentin",
    "brasilian", "latein",
  ],
  japanisch: ["japan", "nippon"],
};

/** Dasselbe für ein frei formuliertes Setting (Galerie kennt keine Genre-Id). */
const SETTING_HINTS: Record<string, string[]> = {
  fantasy: ["fantasy", "magie", "elfen", "drachen", "schwert"],
  western: ["western", "wilder westen", "prärie", "revolver", "saloon"],
  steampunk: ["steampunk", "viktorian", "dampfmaschin"],
  cyberpunk: ["cyberpunk", "neon", "megacity", "cyberware", "konzernmacht"],
  historisch: ["historisch", "antike", "mittelalter", "jahrhundert", "neuzeit"],
};

function matchHints(text: string, hints: Record<string, string[]>): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  for (const [key, words] of Object.entries(hints)) {
    if (words.some((w) => t.includes(w))) return key;
  }
  return null;
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Würfelt einen vollständigen Namen (Vor- + Nachname).
 *
 * Der Kulturkreis wird in dieser Reihenfolge bestimmt – die spezifischste
 * Angabe gewinnt:
 *
 * 1. `herkunft` (Freitext, z. B. „skandinavisch") – die konkreteste Aussage,
 *    die es über einen Namen gibt.
 * 2. `genre` – die exakte Vorlagen-Id aus `templates.ts` (nur das Formular
 *    kennt sie).
 * 3. `setting` (Freitext) – der Notnagel für gespeicherte Charaktere, die
 *    keine Genre-Id mehr haben.
 * 4. Sonst der bunte „Gegenwart"-Mix.
 *
 * Bei „divers"/„egal" wird aus beiden Vornamenslisten gezogen.
 *
 * Das Ergebnis ist bewusst zweiteilig: `buildTextPrompt` behandelt einen
 * Namen ab zwei Wörtern als vollständig und übernimmt ihn unverändert – ein
 * gewürfelter Name wird also genau so verwendet, wie er im Feld steht.
 */
export function randomName(options: {
  /**
   * Freitext, damit sowohl die Auswahl im Formular („weiblich") als auch das
   * Merkmal eines gespeicherten Charakters hineinpasst. Alles, was nicht
   * eindeutig weiblich oder männlich ist, zieht aus beiden Listen.
   */
  gender: string;
  herkunft?: string;
  genre?: string;
  setting?: string;
}): string {
  const { gender, herkunft = "", genre, setting = "" } = options;

  const viaHerkunft = matchHints(herkunft, HERKUNFT_HINTS);
  const viaSetting = matchHints(setting, SETTING_HINTS);
  const ids = viaHerkunft
    ? [viaHerkunft]
    : (genre && GENRE_CULTURES[genre]) ||
      (viaSetting && GENRE_CULTURES[viaSetting]) ||
      FALLBACK_CULTURES;

  const cultureId = pick(ids);
  const culture =
    NAME_CULTURES.find((c) => c.id === cultureId) ?? NAME_CULTURES[0];

  const g = gender.trim().toLowerCase();
  const pool = g.startsWith("weib")
    ? culture.female
    : g.startsWith("männ") || g.startsWith("mann")
      ? culture.male
      : [...culture.female, ...culture.male];

  return `${pick(pool)} ${pick(culture.surnames)}`;
}
