import type { Metadata } from "next";
import Link from "next/link";
import { seoArticles } from "@/lib/seo-articles";

export const metadata: Metadata = {
  title: "Dog Grooming Care & Insights | K9 Atelier",
  description: "Professional dog grooming and coat care insights from K9 Atelier Mobile Pet Spa in Palm Beach Gardens, Florida.",
  robots: seoArticles.length ? { index: true, follow: true } : { index: false, follow: true },
};

export default function BlogPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-500">K9 Atelier</p>
      <h1 className="mb-5 text-3xl font-semibold tracking-tight">Coat Care & Insights</h1>
      <p className="mb-12 max-w-2xl text-neutral-600">Thoughtful guidance on grooming, coat care, and keeping your dog comfortable.</p>
      <div className="grid gap-8 sm:grid-cols-2">
        {seoArticles.map((article) => (
          <article key={article.slug} className="border-b border-neutral-200 pb-6">
            <h2 className="mb-2 text-xl font-medium">
              <Link href={`/blog/${article.slug}`} className="hover:underline">{article.title}</Link>
            </h2>
            <p className="text-sm text-neutral-600">{article.description}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
