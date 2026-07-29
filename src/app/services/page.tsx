import Link from "next/link";
import { business, formatDuration, formatPrice } from "@/lib/business";

function TierTable({
  tiers,
}: {
  tiers: Array<{
    weightTier: string;
    priceFrom: number;
    durationMin: number;
    durationMax?: number;
  }>;
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
            <th className="px-4 py-2 font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr key={tier.weightTier} className="border-t border-lavender/20">
              <td className="px-4 py-2">{labels[tier.weightTier]}</td>
              <td className="px-4 py-2">{formatPrice(tier.priceFrom)}+</td>
              <td className="px-4 py-2">
                {formatDuration(tier.durationMin, tier.durationMax)}
              </td>
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
        Luxury mobile grooming tailored to your dog&apos;s coat, comfort, and
        needs. Prices vary by weight (up to 45 lbs for bath & styling services).
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

            <div className="mt-8 space-y-8">
              {category.services.map((service) => (
                <article
                  key={service.id}
                  className="rounded-2xl border border-lavender/30 bg-cream p-6"
                >
                  <h3 className="text-xl font-medium text-gold-dark">
                    {service.name}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-text-muted">
                    {service.description}
                  </p>

                  {"tiers" in service && service.tiers && (
                    <TierTable tiers={service.tiers} />
                  )}

                  {"hourlyRate" in service && service.hourlyRate && (
                    <p className="mt-4 text-sm font-medium text-gold-dark">
                      {formatPrice(service.hourlyRate)} / hour · est.{" "}
                      {formatDuration(service.durationMin, service.durationMax)}
                    </p>
                  )}

                  {(() => {
                    const s = service as Record<string, unknown>;
                    if (typeof s.addOnMin !== "number") return null;
                    const max =
                      typeof s.addOnMax === "number" ? s.addOnMax : s.addOnMin;
                    return (
                      <p className="mt-4 text-sm font-medium text-gold-dark">
                        Add-on: +{formatPrice(s.addOnMin)}–{formatPrice(max)} on
                        base service
                      </p>
                    );
                  })()}

                  {"options" in service && service.options && (
                    <ul className="mt-4 space-y-2 text-sm">
                      {service.options.map((opt) => (
                        <li key={opt.name} className="flex justify-between gap-4">
                          <span>{opt.name}</span>
                          <span className="font-medium text-gold-dark">
                            {formatPrice(opt.priceFrom)}+
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
                </article>
              ))}
            </div>
          </section>
        ))}

        <section>
          <h2 className="text-2xl font-semibold text-text">
            Service Fees & Surcharges
          </h2>
          <div className="mt-8 space-y-6">
            {business.fees.map((fee) => (
              <article
                key={fee.id}
                className="rounded-2xl border border-lavender/30 bg-cream p-6"
              >
                <h3 className="text-lg font-medium text-gold-dark">{fee.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-text-muted">
                  {fee.description}
                </p>
                {"rate" in fee && fee.rate && (
                  <p className="mt-3 text-sm font-medium">
                    ${fee.rate}/mile beyond {business.serviceArea.freeRadiusMiles}{" "}
                    miles
                  </p>
                )}
                {(() => {
                  const f = fee as Record<string, unknown>;
                  if (typeof f.rateMin !== "number") return null;
                  const max =
                    typeof f.rateMax === "number" ? f.rateMax : f.rateMin;
                  return (
                    <p className="mt-3 text-sm font-medium">
                      {formatPrice(f.rateMin)}–{formatPrice(max)}+
                    </p>
                  );
                })()}
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-16 text-center">
        <Link
          href="/book"
          className="inline-block rounded-full bg-gold px-8 py-3 text-sm font-medium text-white transition hover:bg-gold-dark"
        >
          Book Now · Valid Payment Method Required
        </Link>
      </div>
    </div>
  );
}
