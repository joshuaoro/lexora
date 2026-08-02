import type { Metadata } from "next";
import { Nunito, Lexend, Atkinson_Hyperlegible, Comic_Neue } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

// Reader font options — all chosen for dyslexia-friendly letterforms
const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const atkinson = Atkinson_Hyperlegible({
  variable: "--font-atkinson",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const comic = Comic_Neue({
  variable: "--font-comic",
  subsets: ["latin"],
  weight: ["400", "700"],
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
