/**
 * Berufsvorrat für den Würfel-Knopf am Feld „Beruf / Rolle".
 *
 * **Eine** Liste mit 300 Einträgen, jeder mit den Genres markiert, in die er
 * passt. Die Markierung ist der Kern der Sache: eine flache Liste würde einen
 * „Netrunner" ins Mittelalter und einen „Hufschmied" in die Cyberpunk-Megacity
 * würfeln. Viele Berufe passen in mehrere Genres (ein Schmied taugt für
 * Fantasy, Historisch, Western und Steampunk), einige nur in eines.
 *
 * Wie bei `names.ts` rein lokal, ohne API.
 *
 * Die Berufe stehen in der Grundform („Arzt", „Söldner"). Das Textmodell passt
 * sie beim Erzeugen an das gewählte Geschlecht an – das Feld ist ohnehin
 * Freitext und darf überschrieben werden.
 */

export interface Profession {
  name: string;
  /** Genre-Ids aus `templates.ts`. */
  genres: string[];
}

const G = "gegenwart";
const F = "fantasy";
const S = "steampunk";
const C = "cyberpunk";
const H = "historisch";
const W = "western";
const SF = "scifi";
const M = "maerchen";
const SH = "superhelden";

/**
 * Genres, die die Markierungen eines verwandten Genres **mit-** erben.
 *
 * Das ist der Unterschied zu `backgrounds.ts` und den Szenario-Listen, wo drei
 * neue Genres drei neue Listen zu hundert bekommen haben. Ein Lebenslauf trägt
 * sein Genre in sich, ein Beruf nicht: Ein Arzt bleibt ein Arzt, ob in der
 * Gegenwart oder in einer Superheldenstadt, und ein Müller ist im Märchen
 * derselbe wie in der Fantasy. Dreihundert Berufe abzuschreiben, um an
 * neunzig Prozent identischer Einträge eine zweite Markierung zu hängen, wäre
 * eine Kopie mit Pflegeaufwand, keine neue Liste.
 *
 * Geerbt wird nur die **Grundmenge**; was es in der geerbten Welt nicht gibt
 * (Netrunner im Märchen), fehlt dort schon in der Quelle. Genre-eigene Berufe
 * stehen unten in einem eigenen Block und sind direkt markiert.
 */
const GEERBT: Record<string, string> = {
  scifi: C,
  maerchen: F,
  superhelden: G,
};

export const PROFESSIONS: Profession[] = [
  // Medizin & Pflege ------------------------------------------------------
  { name: "Notarzt", genres: [G] },
  { name: "Chirurg", genres: [G, C] },
  { name: "Krankenpfleger", genres: [G] },
  { name: "Hebamme", genres: [G, H, F] },
  { name: "Psychologe", genres: [G, C] },
  { name: "Tierarzt", genres: [G, W] },
  { name: "Apotheker", genres: [G, H, S] },
  { name: "Rettungssanitäter", genres: [G] },
  { name: "Feldscher", genres: [H, F, S] },
  { name: "Bader", genres: [H, F] },

  // Recht & Ordnung -------------------------------------------------------
  { name: "Anwalt", genres: [G, C] },
  { name: "Richter", genres: [G, H, W] },
  { name: "Polizist", genres: [G] },
  { name: "Kriminalkommissar", genres: [G] },
  { name: "Privatdetektiv", genres: [G, C, H, S] },
  { name: "Notar", genres: [G, H, S] },

  // Wissen & Medien -------------------------------------------------------
  { name: "Journalist", genres: [G, C, S] },
  { name: "Fotograf", genres: [G] },
  { name: "Lehrer", genres: [G, H] },
  { name: "Professor", genres: [G, H, S] },
  { name: "Bibliothekar", genres: [G, H, F, S] },
  { name: "Archäologe", genres: [G, H, S] },
  { name: "Kartograf", genres: [H, F, S, W] },
  { name: "Chronist", genres: [H, F, S] },
  { name: "Schreiber", genres: [H, F, S] },
  { name: "Übersetzer", genres: [G, H, C] },
  { name: "Kurator", genres: [G, H, S] },
  { name: "Restaurator", genres: [G, H, S] },

  // Technik & Bau ---------------------------------------------------------
  { name: "Softwareentwickler", genres: [G, C] },
  { name: "Datenanalyst", genres: [G, C] },
  { name: "Netzwerktechniker", genres: [G, C] },
  { name: "Architekt", genres: [G, S, H] },
  { name: "Bauingenieur", genres: [G, S] },
  { name: "Elektriker", genres: [G] },
  { name: "Klempner", genres: [G] },
  { name: "Kfz-Mechaniker", genres: [G] },
  { name: "Maschinist", genres: [G, S] },
  { name: "Erfinder", genres: [S, F, G] },
  { name: "Feuerwehrmann", genres: [G] },

  // Verkehr ---------------------------------------------------------------
  { name: "Pilot", genres: [G] },
  { name: "Lokführer", genres: [G, S] },
  { name: "Kurierfahrer", genres: [G, C] },
  { name: "Logistiker", genres: [G, C] },
  { name: "Postkutschenfahrer", genres: [W, H] },
  { name: "Postreiter", genres: [W, H, F] },
  { name: "Fuhrmann", genres: [H, F, W] },
  { name: "Stallmeister", genres: [H, F, W] },

  // Essen & Trinken -------------------------------------------------------
  { name: "Koch", genres: [G, H, F] },
  { name: "Metzger", genres: [G, H, W] },
  { name: "Bäcker", genres: [G, H, F, W] },
  { name: "Brauer", genres: [H, F, W, S] },
  { name: "Winzer", genres: [G, H] },
  { name: "Kellner", genres: [G, H, S] },
  { name: "Barkeeper", genres: [G, C, W] },
  { name: "Saloonbesitzer", genres: [W] },
  { name: "Gastwirt", genres: [H, F, W, S] },

  // Kunst & Bühne ---------------------------------------------------------
  { name: "Schauspieler", genres: [G, H, S] },
  { name: "Opernsänger", genres: [G, H, S] },
  { name: "Konzertpianist", genres: [G, H, S] },
  { name: "Straßenmusiker", genres: [G, C, H] },
  { name: "Komponist", genres: [G, H, S] },
  { name: "Tänzer", genres: [G, H, C] },
  { name: "Zirkusartist", genres: [G, H, S, W] },
  { name: "Puppenspieler", genres: [G, H, F] },
  { name: "Schriftsteller", genres: [G, H, S] },
  { name: "Dichter", genres: [G, H, F, S] },
  { name: "Kunstfälscher", genres: [G, H, C] },
  { name: "Tätowierer", genres: [G, C] },
  { name: "Modedesigner", genres: [G, C, S] },

  // Handwerk --------------------------------------------------------------
  { name: "Schmied", genres: [F, H, W, S] },
  { name: "Hufschmied", genres: [F, H, W] },
  { name: "Waffenschmied", genres: [F, H, S] },
  { name: "Rüstungsschmied", genres: [F, H] },
  { name: "Büchsenmacher", genres: [W, S, H] },
  { name: "Böttcher", genres: [H, F, W] },
  { name: "Gerber", genres: [H, F, W] },
  { name: "Sattler", genres: [H, F, W] },
  { name: "Weber", genres: [H, F] },
  { name: "Färber", genres: [H, F] },
  { name: "Schneider", genres: [H, F, S, W] },
  { name: "Schuster", genres: [H, F, W] },
  { name: "Zimmermann", genres: [H, F, W] },
  { name: "Steinmetz", genres: [H, F, S] },
  { name: "Glasbläser", genres: [H, F, S] },
  { name: "Töpfer", genres: [H, F] },
  { name: "Seiler", genres: [H, F, W] },
  { name: "Müller", genres: [H, F, W] },
  { name: "Buchbinder", genres: [H, F, S] },
  { name: "Schriftsetzer", genres: [H, S, W] },
  { name: "Uhrmacher", genres: [G, H, S] },
  { name: "Chronometermacher", genres: [S] },
  { name: "Goldschmied", genres: [H, F, S] },
  { name: "Juwelier", genres: [G, H, S] },
  { name: "Instrumentenbauer", genres: [H, F, S] },
  { name: "Wagner", genres: [H, F, W] },
  { name: "Schreiner", genres: [G, H, W] },
  { name: "Schiffszimmermann", genres: [H, F, S] },

  // Land, Tier, Natur -----------------------------------------------------
  { name: "Bauer", genres: [G, H, F, W] },
  { name: "Schäfer", genres: [H, F, W] },
  { name: "Imker", genres: [G, H, F] },
  { name: "Jäger", genres: [H, F, W] },
  { name: "Wilderer", genres: [H, F, W] },
  { name: "Trapper", genres: [W, H] },
  { name: "Fallensteller", genres: [W, H, F] },
  { name: "Pelzhändler", genres: [W, H] },
  { name: "Fischer", genres: [G, H, F] },
  { name: "Walfänger", genres: [H, S] },
  { name: "Köhler", genres: [H, F] },
  { name: "Holzfäller", genres: [G, H, F, W] },
  { name: "Förster", genres: [G, H, F] },
  { name: "Kräuterkundiger", genres: [F, H] },
  { name: "Gärtner", genres: [G, H, F] },
  { name: "Rancher", genres: [W] },
  { name: "Cowboy", genres: [W] },
  { name: "Viehtreiber", genres: [W, H] },
  { name: "Pferdezüchter", genres: [W, H, F] },
  { name: "Falkner", genres: [H, F] },

  // Handel & Geld ---------------------------------------------------------
  { name: "Kaufmann", genres: [H, F, S, W] },
  { name: "Händler", genres: [H, F, C, W] },
  { name: "Hausierer", genres: [H, F, W] },
  { name: "Marktschreier", genres: [H, F] },
  { name: "Pfandleiher", genres: [H, S, W, C] },
  { name: "Bankier", genres: [G, H, S, W] },
  { name: "Buchhalter", genres: [G, H, S] },
  { name: "Steuereintreiber", genres: [H, F, S] },
  { name: "Zöllner", genres: [H, F, S] },
  { name: "Karawanenführer", genres: [F, H] },
  { name: "Schwarzmarkthändler", genres: [C, H, F] },
  { name: "Schmuggler", genres: [C, H, F, W] },
  { name: "Hehler", genres: [C, H, F, W] },
  { name: "Falschspieler", genres: [W, H, F] },

  // Militär, Wache, Söldner ----------------------------------------------
  { name: "Söldner", genres: [F, H, C] },
  { name: "Leibwächter", genres: [G, F, C, H] },
  { name: "Stadtwache", genres: [F, H] },
  { name: "Torwächter", genres: [F, H] },
  { name: "Bogenschütze", genres: [F, H] },
  { name: "Ritter", genres: [F, H] },
  { name: "Knappe", genres: [F, H] },
  { name: "Ordensritter", genres: [F, H] },
  { name: "Späher", genres: [F, H, W] },
  { name: "Kundschafter", genres: [F, H, W] },
  { name: "Waldläufer", genres: [F] },
  { name: "Kopfgeldjäger", genres: [W, F, C] },
  { name: "Sheriff", genres: [W] },
  { name: "Deputy", genres: [W] },
  { name: "Marshal", genres: [W] },
  { name: "Revolverheld", genres: [W] },
  { name: "Straßensamurai", genres: [C] },
  { name: "Konzernsoldat", genres: [C] },
  { name: "Sicherheitsberater", genres: [G, C] },
  { name: "Spion", genres: [G, H, C, S] },

  // Glaube, Magie, Mystik -------------------------------------------------
  { name: "Magier", genres: [F] },
  { name: "Hexer", genres: [F] },
  { name: "Druide", genres: [F] },
  { name: "Nekromant", genres: [F] },
  { name: "Beschwörer", genres: [F] },
  { name: "Runenschmied", genres: [F] },
  { name: "Alchemist", genres: [F, H, S] },
  { name: "Seher", genres: [F, H] },
  { name: "Traumdeuter", genres: [F, H] },
  { name: "Bestienzähmer", genres: [F] },
  { name: "Drachenjäger", genres: [F] },
  { name: "Reliquienjäger", genres: [F, H] },
  { name: "Grabräuber", genres: [F, H] },
  { name: "Gildenmeister", genres: [F, H] },
  { name: "Klosterbruder", genres: [F, H] },
  { name: "Prediger", genres: [W, H, F] },
  { name: "Barde", genres: [F, H] },
  { name: "Spielmann", genres: [F, H] },
  { name: "Gaukler", genres: [F, H] },
  { name: "Hofnarr", genres: [F, H] },

  // Dampf & Zahnrad -------------------------------------------------------
  { name: "Luftschiffkapitän", genres: [S] },
  { name: "Kesselwärter", genres: [S] },
  { name: "Dampftechniker", genres: [S] },
  { name: "Automatenbauer", genres: [S] },
  { name: "Zahnradmechaniker", genres: [S] },
  { name: "Aethertechniker", genres: [S] },
  { name: "Prothesenbauer", genres: [S, C] },
  { name: "Telegrafist", genres: [S, W, H] },
  { name: "Ballonfahrer", genres: [S, H] },
  { name: "Fabrikaufseher", genres: [S, H] },
  { name: "Laternenanzünder", genres: [S, H] },
  { name: "Grubeningenieur", genres: [S, W, H] },
  { name: "Minenarbeiter", genres: [W, H, S] },
  { name: "Eisenbahnarbeiter", genres: [W, S, H] },
  { name: "Goldsucher", genres: [W, H] },
  { name: "Leichenbestatter", genres: [W, H, G] },

  // Neon & Netz -----------------------------------------------------------
  { name: "Netrunner", genres: [C] },
  { name: "Datenschmuggler", genres: [C] },
  { name: "Ripperdoc", genres: [C] },
  { name: "Cyberware-Techniker", genres: [C] },
  { name: "Braindance-Editor", genres: [C] },
  { name: "Fixer", genres: [C] },
  { name: "Konzernspion", genres: [C] },
  { name: "Drohnenpilot", genres: [G, C] },
  { name: "Gentechniker", genres: [G, C] },
  { name: "KI-Trainer", genres: [G, C] },

  // Zur See ---------------------------------------------------------------
  { name: "Kapitän", genres: [H, F, S, W] },
  { name: "Steuermann", genres: [H, F, S] },
  { name: "Leuchtturmwärter", genres: [G, H, S] },

  // ======================================================================
  // Nachtrag Gegenwart: 100 weitere heutige Berufe. Alle tragen `G`; wo ein
  // Beruf darüber hinaus in ein anderes Genre passt, steht es dabei (das
  // hilft besonders Cyberpunk, dem sonst schmalsten Genre).
  // ======================================================================

  // Gesundheit ------------------------------------------------------------
  { name: "Zahnarzt", genres: [G] },
  { name: "Physiotherapeut", genres: [G] },
  { name: "Kinderarzt", genres: [G] },
  { name: "Psychiater", genres: [G, C] },
  { name: "Augenoptiker", genres: [G] },
  { name: "Radiologe", genres: [G] },
  { name: "Ergotherapeut", genres: [G] },
  { name: "Logopäde", genres: [G] },
  { name: "Ernährungsberater", genres: [G] },
  { name: "Altenpfleger", genres: [G] },
  { name: "Rettungsschwimmer", genres: [G] },
  { name: "Pathologe", genres: [G, C] },

  // Bildung & Wissenschaft ------------------------------------------------
  { name: "Erzieher", genres: [G] },
  { name: "Nachhilfelehrer", genres: [G] },
  { name: "Meeresbiologe", genres: [G, S] },
  { name: "Astrophysiker", genres: [G, C] },
  { name: "Meteorologe", genres: [G, S] },
  { name: "Geologe", genres: [G, S, W] },
  { name: "Chemielaborant", genres: [G, S] },
  { name: "Statistiker", genres: [G, C] },
  { name: "Historiker", genres: [G, H, S] },
  { name: "Sprachwissenschaftler", genres: [G, H] },

  // IT & Digitales --------------------------------------------------------
  { name: "Penetrationstester", genres: [G, C] },
  { name: "Systemadministrator", genres: [G, C] },
  { name: "Datenbankadministrator", genres: [G, C] },
  { name: "UX-Designer", genres: [G, C] },
  { name: "Produktmanager", genres: [G, C] },
  { name: "Spieleentwickler", genres: [G, C] },
  { name: "Spieletester", genres: [G, C] },
  { name: "Streamer", genres: [G, C] },
  { name: "Podcaster", genres: [G, C] },
  { name: "Social-Media-Manager", genres: [G, C] },

  // Medien & Kreatives ----------------------------------------------------
  { name: "Grafikdesigner", genres: [G, C] },
  { name: "Illustrator", genres: [G, S] },
  { name: "Kameramann", genres: [G, C] },
  { name: "Cutter", genres: [G, C] },
  { name: "Tontechniker", genres: [G, C] },
  { name: "Synchronsprecher", genres: [G] },
  { name: "Regisseur", genres: [G] },
  { name: "Drehbuchautor", genres: [G] },
  { name: "Lektor", genres: [G, H] },
  { name: "Werbetexter", genres: [G, C] },

  // Handwerk & Industrie --------------------------------------------------
  { name: "Dachdecker", genres: [G, H] },
  { name: "Maurer", genres: [G, H, S, W] },
  { name: "Fliesenleger", genres: [G] },
  { name: "Schlosser", genres: [G, H, S] },
  { name: "Anlagenmechaniker", genres: [G, S] },
  { name: "Feinmechaniker", genres: [G, S] },
  { name: "Schweißer", genres: [G, S] },
  { name: "Industriemechaniker", genres: [G, S] },
  { name: "Werkzeugmacher", genres: [G, S, H] },
  { name: "Glaser", genres: [G, H, S] },
  { name: "Raumausstatter", genres: [G] },
  { name: "Schornsteinfeger", genres: [G, H, S] },

  // Verkehr & Logistik ----------------------------------------------------
  { name: "Fluglotse", genres: [G] },
  { name: "Flugbegleiter", genres: [G] },
  { name: "Busfahrer", genres: [G] },
  { name: "Taxifahrer", genres: [G, C] },
  { name: "Fernfahrer", genres: [G] },
  { name: "Zugbegleiter", genres: [G, S] },
  { name: "Kranführer", genres: [G, C] },
  { name: "Hafenarbeiter", genres: [G, H, S] },
  { name: "Staplerfahrer", genres: [G] },
  { name: "Paketzusteller", genres: [G, C] },

  // Handel & Wirtschaft ---------------------------------------------------
  { name: "Einzelhandelskaufmann", genres: [G] },
  { name: "Immobilienmakler", genres: [G, C] },
  { name: "Versicherungsmakler", genres: [G] },
  { name: "Steuerberater", genres: [G] },
  { name: "Wirtschaftsprüfer", genres: [G, C] },
  { name: "Unternehmensberater", genres: [G, C] },
  { name: "Einkäufer", genres: [G] },
  { name: "Filialleiter", genres: [G] },
  { name: "Marktforscher", genres: [G, C] },
  { name: "Investmentbanker", genres: [G, C] },

  // Gastronomie & Tourismus -----------------------------------------------
  { name: "Konditor", genres: [G, H, S] },
  { name: "Sommelier", genres: [G, H] },
  { name: "Barista", genres: [G] },
  { name: "Hotelmanager", genres: [G, S] },
  { name: "Reiseleiter", genres: [G] },
  { name: "Bergführer", genres: [G, H] },
  { name: "Skilehrer", genres: [G] },
  { name: "Tauchlehrer", genres: [G] },

  // Öffentlicher Dienst & Soziales ----------------------------------------
  { name: "Sozialarbeiter", genres: [G] },
  { name: "Bewährungshelfer", genres: [G] },
  { name: "Standesbeamter", genres: [G, H] },
  { name: "Zollbeamter", genres: [G] },
  { name: "Bürgermeister", genres: [G, H, W, F] },
  { name: "Politiker", genres: [G, C] },
  { name: "Diplomat", genres: [G, H, S, C] },
  { name: "Berufssoldat", genres: [G, C] },
  { name: "Grenzbeamter", genres: [G, C] },
  { name: "Rettungshundeführer", genres: [G] },

  // Sport, Tier & Umwelt --------------------------------------------------
  { name: "Profisportler", genres: [G] },
  { name: "Fitnesstrainer", genres: [G, C] },
  { name: "Yogalehrer", genres: [G] },
  { name: "Schiedsrichter", genres: [G] },
  { name: "Sportkommentator", genres: [G, C] },
  { name: "Tierpfleger", genres: [G, H] },
  { name: "Baumpfleger", genres: [G] },
  { name: "Umweltgutachter", genres: [G] },

  // Science Fiction -------------------------------------------------------
  { name: "Schiffsnavigator", genres: [SF] },
  { name: "Frachtpilot", genres: [SF] },
  { name: "Schiffsingenieur", genres: [SF] },
  { name: "Lebenserhaltungstechniker", genres: [SF] },
  { name: "Schleusenwart", genres: [SF] },
  { name: "Funkoffizier", genres: [SF] },
  { name: "Terraformer", genres: [SF] },
  { name: "Xenobiologe", genres: [SF] },
  { name: "Astrogeologe", genres: [SF] },
  { name: "Kolonieverwalter", genres: [SF] },
  { name: "Quarantäneoffizier", genres: [SF] },
  { name: "Hydroponikgärtner", genres: [SF] },
  { name: "Bergungstaucher", genres: [SF] },
  { name: "Kybernetiker", genres: [SF, C] },
  { name: "Robotiktechniker", genres: [SF, C] },
  { name: "Kälteschlaftechniker", genres: [SF] },
  { name: "Vertragsmakler", genres: [SF, C] },
  { name: "Reaktortechniker", genres: [SF] },
  { name: "Sprungtorlotse", genres: [SF] },
  { name: "Aufbereitungsarbeiter", genres: [SF] },

  // Märchen ---------------------------------------------------------------
  { name: "Rattenfänger", genres: [M, F, H] },
  { name: "Schweinehirt", genres: [M, F, H] },
  { name: "Gänsehirt", genres: [M, F] },
  { name: "Leineweber", genres: [M, F, H] },
  { name: "Fährmann", genres: [M, F, H] },
  { name: "Kesselflicker", genres: [M, F, H] },
  { name: "Korbflechter", genres: [M, F, H] },
  { name: "Brunnengräber", genres: [M, F, H] },
  { name: "Kräuterfrau", genres: [M, F] },
  { name: "Wildhüter", genres: [M, F, H] },
  { name: "Küchenmagd", genres: [M, F, H] },
  { name: "Bienenvater", genres: [M, F, H] },
  { name: "Wegezöllner", genres: [M, F, H] },
  { name: "Bänkelsänger", genres: [M, H] },
  { name: "Salzhändler", genres: [M, F, H] },
  { name: "Ziegenhirt", genres: [M, F, H] },
  { name: "Besenbinder", genres: [M, F, H] },
  { name: "Waldköhler", genres: [M, F, H] },
  { name: "Glöckner", genres: [M, F, H] },
  { name: "Findelvogt", genres: [M, F] },

  // Superhelden -----------------------------------------------------------
  { name: "Katastrophenschutzbeauftragter", genres: [SH, G] },
  { name: "Krisenmanager", genres: [SH, G] },
  { name: "Sondereinsatzleiter", genres: [SH] },
  { name: "Fähigkeitengutachter", genres: [SH] },
  { name: "Registrierungsbeamter", genres: [SH] },
  { name: "Schadensregulierer", genres: [SH, G] },
  { name: "Trümmerräumer", genres: [SH] },
  { name: "Notfallpsychologe", genres: [SH, G] },
  { name: "Kostümschneider", genres: [SH] },
  { name: "Verbindungsoffizier", genres: [SH, G] },
  { name: "Enthüllungsjournalist", genres: [SH, G, C] },
  { name: "Boulevardreporter", genres: [SH, G] },
  { name: "Konzernanwalt", genres: [SH, G, C] },
  { name: "Sonderermittler", genres: [SH, G] },
  { name: "Rehabilitationstrainer", genres: [SH, G] },
  { name: "Gerichtsgutachter", genres: [SH, G] },
  { name: "Drohnenoperator", genres: [SH, G, C] },
  { name: "Wachdienstleiter", genres: [SH, G] },
  { name: "Aufsichtsbeamter", genres: [SH, G] },
  { name: "Anlaufstellenleiter", genres: [SH, G] },
];

/**
 * Würfelt einen Beruf, der zum Genre passt. Ohne bekanntes Genre (oder wenn
 * es dafür keine Einträge gäbe) steht die ganze Liste zur Auswahl.
 *
 * Genres aus `GEERBT` bekommen zusätzlich die Berufe ihres Quell-Genres – s.
 * die Begründung dort.
 */
export function randomProfession(genre?: string): string {
  const geerbt = genre ? GEERBT[genre] : undefined;
  const passend = genre
    ? PROFESSIONS.filter(
        (p) =>
          p.genres.includes(genre) ||
          (geerbt !== undefined && p.genres.includes(geerbt)),
      )
    : [];
  const pool = passend.length > 0 ? passend : PROFESSIONS;
  return pool[Math.floor(Math.random() * pool.length)].name;
}
