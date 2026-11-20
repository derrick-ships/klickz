import type { Metadata } from "next";
import "./globals.css";
import "./surfaces.css";
import "./review.css";
import "./creative.css";
import "./welcome.css";
import "./polish.css";
import "./media.css";
export const metadata: Metadata = {
  title: "OpenPikzels",
  description:
    "Create, recreate and improve thumbnails with your personas, references and five-pillar image analysis.",
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
