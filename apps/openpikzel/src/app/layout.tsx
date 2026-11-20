import type { Metadata } from "next";
import "./globals.css";
import "./surfaces.css";
import "./review.css";
import "./creative.css";
import "./welcome.css";
export const metadata: Metadata = {
  title: "Not found · OpenPikzels",
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
