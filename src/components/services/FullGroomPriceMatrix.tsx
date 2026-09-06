import { business, formatDuration, formatPrice } from "@/lib/business";
import type { BookableService } from "@/lib/services";

type Props = {
  service: BookableService;
};

export function FullGroomPriceMatrix({ service }: Props) {
  const prices = service.coatTypePrices ?? [];
  if (!prices.length) return null;

  const coatTypes = business.coatTypes;
  const weightTiers = business.weightTiers;
  const durationByWeight = Object.fromEntries(
    (service.tiers ?? []).map((tier) => [
      tier.weightTier,
      tier.durationMin != null
        ? formatDuration(tier.durationMin, tier.durationMax)
        : null,
    ]),
  );

  return (
    <div className="mt-5">
      <div className="hidden overflow-hidden border border-gray-line/80 md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-dusty-lavender/35">
            <tr>
              <th className="px-4 py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-taupe">
                Weight
              </th>
              {coatTypes.map((coat) => (
                <th
                  key={coat.id}
                  className="px-4 py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-taupe"
                >
                  {coat.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weightTiers.map((weight) => (
              <tr key={weight.id} className="border-t border-gray-line/60">
                <td className="px-4 py-3 align-top text-ink">
                  <span className="block">
                    {formatWeightLabel(weight.label)}
                  </span>
                  {durationByWeight[weight.id] && (
                    <span className="font-body mt-1 block text-[12px] text-taupe">
                      {durationByWeight[weight.id]}
                    </span>
                  )}
                </td>
                {coatTypes.map((coat) => {
                  const price = prices.find(
                    (entry) =>
                      entry.weightTier === weight.id &&
                      entry.coatType === coat.id,
                  );
                  return (
                    <td key={coat.id} className="px-4 py-3 text-ink">
                      {price ? `From ${formatPrice(price.priceFrom)}` : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {weightTiers.map((weight) => (
          <div
            key={weight.id}
            className="border border-gray-line/80 bg-ivory px-4 py-4"
          >
            <p className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-taupe">
              {formatWeightLabel(weight.label)}
            </p>
            {durationByWeight[weight.id] && (
              <p className="font-body mt-1 text-sm text-taupe">
                {durationByWeight[weight.id]}
              </p>
            )}
            <dl className="mt-3 space-y-2">
              {coatTypes.map((coat) => {
                const price = prices.find(
                  (entry) =>
                    entry.weightTier === weight.id &&
                    entry.coatType === coat.id,
                );
                return (
                  <div
                    key={coat.id}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <dt className="font-body text-[11px] uppercase tracking-[0.1em] text-taupe">
                      {coat.label}
                    </dt>
                    <dd className="font-body text-sm text-ink">
                      {price ? `From ${formatPrice(price.priceFrom)}` : "—"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>

      {service.pricingNote && (
        <p className="font-body mt-4 text-[12px] leading-relaxed text-taupe/90">
          {service.pricingNote}
        </p>
      )}
    </div>
  );
}

function formatWeightLabel(label: string) {
  return label.replace(/\s+[–—-]\s+/g, "–");
}
