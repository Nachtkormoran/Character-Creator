"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  applyTheme,
  THEME_LABELS,
  THEME_STORAGE_KEY,
  THEMES,
  type Theme,
} from "@/lib/theme";

const ICONS: Record<Theme, string> = {
  light: "☀️",
  dark: "🌙",
  system: "🖥️",
};

/* Kleiner Store über localStorage: getSnapshot muss einen stabilen Wert
   liefern, deshalb der Cache. */
const listeners = new Set<() => void>();
let cached: Theme = "system";

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  const next = THEMES.includes(stored as Theme) ? (stored as Theme) : "system";
  if (next !== cached) cached = next;
  return cached;
}

// Der Server kennt die Wahl nicht – bis zur Hydration ist nichts markiert.
function getServerSnapshot(): Theme | null {
  return null;
}

function store(next: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, next);
  applyTheme(next);
  listeners.forEach((listener) => listener());
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Bei "System" auf Änderungen der OS-Einstellung reagieren.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <div
      role="group"
      aria-label="Farbschema"
      className="flex items-center gap-0.5 rounded-md border border-black/10 p-0.5 dark:border-white/10"
    >
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => store(option)}
          aria-pressed={theme === option}
          title={THEME_LABELS[option]}
          className={`rounded px-2 py-1 text-sm leading-none transition ${
            theme === option
              ? "bg-foreground/10"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          <span aria-hidden="true">{ICONS[option]}</span>
          <span className="sr-only">{THEME_LABELS[option]}</span>
        </button>
      ))}
    </div>
  );
}
