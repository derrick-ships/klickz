import type { Metadata } from "next";
import "./globals.css";
import "./surfaces.css";
import "./review.css";
export const metadata: Metadata = {
  title: "OpenPikzels — Your thumbnail studio",
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
