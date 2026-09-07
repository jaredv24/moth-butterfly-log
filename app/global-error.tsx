"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.1rem" }}>Something went wrong</h1>
        <p style={{ color: "#666" }}>
          Reload the page. If it keeps happening, try again later.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            borderRadius: 10,
            border: "1px solid #ccc",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
