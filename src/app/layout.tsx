import type { Metadata } from "next";
import { Nunito, Lexend, Atkinson_Hyperlegible, Comic_Neue } from "next/font/google";
import "./globals.css";

// The interface font. Preloaded, because every page renders in it.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

/*
 * Reader font options — dyslexia-friendly letterforms the learner picks between
 * in Settings.
 *
 * `preload: false` on all three: only one is ever active, and only on reading
 * surfaces, so preloading them everywhere put ~100KB of unused fonts on pages
 * like the login screen. The browser now fetches whichever one is actually
 * applied. `display: "swap"` means text is readable in the interface font
 * while that happens, so nothing is ever invisible.
 */
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  preload: false,
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
});

const comic = Comic_Neue({
  variable: "--font-comic",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "LEXORA — Reading Support for Persons with Dyslexia",
  description:
    "AI-assisted reading and progress tracking web application for persons with dyslexia. Word-level Filipino reading practice following the Marungko Approach.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} ${lexend.variable} ${atkinson.variable} ${comic.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
