import { BathCoatJsonLd } from "@/components/seo/BathCoatJsonLd";
import { FullGroomJsonLd } from "@/components/seo/FullGroomJsonLd";
import { HandStrippingJsonLd } from "@/components/seo/HandStrippingJsonLd";
import { SpecialtyCareJsonLd } from "@/components/seo/SpecialtyCareJsonLd";
import { BathCoatEditorial } from "@/components/services/BathCoatEditorial";
import { CreativeColoringSection } from "@/components/services/CreativeColoringSection";
import { FullGroomEditorial } from "@/components/services/FullGroomEditorial";
import { HandStrippingEditorial } from "@/components/services/HandStrippingEditorial";
import { MobileBookBar } from "@/components/services/MobileBookBar";
import { ServiceCard } from "@/components/services/ServiceCard";
import { ServiceWorkPhoto } from "@/components/services/ServiceWorkPhoto";
import { ServicesHashRedirect } from "@/components/services/ServicesHashRedirect";
import { ServicesNav } from "@/components/services/ServicesNav";
import { ServicesSection } from "@/components/services/ServicesSection";
import type { ServiceCategory } from "@/lib/service-page";
import { LONG_COAT_CARE_PATH } from "@/lib/long-coat-care-page";
import {
  SERVICE_ANCHORS,
  SPECIALTY_CARE_AREA_SENTENCE,
  SPECIALTY_CARE_PENNY_AFTER,
  SPECIALTY_CARE_PENNY_BEFORE,
  SPECIALTY_CARE_PENNY_NAME,
  SPECIALTY_CARE_SENIOR_DETAIL,
  SPECIALTY_CARE_SENIOR_INDIVIDUAL,
  SPECIALTY_CARE_SERVICE_ID,
  getServiceById,
  getServicesByIds,
  specialtyCareDisplayService,
} from "@/lib/service-page";

type Props = {
  category: ServiceCategory;
};

function serviceGridClass(count: number) {
  if (count <= 1) return "mx-auto max-w-2xl";
  if (count >= 3) return "grid gap-6 lg:grid-cols-3";
  return "grid gap-6 lg:grid-cols-2";
}

export function ServiceCategoryView({ category }: Props) {
  const services = getServicesByIds(category.serviceIds);
  const coloring = getServiceById("creative-accent-coloring");
  const hasWorkPhoto = ["full-groom", "hand-stripping", "color"].includes(category.slug);

  return (
    <div className="pb-24 md:pb-0">
      {category.slug === "bath-coat-care" ? <BathCoatJsonLd /> : null}
      {category.slug === "full-groom" ? <FullGroomJsonLd /> : null}
      {category.slug === "hand-stripping" ? <HandStrippingJsonLd /> : null}
      {category.slug === "specialty-care" ? <SpecialtyCareJsonLd /> : null}
      <ServicesHashRedirect />
      <ServicesNav />
      <ServicesSection
        id={category.slug}
        eyebrow={category.pageEyebrow}
        title={category.pageH1}
        titleAs="h1"
        titleClassName={
          category.slug === "specialty-care" ? "text-balance text-pretty" : undefined
        }
        intro={category.pageIntro}
        tone="white"
      >
        <div className={hasWorkPhoto ? "grid items-start gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]" : undefined}>
        {hasWorkPhoto ? <div className="order-2 lg:order-1"><ServiceWorkPhoto slug={category.slug} /></div> : null}
        <div className="order-1 min-w-0 lg:order-2">
        {category.layout === "coloring" && coloring ? (
          <CreativeColoringSection service={coloring} />
        ) : (
          <div className={serviceGridClass(services.length)}>
            {services.map((service) => {
              const displayed =
                category.slug === "specialty-care"
                  ? specialtyCareDisplayService(service)
                  : service;
              return (
                <ServiceCard
                  key={service.id}
                  service={displayed}
                  headingAs="h2"
                  quiet={service.id === "end-of-life-care"}
                  anchorId={SERVICE_ANCHORS[service.id] ?? service.id}
                  detailsInitiallyOpen={service.id === SPECIALTY_CARE_SERVICE_ID}
                  detailParagraphs={
                    service.id === SPECIALTY_CARE_SERVICE_ID
                      ? [SPECIALTY_CARE_SENIOR_DETAIL, SPECIALTY_CARE_SENIOR_INDIVIDUAL]
                      : undefined
                  }
                  leadLink={
                    service.id === SPECIALTY_CARE_SERVICE_ID
                      ? {
                          before: SPECIALTY_CARE_PENNY_BEFORE,
                          label: SPECIALTY_CARE_PENNY_NAME,
                          after: SPECIALTY_CARE_PENNY_AFTER,
                          href: "/about",
                        }
                      : undefined
                  }
                  learnMoreHref={
                    service.id === "show-level-coat-care" ||
                    service.id === "long-coat-show-care"
                      ? LONG_COAT_CARE_PATH
                      : undefined
                  }
                  learnMoreLabel={
                    service.id === "show-level-coat-care" ||
                    service.id === "long-coat-show-care"
                      ? "Show-Level Coat Care"
                      : undefined
                  }
                />
              );
            })}
          </div>
        )}
        </div>
        </div>
        {category.slug === "specialty-care" ? (
          <p className="font-body mx-auto mt-10 max-w-2xl text-center text-pretty text-sm leading-relaxed text-taupe">
            {SPECIALTY_CARE_AREA_SENTENCE}
          </p>
        ) : null}
      </ServicesSection>
      {category.slug === "bath-coat-care" ? <BathCoatEditorial /> : null}
      {category.slug === "full-groom" ? <FullGroomEditorial /> : null}
      {category.slug === "hand-stripping" ? <HandStrippingEditorial /> : null}
      <MobileBookBar />
    </div>
  );
}
