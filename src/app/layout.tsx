import type { Metadata } from "next";
import Script from "next/script";
import { SiteShell } from "@/components/SiteShell";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import { bodyFont, displayFont } from "@/lib/fonts";
import { GOOGLE_ADS_ID } from "@/lib/google-ads";
import "./globals.css";

const siteTitle =
  "K9 Atelier Mobile Pet Spa | Best in Show Grooming — Jupiter, Palm Beach Gardens, West Palm Beach";
const siteDescription =
  "Cage-free Private Mobile Pet Spa for dogs under 45 lbs, led by a Best in Show-honored groomer. Serving Jupiter, Palm Beach Gardens & West Palm Beach.";

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
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-ads-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_ID}');
          `}
        </Script>
        <LocalBusinessJsonLd />
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
