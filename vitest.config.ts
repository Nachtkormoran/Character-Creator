import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Test-Harness **nur für die pure `lib/`-Logik** (kein DOM/React) – z. B. die
 * fragilen Dokument-Invarianten der Szenario-Seite (`lib/scenarioDocument.ts`).
 * Der Pfad-Alias `@/*` spiegelt `tsconfig.json` (zeigt auf den Repo-Root).
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
