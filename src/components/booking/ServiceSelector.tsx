"use client";

import { useMemo, useState } from "react";
import type { PetProfile } from "@/lib/pets";
import { business, formatPrice } from "@/lib/business";
import {
  allBookableServices,
  formatServicePrice,
  groupServicesByCategory,
  isServiceAvailableForPet,
  seniorAddOnRange,
  supportsSeniorAddOn,
  unavailableReason,
  type BookableService,
  type SelectedService,
} from "@/lib/services";

type Props = {
  pet: PetProfile;
  selected: SelectedService | null;
  onSelect: (selection: SelectedService | null) => void;
};

export function ServiceSelector({ pet, selected, onSelect }: Props) {
  const [colorOption, setColorOption] = useState<string | null>(null);
  const [seniorAddOn, setSeniorAddOn] = useState(false);

  const primaryServices = useMemo(
    () => allBookableServices().filter((s) => s.bookableAsPrimary),
    [],
  );
  const categories = useMemo(
    () => groupServicesByCategory(primaryServices),
    [primaryServices],
  );

  function buildSelection(
    service: BookableService,
    optionName?: string,
    addOnIds: string[] = [],
  ): SelectedService {
    return {
      serviceId: service.id,
      serviceName: service.name,
      optionName,
      addOnIds,
      priceLabel: formatServicePrice(service, pet.weightLbs, optionName),
      durationLabel:
        service.pricingType === "tiered"
          ? formatServicePrice(service, pet.weightLbs, optionName).split(" · ")[1]
          : undefined,
    };
  }

  function handleSelectService(service: BookableService) {
    if (!isServiceAvailableForPet(service.id, pet.weightLbs)) return;

    if (service.id === "creative-accent-coloring") {
      const defaultOption = service.options?.[0]?.name;
      setColorOption(defaultOption ?? null);
      onSelect(buildSelection(service, defaultOption ?? undefined, seniorAddOn ? ["senior-comfort-care"] : []));
      return;
    }

    setColorOption(null);
    const addOnIds = supportsSeniorAddOn(service.id) && seniorAddOn
      ? ["senior-comfort-care"]
      : [];
    onSelect(buildSelection(service, undefined, addOnIds));
  }

  function handleColorOptionChange(service: BookableService, optionName: string) {
    setColorOption(optionName);
    onSelect(buildSelection(service, optionName, []));
  }

  function handleSeniorToggle(checked: boolean) {
    setSeniorAddOn(checked);
    if (!selected || !supportsSeniorAddOn(selected.serviceId)) return;
    onSelect({
      ...selected,
      addOnIds: checked ? ["senior-comfort-care"] : [],
    });
  }

  const over45 = pet.weightLbs > business.weightPolicy.maxStandardWeightLbs;
  const seniorRange = seniorAddOnRange();

  return (
    <div className="space-y-8">
      {over45 && (
        <div className="rounded-xl border border-blue/40 bg-blue/10 px-4 py-3 text-sm text-text">
          {business.weightPolicy.over45Note}
        </div>
      )}

      {categories.map((category) => (
        <section key={category.id}>
          <h3 className="text-lg font-medium text-text">{category.name}</h3>
          {category.note && (
            <p className="mt-1 text-sm italic text-text-muted">{category.note}</p>
          )}

          <ul className="mt-4 space-y-3">
            {category.services.map((service) => {
              const available = isServiceAvailableForPet(
                service.id,
                pet.weightLbs,
              );
              const reason = unavailableReason(service.id, pet.weightLbs);
              const isSelected = selected?.serviceId === service.id;
              const priceLabel = formatServicePrice(service, pet.weightLbs);

              return (
                <li key={service.id}>
                  <button
                    type="button"
                    disabled={!available}
                    onClick={() => handleSelectService(service)}
                    className={`w-full rounded-2xl border px-5 py-4 text-left transition ${
                      isSelected
                        ? "border-gold bg-lavender-light/50 ring-2 ring-gold/30"
                        : available
                          ? "border-lavender/40 bg-cream hover:border-gold/40"
                          : "cursor-not-allowed border-lavender/30 bg-cream/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-medium text-text">{service.name}</p>
                      <p className="shrink-0 text-sm font-medium text-gold-dark">
                        {available ? priceLabel.split(" · ")[0] : "Unavailable"}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-text-muted line-clamp-2">
                      {service.description}
                    </p>
                    {available && priceLabel.includes(" · ") && (
                      <p className="mt-2 text-xs text-text-muted">
                        {priceLabel.split(" · ").slice(1).join(" · ")}
                      </p>
                    )}
                    {reason && (
                      <p className="mt-2 text-xs text-text-muted">{reason}</p>
                    )}
                  </button>

                  {isSelected &&
                    service.id === "creative-accent-coloring" &&
                    service.options && (
                      <div className="mt-3 rounded-xl border border-lavender/30 bg-lavender-light/20 p-4">
                        <p className="text-sm font-medium text-text">
                          Choose accent style
                        </p>
                        <ul className="mt-3 space-y-2">
                          {service.options.map((opt) => (
                            <li key={opt.name}>
                              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-cream/80">
                                <span className="flex items-center gap-2 text-sm">
                                  <input
                                    type="radio"
                                    name="color-option"
                                    checked={colorOption === opt.name}
                                    onChange={() =>
                                      handleColorOptionChange(service, opt.name)
                                    }
                                  />
                                  {opt.name}
                                </span>
                                <span className="text-sm font-medium text-gold-dark">
                                  {opt.consultationRequired
                                    ? "Consultation required"
                                    : opt.priceFrom != null
                                      ? `${formatPrice(opt.priceFrom)}+`
                                      : "—"}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {selected && supportsSeniorAddOn(selected.serviceId) && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-lavender/40 bg-cream px-5 py-4">
          <input
            type="checkbox"
            checked={seniorAddOn}
            onChange={(e) => handleSeniorToggle(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium text-text">
              Add Senior &amp; Gentle Comfort Care
            </span>
            <span className="mt-1 block text-sm text-text-muted">
              For senior dogs who cannot tolerate a standard groom due to
              paralysis, post-surgery recovery, or serious illness (+
              {formatPrice(seniorRange.min)}–{formatPrice(seniorRange.max)}).
            </span>
          </span>
        </label>
      )}

      {selected && (
        <div className="rounded-xl bg-lavender-light/40 px-4 py-3 text-sm text-text">
          <strong>Selected service:</strong> {selected.serviceName}
          {selected.optionName ? ` · ${selected.optionName}` : ""}
          {selected.addOnIds.includes("senior-comfort-care")
            ? " · Senior Comfort Add-on"
            : ""}
          <span className="mt-1 block text-text-muted">
            Estimated: {selected.priceLabel}
            {selected.addOnIds.includes("senior-comfort-care")
              ? " + senior add-on"
              : ""}
          </span>
        </div>
      )}
    </div>
  );
}
