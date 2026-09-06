import { business, formatPrice } from "@/lib/business";
import type { BookableService } from "@/lib/services";

type Props = {
  service: BookableService;
};

export function FullGroomPriceMatrix({ service }: Props) {
  const prices = service.coatTypePrices ?? [];
  if (!prices.length) return null;

  const coatTypes = business.coatTypes;
  const weightTiers = business.weightTiers;

  return (
    <div className="mt-6">
      {service.coatTypeNote && (
        <p className="font-body text-sm leading-relaxed text-taupe">
          {service.coatTypeNote}
        </p>
      )}

      <div className="mt-5 space-y-8">
        {weightTiers.map((weight) => (
          <div key={weight.id}>
            <p className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-taupe">
              {formatWeightLabel(weight.label)}
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3 md:gap-4">
              {coatTypes.map((coat) => {
                const price = prices.find(
                  (entry) =>
                    entry.weightTier === weight.id &&
                    entry.coatType === coat.id,
                );
                return (
                  <div
                    key={coat.id}
                    className="border border-gray-line/70 bg-ivory px-4 py-4 md:px-5 md:py-5"
                  >
                    <p className="font-body text-[10px] font-medium uppercase tracking-[0.14em] text-taupe">
                      {coat.label}
                    </p>
                    <p className="font-display mt-2 text-xl text-ink md:text-[1.35rem]">
                      {price
                        ? `From ${formatPrice(price.priceFrom)}`
                        : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {service.pricingNote && (
        <p className="font-body mt-6 text-[12px] leading-relaxed text-taupe/90">
          {service.pricingNote}
        </p>
      )}
    </div>
  );
}

function formatWeightLabel(label: string) {
  return label.replace(/\s+[–—-]\s+/g, "–");
}
