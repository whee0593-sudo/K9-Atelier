import { CreativeColoringSection } from "@/components/services/CreativeColoringSection";
import { FeesPoliciesSection } from "@/components/services/FeesPoliciesSection";
import { MobileBookBar } from "@/components/services/MobileBookBar";
import { ServiceCard } from "@/components/services/ServiceCard";
import { ConsultationPrompt } from "@/components/services/ConsultationPrompt";
import { ServicesHero } from "@/components/services/ServicesHero";
import { ServicesNav } from "@/components/services/ServicesNav";
import { ServicesSection } from "@/components/services/ServicesSection";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import {
  ADD_ON_IDS,
  BATH_COAT_IDS,
  FULL_GROOM_IDS,
  MOST_REQUESTED_IDS,
  SPA_IDS,
  getServiceById,
  getServicesByIds,
  serviceCardSummary,
  spaIncludesItems,
} from "@/lib/service-page";

export const metadata = {
  title: "Services · K9 Atelier",
  description:
    "Signature grooming, spa rituals, specialty care and gentle comfort services — Private Mobile Pet Spa in Palm Beach.",
};

export default function ServicesPage() {
  const featured = getServicesByIds(MOST_REQUESTED_IDS);
  const bathCoat = getServicesByIds(BATH_COAT_IDS);
  const fullGroom = getServicesByIds(FULL_GROOM_IDS);
  const spa = getServicesByIds(SPA_IDS);
  const addOns = getServicesByIds(ADD_ON_IDS);
  const coloring = getServiceById("creative-accent-coloring");
  const senior = getServiceById("senior-comfort-care");
  const endOfLife = getServiceById("end-of-life-care");
  const spaIncludes = spaIncludesItems();

  return (
    <div className="pb-24 md:pb-0">
      <ServicesHero />
      <ConsultationPrompt />
      <ServicesNav />

      <ServicesSection
        id="most-requested"
        eyebrow="Most Requested"
        title="The Appointments Clients Book Most."
        intro="Three starting points for a calm, one-on-one visit — chosen for coat care, a complete style, or weekly long-coat maintenance."
        tone="mist"
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {featured.map((service) => (
            <ServiceCard key={service.id} service={service} featured />
          ))}
        </div>
      </ServicesSection>

      <ServicesSection
        id="bath-coat"
        eyebrow="Bath & Coat Care"
        title="Coat Health, Kept Beautiful."
        intro="Foundational bathing and weekly long-coat care, tailored to texture, length, and how your dog lives."
        tone="ivory"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {bathCoat.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              anchorId={
                service.id === "signature-bath-care"
                  ? "signature-bath"
                  : service.id
              }
            />
          ))}
        </div>
      </ServicesSection>

      <ServicesSection
        id="full-groom"
        eyebrow="Full Grooming & Hand Stripping"
        title="A Complete Style, Done With Patience."
        intro="Custom haircuts and traditional hand stripping for coats that need more than a bath."
        tone="white"
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {fullGroom.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              anchorId={
                service.id === "custom-full-haircut"
                  ? "atelier-full-groom"
                  : service.id
              }
            />
          ))}
        </div>
      </ServicesSection>

      <ServicesSection
        id="spa-rituals"
        eyebrow="Spa Rituals"
        title="Quiet Rituals for Skin, Coat & Comfort."
        intro="Spa Rituals include a complete wellness bath experience and are best scheduled separately from full haircut appointments to prevent over-tiring your dog."
        tone="mist"
      >
        {spaIncludes.length > 0 && (
          <div
            id="spa-wellness"
            className="mx-auto mb-8 max-w-3xl scroll-mt-[15rem] border border-gray-line/80 bg-ivory/80 px-6 py-5"
          >
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
        <div className="grid gap-6 lg:grid-cols-3">
          {spa.map((service) => (
            <ServiceCard key={service.id} service={service} anchorId={service.id} />
          ))}
        </div>
      </ServicesSection>

      {coloring && (
        <ServicesSection
          id="color-dye"
          eyebrow="Color Dye"
          title="A Playful, Pet-Safe Finish."
          intro={serviceCardSummary(coloring)}
          tone="white"
        >
          <CreativeColoringSection service={coloring} />
        </ServicesSection>
      )}

      <ServicesSection
        id="specialty-care"
        extraId="gentle-care"
        eyebrow="Specialty Care"
        title="Comfort, Dignity, and Unhurried Time."
        intro="For dogs who need a slower pace — whether for age, recovery, or a quieter last chapter."
        tone="mist"
        showRequestLink={false}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {senior && (
            <ServiceCard service={senior} anchorId={senior.id} />
          )}
          {endOfLife && (
            <ServiceCard
              service={endOfLife}
              quiet
              anchorId={endOfLife.id}
              requestLabel="Request an Appointment"
            />
          )}
        </div>
        <p className="mt-8 text-center">
          <BookServiceLink className="font-body inline-flex min-h-[44px] items-center text-[10px] font-medium uppercase tracking-[0.16em] text-taupe transition hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne">
            Request an Appointment
          </BookServiceLink>
        </p>
      </ServicesSection>

      <ServicesSection
        id="add-ons"
        eyebrow="Add-On Care"
        title="Small Refinements, When Needed."
        intro="Added to a bath, show-care, spa, or full grooming appointment as needed."
        tone="white"
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {addOns.map((service) => (
            <ServiceCard key={service.id} service={service} anchorId={service.id} />
          ))}
        </div>
      </ServicesSection>

      <ServicesSection
        id="fees-policies"
        eyebrow="Service Fees & Policies"
        title="Clear Terms, Quietly Stated."
        intro="Open any item for the full rule. Starting prices are not a fixed quote."
        tone="ivory"
        showRequestLink={false}
      >
        <FeesPoliciesSection />
      </ServicesSection>

      <section className="bg-dusty-lavender/20 py-16 md:py-20">
        <div className="mx-auto max-w-xl px-5 text-center">
          <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
            Private Appointments
          </p>
          <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
            Reserve a Calm, One-on-One Visit.
          </h2>
          <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
            You add a card after choosing your date and time — you will not be
            charged when you book.
          </p>
          <BookServiceLink className="mt-8 inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[10px] font-medium uppercase tracking-[0.16em] text-ivory transition hover:bg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne">
            Request an Appointment
          </BookServiceLink>
        </div>
      </section>

      <MobileBookBar />
    </div>
  );
}
