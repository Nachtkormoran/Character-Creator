import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Nach jedem Test das gerenderte DOM abräumen (sonst tragen sich Komponenten
// über Testgrenzen hinweg an).
afterEach(() => {
  cleanup();
});
