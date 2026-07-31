"use client";

import { business, formatDuration, formatPrice } from "@/lib/business";
import {
  formatServicePriceFrom,
  getBookableCategories,
  type BookableService,
} from "@/lib/services";

const buttonBase =
  "flex w-full flex-col items-center justify-center rounded-2xl px-4 py-5 text-center transition shadow-sm";

type CategoryPickerProps = {
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
};

export function ServiceCategoryPicker({
  selectedCategoryId,
  onSelect,
}: CategoryPickerProps) {
  const categories = getBookableCategories();

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
      {categories.map((category, index) => {
        const selected = selectedCategoryId === category.id;
        const isPrimary = index === 0;

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className={`${buttonBase} min-h-[6.5rem] sm:min-h-[8rem] ${
              selected
                ? "bg-gold text-white ring-2 ring-gold/40"
                : isPrimary
                  ? "bg-gold text-white hover:bg-gold-dark"
                  : "border-2 border-gold bg-cream text-gold-dark hover:bg-lavender-light"
            }`}
          >
            <span className="text-base font-medium leading-snug sm:text-lg">
              {category.name}
            </span>
            <span
              className={`mt-2 text-sm ${
                selected || isPrimary ? "opacity-90" : "text-text-muted"
              }`}
            >
              {category.services.length} service
              {category.services.length === 1 ? "" : "s"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PricingBlock({ service }: { service: BookableService }) {
  const labels = Object.fromEntries(
    business.weightTiers.map((t) => [t.id, t.label]),
  );

  if (service.tiers?.length) {
    return (
      <div className="mt-6 overflow-hidden rounded-xl border border-lavender/30">
        <table className="w-full text-left text-sm">
          <thead className="bg-lavender-light/60">
            <tr>
              <th className="px-4 py-2.5 font-medium">Weight</th>
              <th className="px-4 py-2.5 font-medium">Duration</th>
              <th className="px-4 py-2.5 font-medium">Price</th>
            </tr>
          </thead>
          <tbody>
            {service.tiers.map((tier) => (
              <tr key={tier.weightTier} className="border-t border-lavender/20">
                <td className="px-4 py-2.5">{labels[tier.weightTier]}</td>
                <td className="px-4 py-2.5">
                  {formatDuration(tier.durationMin, tier.durationMax)}
                </td>
                <td className="px-4 py-2.5 font-medium text-gold-dark">
                  {formatPrice(tier.priceFrom)}+
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (service.pricingType === "hourly" && service.hourlyRate) {
    return (
      <div className="mt-6 text-center text-sm">
        <p className="font-medium text-text">
          {formatPrice(service.hourlyRate)} / hour
        </p>
        <p className="mt-1 text-text-muted">
          {service.durationNote ??
            formatDuration(service.durationMin ?? 90, service.durationMax)}
        </p>
      </div>
    );
  }

  if (service.pricingType === "add_on") {
    if (service.tiers?.length) {
      const labels = Object.fromEntries(
        business.weightTiers.map((t) => [t.id, t.label]),
      );
      return (
        <div className="mt-6 overflow-hidden rounded-xl border border-lavender/30">
          <table className="w-full text-left text-sm">
            <thead className="bg-lavender-light/60">
              <tr>
                <th className="px-4 py-2.5 font-medium">Weight</th>
                <th className="px-4 py-2.5 font-medium">Additional Fee</th>
              </tr>
            </thead>
            <tbody>
              {service.tiers.map((tier) => (
                <tr key={tier.weightTier} className="border-t border-lavender/20">
                  <td className="px-4 py-2.5">
                    {labels[tier.weightTier] ?? tier.weightTier}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gold-dark">
                    +{formatPrice(tier.priceFrom)} on base service
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (service.flatRate != null) {
      return (
        <p className="mt-6 text-center text-sm font-medium text-gold-dark">
          {formatPrice(service.flatRate)} / {service.durationMin ?? 15} mins
          (Add-on)
        </p>
      );
    }
    return (
      <p className="mt-6 text-center text-sm font-medium text-text">
        Additional fee: +{formatPrice(service.addOnMin ?? 0)}–
        {formatPrice(service.addOnMax ?? service.addOnMin ?? 0)} on base service
      </p>
    );
  }

  if (service.pricingType === "options" && service.options) {
    return (
      <ul className="mt-6 space-y-2 text-sm">
        {service.options.map((opt) => (
          <li
            key={opt.name}
            className="flex justify-between gap-4 border-b border-lavender/20 pb-2 last:border-0"
          >
            <span>{opt.name}</span>
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

  if (service.pricingType === "free") {
    return (
      <p className="mt-6 text-center text-sm font-medium text-gold-dark">
        Complimentary · By appointment only
      </p>
    );
  }

  if (service.pricingType === "consultation") {
    return (
      <p className="mt-6 text-center text-sm text-text-muted">
        Please contact us to discuss your dog&apos;s needs and pricing.
      </p>
    );
  }

  return null;
}

type ServicePanelProps = {
  categoryId: string;
  selectedServiceId: string | null;
  colorOption: string | null;
  onSelect: (service: BookableService) => void;
  onColorOptionChange: (optionName: string) => void;
  onBack: () => void;
  onBook: () => void;
};

export function ServiceButtonPicker({
  categoryId,
  selectedServiceId,
  colorOption,
  onSelect,
  onColorOptionChange,
  onBack,
  onBook,
}: ServicePanelProps) {
  const category = getBookableCategories().find((c) => c.id === categoryId);
  if (!category) return null;

  const selected =
    category.services.find((s) => s.id === selectedServiceId) ??
    category.services[0] ??
    null;

  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-8 text-sm text-gold-dark underline"
      >
        ← Back to categories
      </button>

      <h2 className="text-center text-2xl font-bold uppercase tracking-wide text-text">
        {category.name}
      </h2>

      {category.note && (
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm italic text-text-muted">
          {category.note}
        </p>
      )}

      <div
        className={`mt-8 grid gap-4 ${
          category.services.length === 1
            ? "mx-auto max-w-md grid-cols-1"
            : category.services.length === 2
              ? "grid-cols-1 sm:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {category.services.map((service, index) => {
          const isSelected = selected?.id === service.id;
          const isPrimary = index === 0;

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service)}
              className={`${buttonBase} min-h-[4.5rem] ${
                isSelected
                  ? "border-2 border-gold bg-lavender-light/60 ring-2 ring-gold/30"
                  : isPrimary
                    ? "bg-gold text-white hover:bg-gold-dark"
                    : "border-2 border-gold bg-cream text-gold-dark hover:bg-lavender-light"
              }`}
            >
              <span className="text-sm font-medium leading-snug sm:text-base">
                {service.name}
              </span>
              <span
                className={`mt-1 text-xs sm:text-sm ${
                  isSelected
                    ? "text-text-muted"
                    : isPrimary
                      ? "opacity-90"
                      : "text-text-muted"
                }`}
              >
                {formatServicePriceFrom(service)}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-10 text-center">
          <h3 className="text-xl font-semibold text-text">{selected.name}</h3>

          {selected.bestFor && (
            <p className="mt-2 text-sm font-medium text-gold-dark">
              Best for: {selected.bestFor}
            </p>
          )}

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-text-muted">
            {selected.description}
          </p>

          {selected.includes && selected.includes.length > 0 && (
            <div className="mx-auto mt-6 max-w-xl text-left">
              <p className="text-center text-sm font-medium text-text">
                Includes:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-text-muted">
                {selected.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {selected.note && (
            <p className="mx-auto mt-4 max-w-xl text-sm text-text-muted">
              {selected.note}
            </p>
          )}

          {selected.suitableFor && (
            <p className="mt-3 text-sm text-text-muted">
              Suitable for: {selected.suitableFor}
            </p>
          )}

          <PricingBlock service={selected} />

          {selected.id === "creative-accent-coloring" && selected.options && (
            <div className="mx-auto mt-6 max-w-md text-left">
              <p className="mb-3 text-center text-sm font-medium text-text">
                Choose accent style
              </p>
              <div className="space-y-2">
                {selected.options.map((opt) => (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => onColorOptionChange(opt.name)}
                    className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm transition ${
                      colorOption === opt.name
                        ? "bg-gold text-white"
                        : "border border-gold/50 bg-cream text-text hover:bg-lavender-light"
                    }`}
                  >
                    <span>{opt.name}</span>
                    <span className="font-medium">
                      {opt.consultationRequired
                        ? "Consultation required"
                        : opt.priceFrom != null
                          ? `${formatPrice(opt.priceFrom)}+`
                          : "—"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onBook}
            className="mt-10 inline-flex min-h-[3.25rem] items-center justify-center rounded-2xl bg-gold px-10 py-3 text-base font-medium text-white transition hover:bg-gold-dark"
          >
            Book This Service
          </button>
        </div>
      )}
    </div>
  );
}
