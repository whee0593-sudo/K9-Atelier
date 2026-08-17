import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { bodyFont, displayFont } from "@/lib/fonts";
import "./globals.css";

const siteTitle =
  "K9 Atelier | Best in Show Grooming — Jupiter, Palm Beach Gardens, West Palm Beach";
const siteDescription =
  "Cage-free mobile grooming for dogs under 45 lbs, led by a Best in Show-honored groomer. Serving Jupiter, Palm Beach Gardens & West Palm Beach.";

export const metadata: Metadata = {
  metadataBase: new URL("https://k9atelier.com"),
  title: siteTitle,
  description: siteDescription,
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      {
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    title: siteTitle,
    description: siteDescription,
  },
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
