import { CreativeColoringSection } from "@/components/services/CreativeColoringSection";
import { MobileBookBar } from "@/components/services/MobileBookBar";
import { ServiceCard } from "@/components/services/ServiceCard";
import { ServicesNav } from "@/components/services/ServicesNav";
import { ServicesSection } from "@/components/services/ServicesSection";
import type { ServiceCategory } from "@/lib/service-page";
import {
  SERVICE_ANCHORS,
  getServiceById,
  getServicesByIds,
  spaIncludesItems,
} from "@/lib/service-page";

type Props = {
  category: ServiceCategory;
};

export function ServiceCategoryView({ category }: Props) {
  const services = getServicesByIds(category.serviceIds);
  const coloring = getServiceById("creative-accent-coloring");
  const spaIncludes = category.slug === "spa" ? spaIncludesItems() : [];
  const columns =
    services.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  return (
    <div className="pb-24 md:pb-0">
      <ServicesNav />
      <ServicesSection
        id={category.slug}
        eyebrow={category.pageEyebrow}
        title={category.pageH1}
        titleAs="h1"
        intro={category.pageIntro}
        tone="white"
      >
        {spaIncludes.length > 0 && (
          <div className="mx-auto mb-8 max-w-3xl border border-gray-line/80 bg-ivory/80 px-6 py-5">
            <p className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-taupe">
              All spa treatments include
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {spaIncludes.map((item) => (
                <li key={item} className="font-body text-sm text-ink">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {category.layout === "coloring" && coloring ? (
          <CreativeColoringSection service={coloring} />
        ) : (
          <div className={`grid gap-6 ${columns}`}>
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                headingAs="h2"
                quiet={service.id === "end-of-life-care"}
                anchorId={SERVICE_ANCHORS[service.id] ?? service.id}
              />
            ))}
          </div>
        )}
      </ServicesSection>
      <MobileBookBar />
    </div>
  );
}
