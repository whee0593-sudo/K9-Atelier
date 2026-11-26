import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeoArticle, seoArticles } from "@/lib/seo-articles";
import { absoluteSiteUrl } from "@/lib/service-page";

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() {
  return seoArticles.map(({ slug }) => ({ slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getSeoArticle((await params).slug);
  if (!article) return { robots: { index: false } };
  return {
    title: `${article.title} | K9 Atelier`,
    description: article.description,
    alternates: { canonical: absoluteSiteUrl(`/blog/${article.slug}`) },
    openGraph: { title: article.title, description: article.description, type: "article" },
  };
}
export default async function ArticlePage({ params }: Props) {
  const article = getSeoArticle((await params).slug);
  if (!article) notFound();
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Link href="/blog" className="text-sm text-neutral-500 hover:underline">Coat Care & Insights</Link>
      <article className="mt-8">
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">{article.title}</h1>
        <time className="text-sm text-neutral-500" dateTime={article.publishedAt}>{article.publishedAt}</time>
        <div className="mt-10 space-y-6 leading-8 text-neutral-700">
          {article.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </article>
      <div className="mt-16 border-t border-neutral-200 pt-8">
        <Link href="/book" className="font-medium underline underline-offset-4">Book Online</Link>
      </div>
    </main>
  );
}
