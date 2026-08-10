"use client";

import { useEffect } from "react";

/**
 * The last catch, for errors nothing else can hold.
 *
 * `(app)/error.tsx` covers everything behind sign-in, but the public pages —
 * the landing page, sign in, register, the privacy notice — sit outside that
 * group, so until now a crash on any of them fell through to Next's own error
 * screen: unstyled, English-only, no way back, and the very first thing a
 * parent or a reading specialist would see. This boundary also replaces the
 * root layout when it fires, which is why it renders its own <html> and <body>
 * and cannot rely on the fonts or stylesheet loaded there.
 *
 * Deliberately plain and self-contained: a fallback that needs the app's CSS to
 * look right is a fallback that fails at exactly the moment it is needed. The
 * colours are the brand's, inlined, so it degrades to something legible rather
 * than to a white page with black Times New Roman.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unrecoverable page error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          backgroundColor: "#faf5ec",
          color: "#22304a",
          fontFamily: "ui-rounded, system-ui, -apple-system, sans-serif",
        }}
      >
        <main
          style={{
            maxWidth: "32rem",
            width: "100%",
            textAlign: "center",
            backgroundColor: "#ffffff",
            border: "1px solid #e6ded0",
            borderRadius: "1.5rem",
            padding: "2.5rem 2rem",
          }}
        >
          <span style={{ fontSize: "3rem" }} aria-hidden>
            🌧️
          </span>
          <h1 style={{ margin: "1rem 0 0", fontSize: "1.5rem", fontWeight: 800 }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0.5rem 0 0", fontWeight: 600, color: "#4a5872", lineHeight: 1.6 }}>
            LEXORA could not load this page. This is usually a connection problem — please try
            again.
          </p>

          <div
            style={{
              marginTop: "1.75rem",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "center",
            }}
          >
            <button
              onClick={reset}
              style={{
                cursor: "pointer",
                border: "none",
                borderRadius: "0.75rem",
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                fontWeight: 700,
                color: "#ffffff",
                backgroundColor: "#4b698d",
              }}
            >
              Try again
            </button>
            {/*
              A real anchor, not next/link, and the lint rule is wrong for this
              one case. This boundary only renders when the root layout itself
              has failed, so the React tree and the client router it depends on
              are the things that broke. A soft navigation would route inside
              that broken runtime; a full document load is the only thing that
              reliably gets the user back to a working page.
            */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                borderRadius: "0.75rem",
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                fontWeight: 700,
                textDecoration: "none",
                color: "#22304a",
                border: "1px solid #e6ded0",
              }}
            >
              Go to the start page
            </a>
          </div>

          {error.digest && (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", fontWeight: 600, color: "#5f6779" }}>
              If you need to report this, the reference is {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
