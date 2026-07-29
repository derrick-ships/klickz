import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Klickz",
  description: "AI thumbnail maker that keeps you in control.",
};

/**
 * Fonts load via a plain stylesheet link rather than next/font because the
 * canvas needs them by their real family names — next/font rewrites families
 * to hashed CSS variables, which ctx.font cannot resolve.
 */
const GOOGLE_FONTS_HREF =
  "https://fonts.googleapis.com/css2" +
  "?family=Anton" +
  "&family=Bebas+Neue" +
  "&family=Big+Shoulders+Display:wght@800" +
  "&family=Inter:wght@400;500;600;700" +
  "&family=Lato:wght@700" +
  "&family=League+Spartan:wght@800" +
  "&family=Montserrat:wght@800" +
  "&family=Oswald:wght@700" +
  "&family=Poppins:wght@800" +
  "&display=swap";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={GOOGLE_FONTS_HREF} />
      </head>
      <body className="bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}
