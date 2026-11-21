export type SeoArticle = { slug: string; title: string; description: string; publishedAt: string; paragraphs: string[] };
/** Only reviewed and approved articles belong in this list. */
export const seoArticles: SeoArticle[] = [];
export const getSeoArticle = (slug: string) => seoArticles.find(article => article.slug === slug);
