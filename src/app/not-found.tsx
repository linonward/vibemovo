"use client";

import NextError from "next/error";

// Renders for paths outside any locale, e.g. /unknown.txt, where the
// [locale] layout can't render.
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body>
        <NextError statusCode={404} />
      </body>
    </html>
  );
}
