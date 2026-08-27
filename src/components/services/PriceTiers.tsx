import { business, formatDuration, formatPrice } from "@/lib/business";
import type { ServiceTier } from "@/lib/services";

type Props = {
  tiers: ServiceTier[];
  priceOnly?: boolean;
  feeSuffix?: string;
};

export function PriceTiers({
  tiers,
  priceOnly = false,
  feeSuffix,
}: Props) {
  const labels = Object.fromEntries(
    business.weightTiers.map((tier) => [tier.id, tier.label]),
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
              <th className="px-4 py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-taupe">
                Starting Price
              </th>
              {!priceOnly && (
                <th className="px-4 py-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] text-taupe">
                  Estimated Time
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <tr key={tier.weightTier} className="border-t border-gray-line/60">
                <td className="px-4 py-3 text-ink">
                  {formatWeightLabel(labels[tier.weightTier] ?? tier.weightTier)}
                </td>
                <td className="px-4 py-3 text-ink">
                  From {formatPrice(tier.priceFrom)}
                  {feeSuffix ? ` ${feeSuffix}` : ""}
                </td>
                {!priceOnly && (
                  <td className="px-4 py-3 text-ink">
                    {tier.durationMin != null
                      ? formatDuration(tier.durationMin, tier.durationMax)
                      : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {tiers.map((tier) => (
          <div
            key={tier.weightTier}
            className="border border-gray-line/80 bg-ivory px-4 py-4"
          >
            <p className="font-body text-[11px] font-medium uppercase tracking-[0.12em] text-taupe">
              {formatWeightLabel(labels[tier.weightTier] ?? tier.weightTier)}
            </p>
            <p className="font-display mt-2 text-xl text-ink">
              From {formatPrice(tier.priceFrom)}
              {feeSuffix ? ` ${feeSuffix}` : ""}
            </p>
            {!priceOnly && tier.durationMin != null && (
              <p className="font-body mt-1 text-sm text-taupe">
                {formatDuration(tier.durationMin, tier.durationMax)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatWeightLabel(label: string) {
  return label.replace(/\s+[–—-]\s+/g, "–");
}
