import { CreativeBookingPolicy } from "@/components/booking/CreativeBookingPolicy";
import { CreativeOptionDetail } from "@/components/booking/CreativeOptionDetail";
import { BookServiceLink } from "@/components/booking/BookServiceLink";
import { ServiceFeesSection } from "@/components/ServiceFeesSection";
import { Container } from "@/components/luxury/Container";
import { Eyebrow } from "@/components/luxury/Eyebrow";
import { PageShell } from "@/components/luxury/PageShell";
import { business, formatDuration, formatPrice } from "@/lib/business";
import {
  getCreativeBookingPolicy,
  isSpaService,
} from "@/lib/services";

export const metadata = {
  title: "Services · K9 Atelier",
  description:
    "Signature grooming, spa rituals, specialty care and gentle comfort services — Private Mobile Pet Spa in Palm Beach.",
};

const categoryAnchors: Record<string, string> = {
  "bath-show-spa": "bath-show-spa",
  "full-grooming": "full-grooming",
  "add-on-care": "add-on-care",
  "signature-grooming": "signature-grooming",
  "spa-wellness": "spa-wellness",
  "specialty-care": "specialty-care",
  "gentle-care": "gentle-care",
};

const serviceAnchors: Record<string, string> = {
  "signature-bath-care": "signature-bath",
  "custom-full-haircut": "atelier-full-groom",
  "long-coat-show-care": "long-coat-show-care",
};

const creativeBookingPolicy = getCreativeBookingPolicy();

function TierTable({
  tiers,
  priceOnly = false,
}: {
  tiers: Array<{
    weightTier: string;
    priceFrom: number;
    durationMin?: number;
    durationMax?: number;
  }>;
  priceOnly?: boolean;
}) {
  const labels = Object.fromEntries(
    business.weightTiers.map((t) => [t.id, t.label]),
  );

  return (
    <div className="mt-4 overflow-hidden border border-gray-line/80">
      <table className="w-full text-left text-sm">
        <thead className="bg-dusty-lavender/35">
          <tr>
            <th className="px-4 py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-taupe">
              Weight
            </th>
            <th className="px-4 py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-taupe">
              Price
            </th>
            {!priceOnly && (
              <th className="px-4 py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-taupe">
                Duration
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr key={tier.weightTier} className="border-t border-gray-line/60">
              <td className="px-4 py-3 text-ink">{labels[tier.weightTier]}</td>
              <td className="px-4 py-3 text-ink">
                {`From ${formatPrice(tier.priceFrom)}`}
              </td>
              {!priceOnly && (
                <td className="px-4 py-2">
                  {formatDuration(tier.durationMin ?? 0, tier.durationMax)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <PageShell
      eyebrow="Signature Services"
      title="Grooming, Considered Down to Every Detail."
      intro={
        <>
          <p>
            Redefining pet care with premium, mobile grooming solutions brought
            directly to your home — coat-specific styling and calm, one-on-one
            care.
          </p>
          <p className="mt-4 text-sm">
            Starting prices reflect a typical appointment within each weight
            range. Final pricing may vary based on coat condition, grooming
            requirements, temperament and the time required to complete the
            service comfortably.
          </p>
        </>
      }
    >
      {business.weightPolicy && (
        <div className="mb-12 border border-gray-line/80 bg-dusty-lavender/20 p-6 text-sm leading-relaxed text-ink">
          {business.weightPolicy.over45Note}
        </div>
      )}

      <div className="space-y-20">
        {business.serviceCategories.map((category) => (
          <section
            key={category.id}
            id={categoryAnchors[category.id] ?? category.id}
            className="scroll-mt-28"
          >
            <Eyebrow>{category.name}</Eyebrow>
            <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
              {category.name}
            </h2>
            {"note" in category && category.note && (
              <p className="mt-2 text-sm italic text-text-muted">
                {category.note}
              </p>
            )}

            <div className="mt-10 space-y-8">
              {category.services.map((service) => {
                const s = service as Record<string, unknown>;
                const anchorId = serviceAnchors[service.id];
                const spaTreatments =
                  "spaTreatments" in category
                    ? (
                        category as {
                          spaTreatments?: {
                            note?: string;
                            includesAll?: string[];
                          };
                        }
                      ).spaTreatments
                    : undefined;
                const showSpaIntro =
                  isSpaService(service.id) &&
                  service.id === "dead-sea-mud-bath" &&
                  spaTreatments;

                return (
                  <div key={service.id} className="space-y-8">
                    {showSpaIntro && spaTreatments && (
                      <div
                        id="spa-wellness"
                        className="scroll-mt-28 border border-gray-line/80 bg-dusty-lavender/20 p-6 text-sm"
                      >
                        {spaTreatments.note && (
                          <p className="italic text-text-muted">
                            {spaTreatments.note}
                          </p>
                        )}
                        {spaTreatments.includesAll && (
                          <div className="mt-4">
                            <p className="font-body text-[11px] font-medium uppercase tracking-[0.14em] text-taupe">
                              All spa treatments include
                            </p>
                            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                              {spaTreatments.includesAll.map((item) => (
                                <li key={item} className="text-ink">
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  <article
                    id={anchorId}
                    className={`border border-gray-line/80 bg-ivory p-6 md:p-8 ${
                      anchorId ? "scroll-mt-28" : ""
                    }`}
                  >
                    <h3 className="font-display text-2xl text-ink md:text-3xl">
                      {service.name}
                    </h3>
                    {"bestFor" in service && service.bestFor && (
                      <p className="font-body mt-3 text-sm text-taupe">
                        <span className="font-medium uppercase tracking-[0.1em] text-ink">
                          Best for:
                        </span>{" "}
                        {service.bestFor}
                      </p>
                    )}
                    <p className="font-body mt-4 whitespace-pre-line text-sm leading-relaxed text-taupe">
                      {service.description}
                    </p>

                    {Array.isArray(s.includes) && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-text">Includes:</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-muted">
                          {(s.includes as string[]).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {"note" in service && service.note && (
                      <p className="mt-4 text-sm text-text-muted">{service.note}</p>
                    )}

                    {"policyNote" in service && service.policyNote && (
                      <p className="mt-4 text-sm text-text-muted">
                        <span className="font-medium text-text">
                          Policy Note:{" "}
                        </span>
                        {service.policyNote}
                      </p>
                    )}

                    {"tiers" in service &&
                      service.tiers &&
                      service.pricingType === "tiered" && (
                      <TierTable tiers={service.tiers} />
                    )}

                    {"hourlyRate" in service && service.hourlyRate && (
                      <div className="mt-4 text-sm font-medium text-gold-dark">
                        <p>{formatPrice(service.hourlyRate)} / hour</p>
                        <p className="mt-1 font-normal text-text-muted">
                          {"durationNote" in service && service.durationNote
                            ? service.durationNote
                            : formatDuration(
                                service.durationMin ?? 90,
                                service.durationMax,
                              )}
                        </p>
                      </div>
                    )}

                    {typeof s.flatRate === "number" &&
                      service.pricingType === "add_on" && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gold-dark">
                          {typeof s.durationMin === "number"
                            ? `From ${formatPrice(s.flatRate as number)} / ${s.durationMin} mins (Add-on)`
                            : `From ${formatPrice(s.flatRate as number)} (Add-on)`}
                        </p>
                      </div>
                    )}

                    {Array.isArray(s.tiers) && service.pricingType === "add_on" && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gold-dark">
                          Additional fee (added to base bath or grooming price):
                        </p>
                        <TierTable
                          tiers={s.tiers as Array<{
                            weightTier: string;
                            priceFrom: number;
                            durationMin?: number;
                            durationMax?: number;
                          }>}
                          priceOnly
                        />
                        {"suitableFor" in service && service.suitableFor && (
                          <p className="mt-2 text-sm text-text-muted">
                            Suitable for: {service.suitableFor}
                          </p>
                        )}
                      </div>
                    )}

                    {typeof s.addOnMin === "number" && !Array.isArray(s.tiers) && (
                      <div className="mt-4 text-sm">
                        <p className="font-medium text-gold-dark">
                          Additional fee: From {formatPrice(s.addOnMin as number)}{" "}
                          (added to base bath or grooming price)
                        </p>
                        {"suitableFor" in service && service.suitableFor && (
                          <p className="mt-1 text-text-muted">
                            Suitable for: {service.suitableFor}
                          </p>
                        )}
                      </div>
                    )}

                    {"options" in service && service.options && (
                      <ul className="mt-4 space-y-2 text-sm">
                        {service.options.map((opt) =>
                          service.id === "creative-accent-coloring" ? (
                            <li
                              key={opt.name}
                              className="border-b border-lavender/20 pb-6 last:border-0"
                            >
                              <CreativeOptionDetail option={opt} />
                            </li>
                          ) : (
                          <li
                            key={opt.name}
                            className="flex justify-between gap-4 border-b border-lavender/20 pb-2 last:border-0"
                          >
            <span>
              {opt.name}
              {"description" in opt && opt.description && (
                <span className="mt-1 block text-xs leading-relaxed text-text-muted">
                  {opt.description}
                </span>
              )}
              {"note" in opt && opt.note && (
                <span className="mt-1 block text-xs text-gold-dark">
                  {opt.note}
                </span>
              )}
            </span>
                            <span className="shrink-0 font-medium text-gold-dark">
                              {"consultationRequired" in opt &&
                              opt.consultationRequired
                                ? "Consultation required"
                                : opt.priceFrom != null
                                  ? `From ${formatPrice(opt.priceFrom)}`
                                  : "—"}
                            </span>
                          </li>
                          ),
                        )}
                      </ul>
                    )}

                    {"pricingType" in service &&
                      service.pricingType === "consultation" && (
                        <p className="mt-4 text-sm text-text-muted">
                          Please contact us to discuss your dog&apos;s needs and
                          pricing.
                        </p>
                      )}

                    {"pricingType" in service &&
                      service.pricingType === "free" && (
                        <p className="mt-4 text-sm font-medium text-gold-dark">
                          Complimentary · By appointment only
                        </p>
                      )}

                    {service.id === "creative-accent-coloring" &&
                      creativeBookingPolicy && (
                        <CreativeBookingPolicy
                          policy={creativeBookingPolicy}
                          className="mt-6"
                        />
                      )}
                  </article>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <ServiceFeesSection />
      </div>

      <div className="mt-16 text-center">
        <BookServiceLink className="inline-flex min-h-[52px] items-center justify-center rounded-sm bg-deep-lavender px-8 text-[10px] font-medium uppercase tracking-[0.16em] text-ivory transition hover:bg-ink">
          Book an Appointment
        </BookServiceLink>
      </div>
    </PageShell>
  );
}
