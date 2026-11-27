import type { Metadata } from "next";
import "./globals.css";
import "./surfaces.css";
import "./review.css";
import "./creative.css";
import "./welcome.css";
import "./polish.css";
import "./media.css";
import "./gestures.css";
import "./preflight.css";
export const metadata: Metadata = {
  title: "OpenPikzels — Pre-Flight Packaging & Audience Intelligence",
  description:
    "Pre-production YouTube packaging triangulation, synthetic 16-Mind audience simulation, and executive pre-flight reports.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
