import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Test-Harness für die **pure `lib/`-Logik** (Dokument-Invarianten) **und** für
 * **Hook-/Komponenten-Tests** der Szenario-Seite (jsdom + Testing-Library),
 * mit denen sich das Laufzeit-Verhalten der Hooks (tippen→ungespeichert,
 * Speichern-Payload, Verwerfen, Run-Params-Reihenfolge) automatisiert prüfen
 * lässt – die `lib/client.ts`-Aufrufe werden dabei gemockt (kein Server/DB).
 * Der Pfad-Alias `@/*` spiegelt `tsconfig.json` (Repo-Root).
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts", "app/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
