import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceCategoryView } from "@/components/services/ServiceCategoryView";
import {
  SERVICE_CATEGORIES,
  absoluteSiteUrl,
  getServiceCategory,
} from "@/lib/service-page";

type Props = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return SERVICE_CATEGORIES.map((category) => ({ slug: category.slug }));
}

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
  };
}

export default async function ServiceCategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = getServiceCategory(slug);
  if (!category) notFound();

  return <ServiceCategoryView category={category} />;
}
