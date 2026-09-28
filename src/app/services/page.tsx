import type { Metadata } from "next";
import { ServicesJsonLd } from "@/components/seo/ServicesJsonLd";
import { ConsultationPrompt } from "@/components/services/ConsultationPrompt";
import { ServiceDirectory } from "@/components/services/ServiceDirectory";
import { ServiceNotes } from "@/components/services/ServiceNotes";
import { ServicesHashRedirect } from "@/components/services/ServicesHashRedirect";
import { ServicesHero } from "@/components/services/ServicesHero";
import { ServicesIntroduction } from "@/components/services/ServicesIntroduction";
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

export default function ServicesPage() {
  return (
    <div>
      <ServicesJsonLd />
      <ServicesHashRedirect />
      <ServicesHero />
      <ServiceDirectory />
      <ServicesIntroduction />
      <ConsultationPrompt />
      <ServiceNotes />
    </div>
  );
}
