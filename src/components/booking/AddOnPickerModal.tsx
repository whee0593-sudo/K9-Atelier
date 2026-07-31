"use client";

import { business, formatPrice } from "@/lib/business";
import {
  formatServicePriceFrom,
  type BookableService,
} from "@/lib/services";

type Props = {
  addOns: BookableService[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onSkip: () => void;
};

function AddOnPricingDetails({ addOn }: { addOn: BookableService }) {
  const labels = Object.fromEntries(
    business.weightTiers.map((t) => [t.id, t.label]),
  );

  if (addOn.tiers?.length) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-lavender/30">
        <table className="w-full text-left text-sm">
          <thead className="bg-lavender-light/60">
            <tr>
              <th className="px-3 py-2 font-medium">Weight</th>
              <th className="px-3 py-2 font-medium">Additional Fee</th>
            </tr>
          </thead>
          <tbody>
            {addOn.tiers.map((tier) => (
              <tr key={tier.weightTier} className="border-t border-lavender/20">
                <td className="px-3 py-2">
                  {labels[tier.weightTier] ?? tier.weightTier}
                </td>
                <td className="px-3 py-2 font-medium text-gold-dark">
                  +{formatPrice(tier.priceFrom)} (Add-on)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (addOn.flatRate != null) {
    return (
      <p className="mt-3 text-sm font-medium text-gold-dark">
        {formatPrice(addOn.flatRate)} / {addOn.durationMin ?? 15} mins (Add-on)
      </p>
    );
  }

  return null;
}

export function AddOnPickerModal({
  addOns,
  selectedIds,
  onToggle,
  onBack,
  onSkip,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-on-picker-title"
    >
      <div className="flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-lavender/40 bg-cream shadow-lg">
        <div className="overflow-y-auto px-6 py-6">
          <h2
            id="add-on-picker-title"
            className="text-center text-xl font-semibold text-gold-dark"
          >
            Available Add-ons
          </h2>
          <p className="mt-3 text-center text-sm leading-relaxed text-text-muted">
            We offer optional add-ons for this service. Tap any item below to
            include it with your booking.
          </p>

          <div className="mt-6 space-y-4">
            {addOns.map((addOn) => {
              const selected = selectedIds.includes(addOn.id);

              return (
                <button
                  key={addOn.id}
                  type="button"
                  onClick={() => onToggle(addOn.id)}
                  className={`flex w-full flex-col items-start rounded-2xl border px-5 py-5 text-left transition ${
                    selected
                      ? "border-gold bg-lavender-light/60 ring-2 ring-gold/30"
                      : "border-lavender/40 bg-cream hover:border-gold/40 hover:bg-lavender-light/30"
                  }`}
                >
                  <span className="text-base font-medium text-text">
                    {selected ? "✓ " : "+ "}
                    {addOn.name}
                    <span className="mt-1 block text-sm font-normal text-gold-dark">
                      {formatServicePriceFrom(addOn)}
                    </span>
                  </span>

                  <p className="mt-3 text-sm leading-relaxed text-text-muted">
                    {addOn.description}
                  </p>

                  {addOn.policyNote && (
                    <p className="mt-3 text-sm leading-relaxed text-text-muted">
                      <span className="font-medium text-text">Policy Note: </span>
                      {addOn.policyNote}
                    </p>
                  )}

                  {addOn.suitableFor && (
                    <p className="mt-3 text-sm leading-relaxed text-text-muted">
                      <span className="font-medium text-text">Suitable for: </span>
                      {addOn.suitableFor}
                    </p>
                  )}

                  <AddOnPricingDetails addOn={addOn} />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-lavender/30 bg-cream px-6 py-4">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-gold-dark underline"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="rounded-2xl bg-gold px-5 py-2.5 text-sm font-medium text-white hover:bg-gold-dark"
          >
            Skip add-ons
          </button>
        </div>
      </div>
    </div>
  );
}
