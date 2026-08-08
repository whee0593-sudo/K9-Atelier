"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/business";
import {
  CREATIVE_ACCENT_COLORING_ID,
  formatServicePriceFrom,
  getAddOnService,
  getAvailableAddOns,
  getServicePriceEstimate,
  type BookableService,
} from "@/lib/services";
import {
  getServiceDisplayDescription,
  getServiceDisplayName,
} from "@/lib/service-display";
import { petMayBenefitFromGentleCare, type PetProfile } from "@/lib/pets";
import {
  bookingBackLinkClass,
  bookingCardClass,
  bookingCardSelectedClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
  bookingSecondaryBtnClass,
} from "@/components/booking/booking-ui";

type Props = {
  pet: PetProfile;
  primaryService: BookableService;
  selectedIds: string[];
  addOnOptions: Record<string, string>;
  onToggle: (id: string) => void;
  onOptionChange: (addOnId: string, optionName: string) => void;
  onContinue: () => void;
  onBack: () => void;
};

function CareOptionCard({
  title,
  description,
  priceLabel,
  selected,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  priceLabel: string;
  selected: boolean;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <article
      className={`${bookingCardClass} ${selected ? bookingCardSelectedClass : ""}`}
    >
      <h3 className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
        {title}
      </h3>
      <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
        {description}
      </p>
      <p className="font-body mt-4 text-[10px] font-medium uppercase tracking-[0.14em] text-taupe">
        {priceLabel}
      </p>
      <button
        type="button"
        onClick={onAction}
        className={`${selected ? bookingSecondaryBtnClass : bookingPrimaryBtnClass} mt-5`}
      >
        {actionLabel}
      </button>
    </article>
  );
}

export function BookingCareOptionsStep({
  pet,
  primaryService,
  selectedIds,
  addOnOptions,
  onToggle,
  onOptionChange,
  onContinue,
  onBack,
}: Props) {
  const [showCreativeOptions, setShowCreativeOptions] = useState(false);
  const addOns = getAvailableAddOns(primaryService.categoryId, primaryService.id);

  const standardAddOns = addOns.filter(
    (a) =>
      a.id !== "dematting-brush-out" &&
      a.id !== "senior-comfort-care" &&
      a.id !== CREATIVE_ACCENT_COLORING_ID,
  );
  const dematting = addOns.find((a) => a.id === "dematting-brush-out");
  const senior = addOns.find((a) => a.id === "senior-comfort-care");
  const creative = addOns.find((a) => a.id === CREATIVE_ACCENT_COLORING_ID);
  const showGentleNotice = senior && petMayBenefitFromGentleCare(pet);

  function addOnPriceLabel(addOn: BookableService) {
    const estimate = getServicePriceEstimate(addOn, pet.weightLbs);
    if (estimate) return `From +${formatPrice(estimate.from)}`;
    return formatServicePriceFrom(addOn);
  }

  return (
    <section>
      <button type="button" onClick={onBack} className={bookingBackLinkClass}>
        ← Back
      </button>

      <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Care Options
      </p>
      <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
        Personalize the Experience
      </h2>
      <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
        Optional finishing and coat-care services available for {pet.name}.
      </p>

      {showGentleNotice && senior && (
        <div className={`${bookingNoticeClass} mt-8`}>
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            A Little Extra Time for {pet.name}
          </p>
          <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
            Based on {pet.name}&apos;s profile, we may recommend additional
            Gentle Care time so the appointment can remain comfortable and
            unhurried.
          </p>
          <p className="font-body mt-4 text-sm text-ink">
            Gentle Care · {addOnPriceLabel(senior)}
          </p>
          <button
            type="button"
            onClick={() => onToggle(senior.id)}
            className={`${
              selectedIds.includes(senior.id)
                ? bookingSecondaryBtnClass
                : bookingPrimaryBtnClass
            } mt-5`}
          >
            {selectedIds.includes(senior.id) ? "Added" : "Add Gentle Care"}
          </button>
        </div>
      )}

      <div className="mt-8 space-y-4">
        {standardAddOns.map((addOn) => (
          <CareOptionCard
            key={addOn.id}
            title={getServiceDisplayName(addOn.id, addOn.name)}
            description={getServiceDisplayDescription(
              addOn.id,
              addOn.description,
            )}
            priceLabel={addOnPriceLabel(addOn)}
            selected={selectedIds.includes(addOn.id)}
            actionLabel={selectedIds.includes(addOn.id) ? "Remove" : "Add"}
            onAction={() => onToggle(addOn.id)}
          />
        ))}

        {creative && (
          <article className={bookingCardClass}>
            <h3 className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
              {getServiceDisplayName(creative.id, creative.name)}
            </h3>
            <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
              {getServiceDisplayDescription(creative.id, creative.description)}
            </p>
            <p className="font-body mt-4 text-[10px] font-medium uppercase tracking-[0.14em] text-taupe">
              From {formatPrice(100)}
            </p>
            <button
              type="button"
              onClick={() => {
                onToggle(creative.id);
                setShowCreativeOptions(true);
              }}
              className={`${bookingSecondaryBtnClass} mt-5`}
            >
              Explore Options
            </button>
            {showCreativeOptions && creative.options && (
              <div className="mt-5 space-y-2 border-t border-gray-line/70 pt-5">
                {creative.options.map((opt) => (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => onOptionChange(creative.id, opt.name)}
                    className={`w-full rounded-sm border px-4 py-3 text-left text-sm transition ${
                      addOnOptions[creative.id] === opt.name
                        ? "border-deep-lavender bg-dusty-lavender/25 text-ink"
                        : "border-gray-line text-taupe hover:border-champagne"
                    }`}
                  >
                    <span className="font-medium text-ink">{opt.name}</span>
                    {opt.priceFrom != null && (
                      <span className="mt-1 block text-xs">
                        From {formatPrice(opt.priceFrom)}
                        {opt.consultationRequired ? " · Consultation required" : ""}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </article>
        )}
      </div>

      {dematting && (
        <div className={`${bookingNoticeClass} mt-8`}>
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            Coat Condition
          </p>
          <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
            If we discover matting that requires additional time, we will
            discuss the safest and most comfortable approach with you before
            proceeding.
          </p>
          <p className="font-body mt-4 text-sm text-ink">
            Gentle DeMatting · {formatPrice(dematting.flatRate ?? 30)} / 15
            minutes where appropriate
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        className={`${bookingPrimaryBtnClass} mt-10`}
      >
        Continue
      </button>
    </section>
  );
}
