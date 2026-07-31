"use client";

import { business, formatPrice } from "@/lib/business";
import {
  CREATIVE_ACCENT_COLORING_ID,
  formatServicePriceFrom,
  type BookableService,
} from "@/lib/services";
import { CreativeOptionDetail } from "@/components/booking/CreativeOptionDetail";

type Props = {
  addOns: BookableService[];
  selectedIds: string[];
  addOnOptions: Record<string, string>;
  onToggle: (id: string) => void;
  onOptionChange: (addOnId: string, optionName: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onNext: () => void;
};

function AddOnPricingDetails({ addOn }: { addOn: BookableService }) {
  const labels = Object.fromEntries(
    business.weightTiers.map((t) => [t.id, t.label]),
  );

  if (addOn.options?.length) {
    if (addOn.id === CREATIVE_ACCENT_COLORING_ID) {
      return (
        <ul className="mt-3 space-y-4 text-sm">
          {addOn.options.map((opt) => (
            <li
              key={opt.name}
              className="border-b border-lavender/20 pb-4 last:border-0"
            >
              <CreativeOptionDetail option={opt} />
            </li>
          ))}
        </ul>
      );
    }

    return (
      <ul className="mt-3 space-y-2 text-sm">
        {addOn.options.map((opt) => (
          <li
            key={opt.name}
            className="flex justify-between gap-4 border-b border-lavender/20 pb-2 last:border-0"
          >
            <span>
              {opt.name}
              {opt.description && (
                <span className="mt-1 block text-xs leading-relaxed text-text-muted">
                  {opt.description}
                </span>
              )}
              {opt.note && (
                <span className="mt-1 block text-xs text-gold-dark">
                  {opt.note}
                </span>
              )}
            </span>
            <span className="shrink-0 font-medium text-gold-dark">
              {opt.consultationRequired
                ? "Consultation required"
                : opt.priceFrom != null
                  ? `${formatPrice(opt.priceFrom)}+`
                  : "—"}
            </span>
          </li>
        ))}
      </ul>
    );
  }

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
  addOnOptions,
  onToggle,
  onOptionChange,
  onBack,
  onSkip,
  onNext,
}: Props) {
  const hasIncompleteSelection = selectedIds.some((id) => {
    const addOn = addOns.find((a) => a.id === id);
    return addOn?.options?.length && !addOnOptions[id];
  });
  const canNext = selectedIds.length > 0 && !hasIncompleteSelection;

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
                <div
                  key={addOn.id}
                  className={`rounded-2xl border px-5 py-5 transition ${
                    selected
                      ? "border-gold bg-lavender-light/60 ring-2 ring-gold/30"
                      : "border-lavender/40 bg-cream"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onToggle(addOn.id)}
                    className="flex w-full flex-col items-start text-left"
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

                    {addOn.note && (
                      <p className="mt-3 text-sm leading-relaxed text-text-muted">
                        {addOn.note}
                      </p>
                    )}

                    {addOn.policyNote && (
                      <p className="mt-3 text-sm leading-relaxed text-text-muted">
                        <span className="font-medium text-text">
                          Policy Note:{" "}
                        </span>
                        {addOn.policyNote}
                      </p>
                    )}

                    {addOn.suitableFor && (
                      <p className="mt-3 text-sm leading-relaxed text-text-muted">
                        <span className="font-medium text-text">
                          Suitable for:{" "}
                        </span>
                        {addOn.suitableFor}
                      </p>
                    )}

                    <AddOnPricingDetails addOn={addOn} />
                  </button>

                  {selected && addOn.options && addOn.options.length > 0 && (
                    <div className="mt-4 border-t border-lavender/30 pt-4">
                      <p className="text-sm font-medium text-text">
                        Choose accent style
                      </p>
                      <div className="mt-3 space-y-2">
                        {addOn.options.map((opt) => {
                          const optionSelected =
                            addOnOptions[addOn.id] === opt.name;
                          const isCreative =
                            addOn.id === CREATIVE_ACCENT_COLORING_ID;

                          return (
                          <button
                            key={opt.name}
                            type="button"
                            onClick={() => onOptionChange(addOn.id, opt.name)}
                            className={`w-full rounded-xl px-4 py-3 text-sm transition ${
                              optionSelected
                                ? "bg-gold text-white"
                                : "border border-gold/50 bg-cream text-text hover:bg-lavender-light"
                            } ${isCreative ? "py-4" : "flex items-center justify-between gap-4"}`}
                          >
                            {isCreative ? (
                              <CreativeOptionDetail
                                option={opt}
                                selected={optionSelected}
                              />
                            ) : (
                              <>
                            <span className="text-left">
                              {opt.name}
                              {opt.description && (
                                <span
                                  className={`mt-1 block text-xs leading-relaxed ${
                                    addOnOptions[addOn.id] === opt.name
                                      ? "text-white/90"
                                      : "text-text-muted"
                                  }`}
                                >
                                  {opt.description}
                                </span>
                              )}
                              {opt.note && (
                                <span
                                  className={`mt-1 block text-xs font-medium ${
                                    optionSelected
                                      ? "text-white/90"
                                      : "text-gold-dark"
                                  }`}
                                >
                                  {opt.note}
                                </span>
                              )}
                            </span>
                            <span className="font-medium">
                              {opt.consultationRequired
                                ? "Consultation required"
                                : opt.priceFrom != null
                                  ? `${formatPrice(opt.priceFrom)}+`
                                  : "—"}
                            </span>
                              </>
                            )}
                          </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 items-center gap-4 border-t border-lavender/30 bg-cream px-6 py-4">
          <button
            type="button"
            onClick={onBack}
            className="justify-self-start text-sm font-medium text-gold-dark underline"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="justify-self-center rounded-2xl border border-gold/50 px-5 py-2.5 text-sm font-medium text-gold-dark hover:bg-lavender-light"
          >
            Skip add-ons
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className="justify-self-end rounded-2xl bg-gold px-5 py-2.5 text-sm font-medium text-white hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
