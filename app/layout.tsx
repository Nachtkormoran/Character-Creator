import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import Link from "next/link";
import ThemeToggle from "./components/ThemeToggle";
import { Nav } from "./components/Nav";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display-Serif „Modernes Atelier" – nur für Titel und Charakter-/Werknamen.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Charakter Creator",
  description:
    "Erstelle glaubwürdige menschliche Charaktere für Buch oder Spiel – mit KI-Text, Merkmals-Tabelle und Portrait.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {/* Skip-Link: erstes fokussierbares Element, für Tastatur/Screenreader. */}
        <a
          href="#inhalt"
          className="sr-only rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
        >
          Zum Inhalt
        </a>

        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 rounded-md"
              aria-label="Charakter Creator – Startseite"
            >
              {/* Wortmarke: schlichte Feder-/Personen-Glyphe statt Emoji. */}
              <svg
                viewBox="0 0 24 24"
                className="size-6 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="8" r="3.25" />
                <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
              </svg>
              <span className="font-display text-lg font-semibold tracking-tight">
                Charakter Creator
              </span>
            </Link>
            <div className="flex items-center gap-1.5">
              <Nav />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main
          id="inhalt"
          className="mx-auto w-full max-w-6xl flex-1 px-6 py-8"
        >
          {children}
        </main>
      </body>
    </html>
  );
}
