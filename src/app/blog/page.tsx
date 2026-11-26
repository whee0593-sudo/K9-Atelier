import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { absoluteSiteUrl, FULL_GROOM_PATH, HAND_STRIPPING_PATH, SPECIALTY_CARE_PATH } from "@/lib/service-page";

export const metadata: Metadata = {
  title: "Dog Grooming Care & Insights | K9 Atelier",
  description: "Dog grooming, coat care and pet spa insights for Palm Beach Gardens and surrounding communities.",
  alternates: { canonical: absoluteSiteUrl("/blog") },
  robots: { index: true, follow: true },
};

export default function BlogPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="mb-10 text-center">
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-neutral-500">K9 Atelier</p>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Coat Care & Insights</h1>
      </header>
      <section aria-label="Grooming topics" className="mx-auto mb-10 max-w-3xl space-y-4 text-ink">
        <p>
          Penny has groomed professionally since 2010. Explore how she approaches
          wire-coat maintenance, styling and comfort during private mobile appointments in the Palm Beach area.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><Link href={HAND_STRIPPING_PATH} className="underline">Hand stripping for wire-coated dogs</Link></li>
          <li><Link href={SPECIALTY_CARE_PATH} className="underline">Gentle grooming for senior dogs</Link></li>
          <li><Link href={FULL_GROOM_PATH} className="underline">Full grooming and tailored styling</Link></li>
          <li><Link href="/gallery" className="underline">Asian Fusion styling and other examples of Penny’s work</Link></li>
        </ul>
      </section>
      <div id="soro-blog" className="min-h-48" />
      <Script src="https://app.trysoro.com/api/embed/2552e62e-4873-4492-9e2d-5cdfd98d2d29" strategy="afterInteractive" />
    </main>
  );
}
