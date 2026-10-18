import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceCategoryView } from "@/components/services/ServiceCategoryView";
import { viewerCanViewServicePrices } from "@/lib/pricing-access";
import { absoluteSiteUrl, getServiceCategory } from "@/lib/service-page";

type Props = {
  params: Promise<{ slug: string }>;
};

/** Prices depend on the staff session cookie, so this page cannot be prerendered. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = getServiceCategory(slug);
  if (!category) return {};

  const canonical = absoluteSiteUrl(category.path);
  return {
    title: category.pageTitle,
    description: category.pageDescription,
    alternates: { canonical },
    openGraph: {
      title: category.pageTitle,
      description: category.pageDescription,
      url: canonical,
    },
    ...(category.slug === "full-groom" ||
    category.slug === "hand-stripping" ||
    category.slug === "bath-coat-care" ||
    category.slug === "specialty-care"
      ? {
          twitter: {
            title: category.pageTitle,
            description: category.pageDescription,
          },
        }
      : {}),
  };
}

export default async function ServiceCategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = getServiceCategory(slug);
  if (!category) notFound();
  const showPrices = await viewerCanViewServicePrices();

  return <ServiceCategoryView category={category} showPrices={showPrices} />;
}
