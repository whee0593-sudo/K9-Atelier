import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { bodyFont, displayFont } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "K9 Atelier | Private Mobile Dog Grooming in Palm Beach",
  description:
    "Award-winning private mobile dog grooming serving Palm Beach Gardens and surrounding communities. One-on-one, cage-free grooming, bespoke styling and luxury Spa rituals by K9 Atelier.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body className="min-h-screen antialiased font-body">
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
