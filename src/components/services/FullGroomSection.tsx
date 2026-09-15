import { ServiceCard } from "@/components/services/ServiceCard";
import { ServicesSection } from "@/components/services/ServicesSection";
import {
  FULL_GROOM_IDS,
  FULL_GROOM_PAGE_H1,
  FULL_GROOM_PAGE_INTRO,
  getServicesByIds,
} from "@/lib/service-page";

type Props = {
  variant?: "hub" | "page";
};

export function FullGroomSection({ variant = "hub" }: Props) {
  const fullGroom = getServicesByIds(FULL_GROOM_IDS);
  const headingAs = variant === "page" ? "h2" : "h3";

  const cards = (
    <div className="grid gap-6 lg:grid-cols-2">
      {fullGroom.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          headingAs={headingAs}
          anchorId={
            service.id === "custom-full-haircut"
              ? "atelier-full-groom"
              : service.id
          }
        />
      ))}
    </div>
  );

  if (variant === "page") {
    return (
      <ServicesSection
        id="full-groom"
        eyebrow="Full Groom"
        title={FULL_GROOM_PAGE_H1}
        titleAs="h1"
        intro={FULL_GROOM_PAGE_INTRO}
        tone="white"
      >
        {cards}
      </ServicesSection>
    );
  }

  return (
    <ServicesSection
      id="full-groom"
      eyebrow="Full Grooming & Hand Stripping"
      title="A Complete Style, Done With Patience."
      intro={FULL_GROOM_PAGE_INTRO}
      tone="white"
    >
      {cards}
    </ServicesSection>
  );
}
