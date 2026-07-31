import { business, formatPrice } from "@/lib/business";

const tableClass =
  "mt-4 w-full overflow-hidden rounded-xl border border-lavender/30 text-left text-sm";
const theadClass = "bg-lavender-light/60";
const thClass = "px-4 py-2 font-medium";
const tdClass = "border-t border-lavender/20 px-4 py-2";

type WeightTierFee = {
  weightTier: string;
  priceFrom: number;
};

type SeniorCare = {
  name: string;
  description: string;
  suitableFor: string;
  tiers: WeightTierFee[];
};

const weightLabels = Object.fromEntries(
  business.weightTiers.map((t) => [t.id, t.label]),
);

function tierPriceRange(tiers: WeightTierFee[]) {
  const prices = tiers.map((t) => t.priceFrom);
  return `${formatPrice(Math.min(...prices))} – ${formatPrice(Math.max(...prices))}`;
}

function WeightTierTable({
  tiers,
  feeSuffix,
}: {
  tiers: WeightTierFee[];
  feeSuffix: string;
}) {
  return (
    <div className={tableClass}>
      <table className="w-full">
        <thead className={theadClass}>
          <tr>
            <th className={thClass}>Weight</th>
            <th className={thClass}>Additional Fee</th>
          </tr>
        </thead>
        <tbody>
          {tiers.map((tier) => (
            <tr key={tier.weightTier}>
              <td className={tdClass}>
                {weightLabels[tier.weightTier] ?? tier.weightTier}
              </td>
              <td className={`${tdClass} font-medium text-gold-dark`}>
                +{formatPrice(tier.priceFrom)} {feeSuffix}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ServiceFeesSection({ className = "" }: { className?: string }) {
  return (
    <section className={className}>
      <h2 className="text-2xl font-semibold text-text">
        Service Fees &amp; Surcharges
      </h2>

      <div className="mt-8 space-y-6">
        {business.fees.map((fee, index) => {
          const f = fee as Record<string, unknown>;
          const seniorCare = f.seniorCare as SeniorCare | undefined;
          const tiers = f.tiers as WeightTierFee[] | undefined;
          const isTieredAddOn = fee.type === "add_on" && tiers?.length;
          const isFlatAddOn =
            fee.type === "add_on" &&
            typeof f.rate === "number" &&
            typeof f.durationMin === "number" &&
            !tiers?.length;
          let titleSuffix = "";
          if (isTieredAddOn && tiers) {
            titleSuffix = ` | ${tierPriceRange(tiers)} (Add-on)`;
          } else if (isFlatAddOn) {
            titleSuffix = ` | ${formatPrice(f.rate as number)} / ${f.durationMin} mins (Add-on)`;
          }

          return (
            <article
              key={fee.id}
              className="rounded-2xl border border-lavender/30 bg-cream p-6"
            >
              <h3 className="text-lg font-medium text-gold-dark">
                {index + 1}. {fee.name}
                {titleSuffix}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                <span className="font-medium text-text">Description: </span>
                {fee.description}
              </p>

              {isTieredAddOn && tiers && (
                <WeightTierTable tiers={tiers} feeSuffix="(Add-on)" />
              )}

              {isFlatAddOn && (
                <div className={tableClass}>
                  <table className="w-full">
                    <thead className={theadClass}>
                      <tr>
                        <th className={thClass}>Rate</th>
                        <th className={thClass}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={`${tdClass} font-medium text-gold-dark`}>
                          {formatPrice(f.rate as number)}
                        </td>
                        <td className={tdClass}>
                          {f.durationMin} mins (Add-on)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {typeof f.policyNote === "string" && (
                <p className="mt-4 text-sm leading-relaxed text-text-muted">
                  <span className="font-medium text-text">Policy Note: </span>
                  {f.policyNote}
                </p>
              )}

              {fee.type === "travel" &&
                "rate" in fee &&
                typeof fee.rate === "number" && (
                <div className={tableClass}>
                  <table className="w-full">
                    <thead className={theadClass}>
                      <tr>
                        <th className={thClass}>Rate Structure</th>
                        <th className={thClass}>Calculation Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={tdClass}>
                          {formatPrice(fee.rate)} / one-way mile
                        </td>
                        <td className={tdClass}>
                          Measured from base location to client address
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {typeof f.rateMin === "number" && (
                <div className={tableClass}>
                  <table className="w-full">
                    <thead className={theadClass}>
                      <tr>
                        <th className={thClass}>Fee Range</th>
                        <th className={thClass}>Condition</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={tdClass}>
                          +{formatPrice(f.rateMin as number)} –{" "}
                          {formatPrice(
                            typeof f.rateMax === "number"
                              ? (f.rateMax as number)
                              : (f.rateMin as number),
                          )}
                          +
                        </td>
                        <td className={tdClass}>
                          Based on level of anxiety, resistance, or aggression
                          shown on-site
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {seniorCare && (
                <div className="mt-8 border-t border-lavender/20 pt-6">
                  <h4 className="text-base font-medium text-gold-dark">
                    {seniorCare.name}
                  </h4>
                  <p className="mt-3 text-sm leading-relaxed text-text-muted">
                    <span className="font-medium text-text">Description: </span>
                    {seniorCare.description}
                  </p>
                  <WeightTierTable
                    tiers={seniorCare.tiers}
                    feeSuffix="(Added to base bath or grooming price)"
                  />
                  <p className="mt-3 text-sm text-text-muted">
                    <span className="font-medium text-text">Suitable for: </span>
                    {seniorCare.suitableFor}
                  </p>
                </div>
              )}

              {Array.isArray(f.lineItems) && (
                <div className={tableClass}>
                  <table className="w-full">
                    <thead className={theadClass}>
                      <tr>
                        <th className={thClass}>Fee Item</th>
                        <th className={thClass}>Cost</th>
                        <th className={thClass}>Policy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        f.lineItems as Array<{
                          name: string;
                          rate: number;
                          note?: string;
                        }>
                      ).map((item) => (
                        <tr key={item.name}>
                          <td className={tdClass}>{item.name}</td>
                          <td className={`${tdClass} font-medium text-gold-dark`}>
                            {formatPrice(item.rate)}
                          </td>
                          <td className={tdClass}>{item.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
