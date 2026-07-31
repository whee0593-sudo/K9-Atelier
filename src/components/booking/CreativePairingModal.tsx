"use client";

import { useState } from "react";
import { business, formatPrice } from "@/lib/business";
import {
  formatServicePriceFrom,
  type BookableService,
} from "@/lib/services";
import { CreativeOptionDetail } from "@/components/booking/CreativeOptionDetail";

type Props = {
  creativeService: BookableService;
  requiredBaseServices: BookableService[];
  onComplete: (baseServiceId: string, colorOption: string) => void;
  onBack: () => void;
};

type Step = "color" | "base";

function BaseServicePricing({ service }: { service: BookableService }) {
  const labels = Object.fromEntries(
    business.weightTiers.map((t) => [t.id, t.label]),
  );

  if (service.tiers?.length) {
    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-lavender/30">
        <table className="w-full text-left text-sm">
          <thead className="bg-lavender-light/60">
            <tr>
              <th className="px-3 py-2 font-medium">Weight</th>
              <th className="px-3 py-2 font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {service.tiers.map((tier) => (
              <tr key={tier.weightTier} className="border-t border-lavender/20">
                <td className="px-3 py-2">
                  {labels[tier.weightTier] ?? tier.weightTier}
                </td>
                <td className="px-3 py-2 font-medium text-gold-dark">
                  {formatPrice(tier.priceFrom)}+
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

export function CreativePairingModal({
  creativeService,
  requiredBaseServices,
  onComplete,
  onBack,
}: Props) {
  const [step, setStep] = useState<Step>("color");
  const [selectedBaseId, setSelectedBaseId] = useState<string | null>(null);
  const [selectedColorOption, setSelectedColorOption] = useState<string | null>(
    null,
  );

  function handleBack() {
    if (step === "base") {
      setStep("color");
      return;
    }
    onBack();
  }

  function handleNext() {
    if (step === "color") {
      if (!selectedColorOption) return;
      setStep("base");
      return;
    }

    if (!selectedBaseId || !selectedColorOption) return;
    onComplete(selectedBaseId, selectedColorOption);
  }

  const canContinue =
    step === "color"
      ? Boolean(selectedColorOption)
      : Boolean(selectedBaseId && selectedColorOption);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="creative-pairing-title"
    >
      <div className="flex max-h-[min(85vh,680px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-lavender/40 bg-cream shadow-lg">
        <div className="overflow-y-auto px-6 py-6">
          {step === "color" ? (
            <>
              <h2
                id="creative-pairing-title"
                className="text-center text-xl font-semibold text-gold-dark"
              >
                Choose accent style for Creative Accent Coloring
              </h2>
              <p className="mt-3 text-center text-sm leading-relaxed text-text-muted">
                Select the accent style you would like for your pet. You will
                choose a required bath or grooming service on the next step.
              </p>

              {creativeService.options && (
                <div className="mt-6 space-y-2">
                  {creativeService.options.map((opt) => {
                    const selected = selectedColorOption === opt.name;

                    return (
                      <button
                        key={opt.name}
                        type="button"
                        onClick={() => setSelectedColorOption(opt.name)}
                        className={`w-full rounded-xl px-4 py-4 text-sm transition ${
                          selected
                            ? "bg-gold text-white"
                            : "border border-gold/50 bg-cream text-text hover:bg-lavender-light"
                        }`}
                      >
                        <CreativeOptionDetail option={opt} selected={selected} />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <h2
                id="creative-pairing-title"
                className="text-center text-xl font-semibold text-gold-dark"
              >
                Pair with a base service
              </h2>
              <p className="mt-3 text-center text-sm leading-relaxed text-text-muted">
                Creative Accent Coloring cannot be booked on its own. Please
                select one of the following services to pair with your accent
                coloring.
              </p>

              {selectedColorOption && (
                <p className="mt-4 text-center text-sm text-text">
                  Selected accent:{" "}
                  <span className="font-medium text-gold-dark">
                    {selectedColorOption}
                  </span>
                </p>
              )}

              <div className="mt-6 space-y-4">
                {requiredBaseServices.map((service) => {
                  const selected = selectedBaseId === service.id;

                  return (
                    <div
                      key={service.id}
                      className={`rounded-2xl border px-5 py-5 transition ${
                        selected
                          ? "border-gold bg-lavender-light/60 ring-2 ring-gold/30"
                          : "border-lavender/40 bg-cream"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedBaseId(service.id)}
                        className="flex w-full flex-col items-start text-left"
                      >
                        <span className="text-base font-medium text-text">
                          {selected ? "✓ " : "+ "}
                          {service.name}
                          <span className="mt-1 block text-sm font-normal text-gold-dark">
                            {formatServicePriceFrom(service)}
                          </span>
                        </span>

                        <p className="mt-3 text-sm leading-relaxed text-text-muted">
                          {service.description}
                        </p>

                        <BaseServicePricing service={service} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-lavender/30 bg-cream px-6 py-4">
          <button
            type="button"
            onClick={handleBack}
            className="text-sm font-medium text-gold-dark underline"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canContinue}
            className="rounded-2xl bg-gold px-5 py-2.5 text-sm font-medium text-white hover:bg-gold-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
