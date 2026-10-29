"use client";

import React, { useState } from "react";
import { formatPrice } from "@/lib/business";
import {
  CREATIVE_ACCENT_COLORING_ID,
  GENTLE_DEMATTING_ASSESSMENT_NOTE,
  formatServicePriceFrom,
  getAvailableAddOns,
  getServicePriceEstimate,
  isAssessedOnSiteService,
  type BookableService,
} from "@/lib/services";
import {
  getServiceDisplayDescription,
  getServiceDisplayName,
} from "@/lib/service-display";
import { petMayBenefitFromGentleCare, type PetProfile } from "@/lib/pets";
import { bookingWeightLbs } from "@/lib/pets/weight";
import { guestCreativeOptionNotice } from "@/lib/booking-flow";
import { isLuxurySpaDay } from "@/lib/service-catalog";
import {
  ESSENTIAL_OILS_BODY,
  ESSENTIAL_OILS_HEADING,
  SPA_GOALS,
  SPA_GOAL_HEADING,
  SPA_GOAL_NOTE,
  type SpaGoalId,
} from "@/lib/spa-goals";
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
  showPrices?: boolean;
  onToggle: (id: string) => void;
  onOptionChange: (addOnId: string, optionName: string) => void;
  onContinue: () => void;
  onAddDog?: () => void;
  saving?: boolean;
  saveError?: string | null;
  onBack: () => void;
  spaGoals?: SpaGoalId[];
  onSpaGoalsChange?: (goals: SpaGoalId[]) => void;
};

function CareOptionCard({
  title,
  description,
  priceLabel,
  note,
  selected,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  priceLabel?: string;
  note?: string;
  selected: boolean;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <article
      className={`${bookingCardClass} ${selected ? bookingCardSelectedClass : ""}`}
    >
      <h3 className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
        {title}
      </h3>
      <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
        {description}
      </p>
      {note ? (
        <p className="font-body mt-3 text-sm leading-relaxed text-taupe">{note}</p>
      ) : null}
      {priceLabel ? (
        <p className="font-body mt-4 text-[12px] font-medium uppercase tracking-[0.14em] text-taupe">
          {priceLabel}
        </p>
      ) : null}
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
  showPrices = false,
  onToggle,
  onOptionChange,
  onContinue,
  onAddDog,
  saving = false,
  saveError,
  onBack,
  spaGoals = [],
  onSpaGoalsChange,
}: Props) {
  const [showCreativeOptions, setShowCreativeOptions] = useState(false);
  const [creativeNotice, setCreativeNotice] = useState<string | null>(null);
  const addOns = getAvailableAddOns(primaryService.categoryId, primaryService.id).filter((item) => item.id !== CREATIVE_ACCENT_COLORING_ID || !selectedIds.some((id) => id.startsWith(CREATIVE_ACCENT_COLORING_ID + "::")));

  const standardAddOns = addOns.filter((item) => item.id !== CREATIVE_ACCENT_COLORING_ID);
  const senior = addOns.find((item) => item.id === "senior-comfort-care");
  const creative = addOns.find((item) => item.id === CREATIVE_ACCENT_COLORING_ID);
  const showGentleNotice = Boolean(senior && petMayBenefitFromGentleCare(pet));

  function addOnPriceLabel(addOn: BookableService) {
    if (!showPrices || isAssessedOnSiteService(addOn)) return "";
    const weightLbs = bookingWeightLbs(pet.weightLbs);
    const estimate =
      weightLbs == null ? null : getServicePriceEstimate(addOn, weightLbs);
    if (estimate) return `From ${formatPrice(estimate.from)}`;
    return formatServicePriceFrom(addOn);
  }

  function addOnNote(addOn: BookableService) {
    if (!isAssessedOnSiteService(addOn)) return undefined;
    return addOn.assessmentNote?.trim() || GENTLE_DEMATTING_ASSESSMENT_NOTE;
  }

  return (
    <section>
      <fieldset disabled={saving} className="min-w-0">
      <button type="button" onClick={onBack} className={bookingBackLinkClass}>
        ← Back
      </button>

      <p className="font-body mt-8 text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
        Personalize Your Visit
      </p>
      <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
        Personalize Your Visit
      </h2>
      {isLuxurySpaDay(primaryService.id) ? (
        <div className="mt-8 space-y-4">
          <h3 className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            {SPA_GOAL_HEADING}
          </h3>
          <p className="font-body text-sm leading-relaxed text-taupe">{SPA_GOAL_NOTE}</p>
          <div className="space-y-3">
            {SPA_GOALS.map((goal) => {
              const selected = spaGoals.includes(goal.id);
              return (
                <label
                  key={goal.id}
                  className={`${bookingCardClass} flex cursor-pointer items-start gap-3 ${
                    selected ? bookingCardSelectedClass : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected}
                    onChange={() => {
                      const next = selected
                        ? spaGoals.filter((id) => id !== goal.id)
                        : [...spaGoals, goal.id];
                      onSpaGoalsChange?.(next);
                    }}
                  />
                  <span>
                    <span className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
                      {goal.title}
                    </span>
                    <span className="font-body mt-2 block text-sm leading-relaxed text-taupe">
                      {goal.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className={bookingNoticeClass}>
            <p className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
              {ESSENTIAL_OILS_HEADING}
            </p>
            <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
              {ESSENTIAL_OILS_BODY}
            </p>
          </div>
        </div>
      ) : null}
      <h3 className="font-body mt-10 text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
        Optional Add-On Care
      </h3>
      <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
        Optional finishing and coat-care services available for {pet.name}.
      </p>

      {showGentleNotice ? (
        <div className={`${bookingNoticeClass} mt-8`}>
          <p className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            A Little Extra Time for {pet.name}
          </p>
          <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
            Based on {pet.name}&apos;s profile, Extra-Gentle Senior Care can be
            added if you would like a slower, more comfortable appointment. It
            is optional and is never added automatically.
          </p>
        </div>
      ) : null}

      <div className="mt-8 space-y-4">
        {standardAddOns.map((addOn) => (
          <CareOptionCard
            key={addOn.id}
            title={getServiceDisplayName(addOn.id, addOn.name)}
            description={getServiceDisplayDescription(
              addOn.id,
              addOn.description,
            )}
            note={addOnNote(addOn)}
            priceLabel={addOnPriceLabel(addOn)}
            selected={selectedIds.includes(addOn.id)}
            actionLabel={selectedIds.includes(addOn.id) ? "Remove" : "Add"}
            onAction={() => onToggle(addOn.id)}
          />
        ))}

        {creative && (
          <article className={bookingCardClass}>
            <h3 className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
              {getServiceDisplayName(creative.id, creative.name)}
            </h3>
            <p className="font-body mt-3 text-sm leading-relaxed text-taupe">
              {getServiceDisplayDescription(creative.id, creative.description)}
            </p>
            {showPrices ? (
              <p className="font-body mt-4 text-[12px] font-medium uppercase tracking-[0.14em] text-taupe">
                From {formatPrice(100)}
              </p>
            ) : null}
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
                {creative.options.map((opt) => {
                  const guestNotice = guestCreativeOptionNotice(opt.name);
                  return (
                  <button
                    key={opt.name}
                    type="button"
                    onClick={() => {
                      if (guestNotice) {
                        setCreativeNotice(guestNotice);
                        return;
                      }
                      setCreativeNotice(null);
                      onOptionChange(creative.id, opt.name);
                    }}
                    className={`w-full rounded-sm border px-4 py-3 text-left text-sm transition ${
                      !guestNotice && addOnOptions[creative.id] === opt.name
                        ? "border-deep-lavender bg-dusty-lavender/25 text-ink"
                        : "border-gray-line text-taupe hover:border-champagne"
                    }`}
                  >
                    <span className="font-medium text-ink">{opt.name}</span>
                    {showPrices && opt.priceFrom != null ? (
                      <span className="mt-1 block text-xs">
                        From {formatPrice(opt.priceFrom)}
                        {opt.consultationRequired ? " · Consultation required" : ""}
                      </span>
                    ) : opt.consultationRequired ? (
                      <span className="mt-1 block text-xs">Consultation required</span>
                    ) : null}
                    {guestNotice && creativeNotice === guestNotice ? (
                      <span className="mt-2 block text-sm text-ink" role="status">
                        {creativeNotice}
                      </span>
                    ) : null}
                  </button>
                  );
                })}
              </div>
            )}
          </article>
        )}
      </div>

      {saveError ? <p className="font-body mt-6 text-sm text-red-700" role="alert">{saveError}</p> : null}
      <div className="mt-10 grid grid-cols-2 items-stretch gap-3 [&>button]:px-3 sm:flex sm:flex-nowrap sm:items-center sm:[&>button]:px-6">
      {onAddDog ? <button type="button" onClick={onAddDog} disabled={saving} className={bookingSecondaryBtnClass}>+ Add Another Dog</button> : null}
      <button
        type="button"
        onClick={onContinue}
        disabled={saving}
        className={bookingPrimaryBtnClass}
      >
        {saving ? "Saving…" : "Continue"}
      </button>
      </div>
      </fieldset>
    </section>
  );
}
