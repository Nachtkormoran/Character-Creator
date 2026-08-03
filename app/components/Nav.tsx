"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Hauptnavigation mit **Aktiv-Zustand**: die aktuelle Route wird farblich und
 * per `aria-current` hervorgehoben (vorher gab es keine Kennzeichnung). Eigene
 * Client-Komponente, weil `usePathname` clientseitig ist; das Layout bleibt so
 * eine Server-Komponente.
 */
const LINKS = [
  { href: "/gallery", label: "Charaktere" },
  { href: "/scenarios", label: "Szenarien" },
  { href: "/library", label: "Bibliothek" },
  { href: "/settings", label: "Einstellungen" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 text-sm">
      {LINKS.map((link) => {
        const active =
          pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
