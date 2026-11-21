import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Dog Grooming Care & Insights | K9 Atelier",
  description: "Dog grooming, coat care and pet spa insights for Palm Beach Gardens and surrounding communities.",
  alternates: { canonical: "https://k9atelier.com/blog" },
  robots: { index: true, follow: true },
};

export default function BlogPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="mb-10 text-center">
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-neutral-500">K9 Atelier</p>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">Coat Care & Insights</h1>
      </header>
      <div id="soro-blog" className="min-h-48" />
      <Script src="https://app.trysoro.com/api/embed/2552e62e-4873-4492-9e2d-5cdfd98d2d29" strategy="afterInteractive" />
    </main>
  );
}
