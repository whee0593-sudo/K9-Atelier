import type { Metadata } from "next";
import { ServicesJsonLd } from "@/components/seo/ServicesJsonLd";
import { ConsultationPrompt } from "@/components/services/ConsultationPrompt";
import { ServiceDirectory } from "@/components/services/ServiceDirectory";
import { ServiceNotes } from "@/components/services/ServiceNotes";
import { ServicesHashRedirect } from "@/components/services/ServicesHashRedirect";
import { ServicesHero } from "@/components/services/ServicesHero";
import { ServicesIntroduction } from "@/components/services/ServicesIntroduction";
import { viewerCanViewServicePrices } from "@/lib/pricing-access";
import {
  SERVICES_PAGE_CANONICAL,
  SERVICES_PAGE_DESCRIPTION,
  SERVICES_PAGE_TITLE,
} from "@/lib/service-page";

export const metadata: Metadata = {
  title: SERVICES_PAGE_TITLE,
  description: SERVICES_PAGE_DESCRIPTION,
  alternates: {
    canonical: SERVICES_PAGE_CANONICAL,
  },
  openGraph: {
    title: SERVICES_PAGE_TITLE,
    description: SERVICES_PAGE_DESCRIPTION,
    url: SERVICES_PAGE_CANONICAL,
  },
  twitter: {
    title: SERVICES_PAGE_TITLE,
    description: SERVICES_PAGE_DESCRIPTION,
  },
};

export default async function ServicesPage() {
  const showPrices = await viewerCanViewServicePrices();
  return (
    <div className="bg-[#FAF7F2] text-[#302D33] [--color-ivory:#FAF7F2] [--color-ink:#302D33] [--color-deep-lavender:#513562] [--color-dusty-lavender:#EEE7F3] [--color-champagne:#735783] [&_h1]:text-[#382440] [&_h2]:text-[#382440] [&_h3]:text-[#382440]">
      <ServicesJsonLd />
      <ServicesHashRedirect />
      <ServicesHero />
      <ServiceDirectory showPrices={showPrices} />
      <ServicesIntroduction />
      <ConsultationPrompt />
      <ServiceNotes />
    </div>
  );
}
