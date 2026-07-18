export const THEMES = ["light", "dark", "system"] as const;

export type Theme = (typeof THEMES)[number];

export const THEME_STORAGE_KEY = "theme";

export const THEME_LABELS: Record<Theme, string> = {
  light: "Hell",
  dark: "Dunkel",
  system: "System",
};

/**
 * Läuft blockierend im <head>, bevor der erste Frame gemalt wird – sonst
 * blitzt beim Laden kurz das falsche Theme auf. Bewusst als String, damit er
 * ohne Bundling/Hydration direkt ins HTML kann.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var dark =
      stored === "dark" ||
      ((!stored || stored === "system") &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}
