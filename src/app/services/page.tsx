import Link from "next/link";
import { ServiceFeesSection } from "@/components/ServiceFeesSection";
import { business, formatDuration, formatPrice } from "@/lib/business";

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
    <div className="mt-4 overflow-hidden rounded-xl border border-lavender/30">
      <table className="w-full text-left text-sm">
        <thead className="bg-lavender-light/60">
          <tr>
            <th className="px-4 py-2 font-medium">Weight</th>
            <th className="px-4 py-2 font-medium">Price</th>
            {!priceOnly && <th className="px-4 py-2 font-medium">Duration</th>}
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr key={tier.weightTier} className="border-t border-lavender/20">
              <td className="px-4 py-2">{labels[tier.weightTier]}</td>
              <td className="px-4 py-2">
                {priceOnly
                  ? `+${formatPrice(tier.priceFrom)}`
                  : `${formatPrice(tier.priceFrom)}+`}
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
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-gold-dark">Services & Pricing</h1>
      <p className="mt-3 max-w-2xl text-text-muted">
        Redefining pet care with premium, mobile grooming solutions brought
        directly to your home. We specialize in coat-specific styling and
        personalized, calm-centered care that puts your dog&apos;s wellbeing
        first. No cages, no rush—just dedicated 1-on-1 pampering. Final pricing
        varies based on your dog&apos;s temperament, coat condition, and severe
        matting.
      </p>

      {business.weightPolicy && (
        <div className="mt-6 rounded-xl border border-blue/40 bg-blue/10 p-4 text-sm text-text">
          {business.weightPolicy.over45Note}
        </div>
      )}

      <div className="mt-12 space-y-16">
        {business.serviceCategories.map((category) => (
          <section key={category.id}>
            <h2 className="text-2xl font-semibold text-text">
              {category.name}
            </h2>
            {"note" in category && category.note && (
              <p className="mt-2 text-sm italic text-text-muted">
                {category.note}
              </p>
            )}
            {"includesAll" in category && category.includesAll && (
              <div className="mt-4 rounded-xl border border-lavender/30 bg-lavender-light/20 p-4 text-sm">
                <p className="font-medium text-text">All spa treatments include:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-text-muted">
                  {category.includesAll.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-8 space-y-8">
              {category.services.map((service) => {
                const s = service as Record<string, unknown>;

                return (
                  <article
                    key={service.id}
                    className="rounded-2xl border border-lavender/30 bg-cream p-6"
                  >
                    <h3 className="text-xl font-medium text-gold-dark">
                      {service.name}
                    </h3>
                    {"bestFor" in service && service.bestFor && (
                      <p className="mt-2 text-sm font-medium text-gold-dark">
                        Best for: {service.bestFor}
                      </p>
                    )}
                    <p className="mt-3 text-sm leading-relaxed text-text-muted">
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
                          {formatPrice(s.flatRate as number)} /{" "}
                          {service.durationMin ?? 15} mins (Add-on)
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
                          Additional fee: +{formatPrice(s.addOnMin as number)}–
                          {formatPrice(
                            typeof s.addOnMax === "number"
                              ? (s.addOnMax as number)
                              : (s.addOnMin as number),
                          )}{" "}
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
                        {service.options.map((opt) => (
                          <li
                            key={opt.name}
                            className="flex justify-between gap-4 border-b border-lavender/20 pb-2 last:border-0"
                          >
                            <span>{opt.name}</span>
                            <span className="shrink-0 font-medium text-gold-dark">
                              {"consultationRequired" in opt &&
                              opt.consultationRequired
                                ? "Consultation required"
                                : opt.priceFrom != null
                                  ? `${formatPrice(opt.priceFrom)}+`
                                  : "—"}
                            </span>
                          </li>
                        ))}
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
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <ServiceFeesSection />
      </div>

      <div className="mt-16 text-center">
        <Link
          href="/login?next=/book"
          className="inline-block rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition hover:bg-gold-dark"
        >
          Book Now · Valid Payment Method Required
        </Link>
      </div>
    </div>
  );
}
