import type { CharacterInput } from "./schema";

/**
 * Genre-Vorlagen für das Erstellen-Formular. Eine Vorlage belegt beim Auswählen
 * per Merge nur die enthaltenen Felder vor (aktuell das Steuer-Feld `setting`) –
 * alle übrigen Eingaben bleiben erhalten.
 *
 * „Gegenwart" verhält sich wie ohne Vorlage (leeres Setting) und ist der
 * Standard.
 */
export interface GenreTemplate {
  id: string;
  label: string;
  emoji: string;
  values: Partial<CharacterInput>;
}

export const DEFAULT_GENRE = "gegenwart";

/**
 * Genre-Id → Anzeigename mit Emoji. Gespeichert wird überall die **Id**
 * (`cyberpunk`), angezeigt das Label – diese Funktion ist die einzige Stelle,
 * die das übersetzt.
 */
export function genreLabel(id: string): string {
  const t = GENRE_TEMPLATES.find((g) => g.id === id);
  return t ? `${t.emoji} ${t.label}` : id;
}

export const GENRE_TEMPLATES: GenreTemplate[] = [
  {
    id: "gegenwart",
    label: "Gegenwart",
    emoji: "🏙️",
    values: { setting: "" },
  },
  {
    id: "fantasy",
    label: "Fantasy",
    emoji: "🐉",
    values: {
      setting:
        "Hochfantasy in einer mittelalterlichen Welt voller Magie, Schwerter und Fabelwesen",
    },
  },
  {
    id: "steampunk",
    label: "Steampunk",
    emoji: "⚙️",
    values: {
      setting:
        "Steampunk-Welt mit viktorianischem Flair, Dampfmaschinen und Zahnrad-Technik",
    },
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    emoji: "🌃",
    values: {
      setting:
        "Cyberpunk-Megacity: Neonlicht, Konzernmacht, Cyberware und soziale Gegensätze",
    },
  },
  {
    id: "historisch",
    label: "Historisch",
    emoji: "🏛️",
    values: {
      setting:
        "Historisches Setting einer realen vergangenen Epoche (z. B. Antike, Mittelalter oder frühe Neuzeit), ohne übernatürliche Elemente",
    },
  },
  {
    id: "western",
    label: "Western",
    emoji: "🤠",
    values: {
      setting:
        "Wilder Westen Nordamerikas im 19. Jahrhundert: Prärie, Revolver, Saloons und Grenzland",
    },
  },
];
