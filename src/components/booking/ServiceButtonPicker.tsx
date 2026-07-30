"use client";

import {
  formatServicePriceFrom,
  getBookableCategories,
  type BookableService,
} from "@/lib/services";

const buttonBase =
  "flex w-full flex-col items-center justify-center rounded-2xl px-6 py-5 text-center transition shadow-sm";

type Props = {
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
};

export function ServiceCategoryPicker({ selectedCategoryId, onSelect }: Props) {
  const categories = getBookableCategories();

  return (
    <div className="space-y-4">
      {categories.map((category, index) => {
        const selected = selectedCategoryId === category.id;
        const isPrimary = index === 0;

        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect(category.id)}
            className={`${buttonBase} min-h-[5rem] ${
              selected
                ? "bg-gold text-white ring-2 ring-gold/40"
                : isPrimary
                  ? "bg-gold text-white hover:bg-gold-dark"
                  : "border-2 border-gold bg-cream text-gold-dark hover:bg-lavender-light"
            }`}
          >
            <span className="text-lg font-medium">{category.name}</span>
            <span
              className={`mt-1 text-sm ${
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

type ServicePickerProps = {
  categoryId: string;
  selectedServiceId: string | null;
  onSelect: (service: BookableService) => void;
  onBack: () => void;
};

export function ServiceButtonPicker({
  categoryId,
  selectedServiceId,
  onSelect,
  onBack,
}: ServicePickerProps) {
  const category = getBookableCategories().find((c) => c.id === categoryId);

  if (!category) return null;

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-6 text-sm text-gold-dark underline"
      >
        ← Back to categories
      </button>

      <h3 className="text-center text-xl font-medium text-gold-dark">
        {category.name}
      </h3>
      {category.note && (
        <p className="mt-2 text-center text-sm italic text-text-muted">
          {category.note}
        </p>
      )}

      <div className="mt-8 space-y-4">
        {category.services.map((service, index) => {
          const selected = selectedServiceId === service.id;
          const isPrimary = index === 0;

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service)}
              className={`${buttonBase} min-h-[4.5rem] text-left md:text-center ${
                selected
                  ? "border-2 border-gold bg-lavender-light/60 ring-2 ring-gold/30"
                  : isPrimary
                    ? "bg-gold text-white hover:bg-gold-dark"
                    : "border-2 border-gold bg-cream text-gold-dark hover:bg-lavender-light"
              }`}
            >
              <span className="text-base font-medium">{service.name}</span>
              <span
                className={`mt-1 block text-sm ${
                  selected
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
    </div>
  );
}
