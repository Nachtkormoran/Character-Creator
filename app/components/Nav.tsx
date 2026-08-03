"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

/**
 * Hauptnavigation mit **Aktiv-Zustand** (`aria-current` + Hervorhebung) und
 * **responsivem Verhalten**: ab `sm` horizontale Links, darunter ein
 * Menü-Knopf mit Dropdown – sonst überliefe der Header (Wortmarke + 4 Links +
 * Theme-Umschalter) auf schmalen Geräten. Eigene Client-Komponente, weil
 * `usePathname` clientseitig ist; das Layout bleibt Server-Komponente.
 */
const LINKS = [
  { href: "/gallery", label: "Charaktere" },
  { href: "/scenarios", label: "Szenarien" },
  { href: "/library", label: "Bibliothek" },
  { href: "/settings", label: "Einstellungen" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Esc schließt das mobile Menü.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Desktop: horizontale Links */}
      <nav
        aria-label="Hauptnavigation"
        className="hidden items-center gap-1 text-sm sm:flex"
      >
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-2.5 py-2 font-medium transition-colors ${
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

      {/* Mobil: Menü-Knopf + Dropdown (44px Trefferfläche, große Tap-Ziele). */}
      <div className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
          className="flex size-11 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          {open ? (
            <X size={22} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Menu size={22} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>

        {open && (
          <>
            {/* Klick außerhalb schließt. */}
            <button
              type="button"
              aria-label="Menü schließen"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 cursor-default"
            />
            <nav
              aria-label="Hauptnavigation"
              className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-[var(--shadow-lg)]"
            >
              {LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {link.label}
                  </Link>

                );
              })}
            </nav>
          </>
        )}
      </div>
    </>
  );
}
