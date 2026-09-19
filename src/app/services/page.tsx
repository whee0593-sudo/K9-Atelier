import type { Metadata } from "next";
import { ConsultationPrompt } from "@/components/services/ConsultationPrompt";
import { ServiceDirectory } from "@/components/services/ServiceDirectory";
import { ServiceNotes } from "@/components/services/ServiceNotes";
import { ServicesHashRedirect } from "@/components/services/ServicesHashRedirect";
import { ServicesHero } from "@/components/services/ServicesHero";
import {
  SERVICES_PAGE_DESCRIPTION,
  SERVICES_PAGE_TITLE,
  SERVICES_PATH,
  absoluteSiteUrl,
} from "@/lib/service-page";

const canonical = absoluteSiteUrl(SERVICES_PATH);

export const metadata: Metadata = {
  title: SERVICES_PAGE_TITLE,
  description: SERVICES_PAGE_DESCRIPTION,
  alternates: {
    canonical,
  },
};

export default function ServicesPage() {
  return (
    <div className="overflow-x-clip">
      <ServicesHashRedirect />
      <ServicesHero />
      <ServiceDirectory />
      <ConsultationPrompt />
      <ServiceNotes />
    </div>
  );
}
