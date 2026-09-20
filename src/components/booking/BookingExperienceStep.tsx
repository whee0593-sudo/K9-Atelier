"use client";

import React, { useEffect, useState } from "react";
import {
  formatServicePrice,
  getServicePriceEstimate,
  isCreativeColoringCategory,
  type BookableService,
  type ServiceOption,
} from "@/lib/services";
import {
  BOOKING_SPA_GROUP_ID,
  BOOKING_SPA_GROUP_NAME,
  bookingCareChoicesForService,
  bookingCareRowsForCategory,
  getBookingCareCategories,
  nextExpandedCareCategoryId,
} from "@/lib/booking-flow";
import {
  coloringOptionDisplayNote,
  getSpaTreatmentsIntro,
} from "@/lib/service-page";
import {
  getCategoryDisplayName,
  getServiceDisplayDescription,
  getServiceDisplayName,
} from "@/lib/service-display";
import type { PetProfile } from "@/lib/pets";
import { formatPrice } from "@/lib/business";
import { createClient } from "@/lib/supabase/client";
import {
  bookingBackLinkClass,
  bookingCardClass,
  bookingCardSelectedClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";

type Props = {
  pet: PetProfile;
  selectedServiceId: string | null;
  selectedOptionName?: string | null;
  onSelect: (service: BookableService, optionName?: string) => void;
  onContinue: (service?: BookableService) => void;
  onBack: () => void;
};

function CareServiceCard({
  pet,
  service,
  selected,
  onSelect,
}: {
  pet: PetProfile;
  service: BookableService;
  selected: boolean;
  onSelect: (service: BookableService) => void;
}) {
  const estimate = getServicePriceEstimate(service, pet.weightLbs);
  const displayName = getServiceDisplayName(service.id, service.name);
  const description = getServiceDisplayDescription(
    service.id,
    service.description,
  );

  return (
    <article
      className={`${bookingCardClass} ${selected ? bookingCardSelectedClass : ""}`}
    >
      <h4 className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
        {displayName}
      </h4>
      <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
        {description}
      </p>
      <p className="font-body mt-6 text-[12px] font-medium uppercase tracking-[0.14em] text-taupe">
        For {pet.name}
      </p>
      {estimate && (
        <>
          <p className="font-display mt-2 text-2xl text-ink">
            From {formatPrice(estimate.from)}
          </p>
          {estimate.durationLabel && (
            <p className="font-body mt-2 text-sm text-taupe">
              Approximately {estimate.durationLabel}
            </p>
          )}
        </>
      )}
      {!estimate && (
        <p className="font-body mt-2 text-sm text-taupe">
          {formatServicePrice(service, pet.weightLbs)}
        </p>
      )}
      <button
        type="button"
        onClick={() => onSelect(service)}
        className={`${bookingPrimaryBtnClass} mt-6`}
      >
        {selected ? "Selected" : "Select"}
      </button>
    </article>
  );
}

function CareColorOptionCard({
  pet,
  service,
  option,
  selected,
  onSelect,
}: {
  pet: PetProfile;
  service: BookableService;
  option: ServiceOption;
  selected: boolean;
  onSelect: (service: BookableService, optionName: string) => void;
}) {
  const note = coloringOptionDisplayNote(option.note);

  return (
    <article
      className={`${bookingCardClass} ${selected ? bookingCardSelectedClass : ""}`}
    >
      <h4 className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
        {option.name}
      </h4>
      {option.description && (
        <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
          {option.description}
        </p>
      )}
      <p className="font-body mt-6 text-[12px] font-medium uppercase tracking-[0.14em] text-taupe">
        For {pet.name}
      </p>
      <p className="font-display mt-2 text-2xl text-ink">
        {option.consultationRequired
          ? "Consultation"
          : option.priceFrom != null
            ? `From ${formatPrice(option.priceFrom)}`
            : "—"}
      </p>
      {note && (
        <p className="font-body mt-2 text-sm text-taupe">{note}</p>
      )}
      <button
        type="button"
        onClick={() => onSelect(service, option.name)}
        className={`${bookingPrimaryBtnClass} mt-6`}
      >
        {selected ? "Selected" : "Select"}
      </button>
    </article>
  );
}

export function BookingExperienceStep({
  pet,
  selectedServiceId,
  selectedOptionName = null,
  onSelect,
  onContinue,
  onBack,
}: Props) {
  const [includeMembersOnly, setIncludeMembersOnly] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(
    null,
  );
  const [expandedSpa, setExpandedSpa] = useState(false);
  const spaIntro = getSpaTreatmentsIntro();
  const categories = getBookingCareCategories(pet.weightLbs, {
    includeMembersOnly,
  });

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        setIncludeMembersOnly(Boolean(user));
      }).catch(() => {
        setIncludeMembersOnly(false);
      });
    } catch {
      setIncludeMembersOnly(false);
    }
  }, []);

  function handleCategoryToggle(categoryId: string) {
    setExpandedCategoryId((current) => {
      const next = nextExpandedCareCategoryId(current, categoryId);
      if (next !== current) setExpandedSpa(false);
      if (next && typeof document !== "undefined") {
        queueMicrotask(() => {
          document
            .getElementById(`care-category-btn-${next}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return next;
    });
  }

  function handleSpaToggle() {
    setExpandedSpa((open) => {
      const next = !open;
      if (next && typeof document !== "undefined") {
        queueMicrotask(() => {
          document
            .getElementById(`care-group-btn-${BOOKING_SPA_GROUP_ID}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return next;
    });
  }

  function handleServiceSelect(service: BookableService, optionName?: string) {
    onSelect(service, optionName);
    setExpandedCategoryId(null);
    setExpandedSpa(false);
  }

  return (
    <section>
      <button type="button" onClick={onBack} className={bookingBackLinkClass}>
        ← Back
      </button>

      <p className="font-body mt-8 text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
        Care
      </p>
      <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
        Choose the care {pet.name} should receive.
      </h2>

      <div className="mt-10 space-y-4">
        {categories.map((category) => {
          const expanded = expandedCategoryId === category.id;
          const selectedInCategory = category.services.find(
            (service) => service.id === selectedServiceId,
          );
          const categoryName = getCategoryDisplayName(
            category.id,
            category.name,
          );
          const selectedName = selectedInCategory
            ? selectedOptionName &&
              isCreativeColoringCategory(selectedInCategory.categoryId)
              ? selectedOptionName
              : getServiceDisplayName(
                  selectedInCategory.id,
                  selectedInCategory.name,
                )
            : null;

          return (
            <div key={category.id} className="scroll-mt-28">
              <button
                type="button"
                id={`care-category-btn-${category.id}`}
                aria-expanded={expanded}
                aria-controls={`care-category-${category.id}`}
                onClick={() => handleCategoryToggle(category.id)}
                className={`${bookingCardClass} relative w-full scroll-mt-28 ${
                  selectedInCategory && !expanded
                    ? bookingCardSelectedClass
                    : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-6 top-6 font-display text-2xl leading-none text-ink md:right-8 md:top-8"
                >
                  {expanded ? "−" : "+"}
                </span>
                <h3 className="font-body pr-10 text-left text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
                  {categoryName}
                </h3>
                {category.note && expanded && (
                  <p className="font-body mt-3 pr-10 text-left text-sm leading-relaxed text-taupe">
                    {category.note}
                  </p>
                )}
                {selectedName && !expanded && (
                  <p className="font-body mt-3 pr-10 text-left text-sm text-ink">
                    {selectedName} selected
                  </p>
                )}
              </button>

              {expanded && (
                <div
                  id={`care-category-${category.id}`}
                  className="mt-3 space-y-3"
                >
                  {bookingCareRowsForCategory(category.services).map((row) => {
                    if (row.kind === "spa-group") {
                      const selectedSpa = row.services.find(
                        (service) => service.id === selectedServiceId,
                      );
                      const selectedSpaName = selectedSpa
                        ? getServiceDisplayName(
                            selectedSpa.id,
                            selectedSpa.name,
                          )
                        : null;

                      return (
                        <div key={BOOKING_SPA_GROUP_ID}>
                          <button
                            type="button"
                            id={`care-group-btn-${BOOKING_SPA_GROUP_ID}`}
                            aria-expanded={expandedSpa}
                            aria-controls={`care-group-${BOOKING_SPA_GROUP_ID}`}
                            onClick={handleSpaToggle}
                            className={`${bookingCardClass} relative w-full ${
                              selectedSpa && !expandedSpa
                                ? bookingCardSelectedClass
                                : ""
                            }`}
                          >
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute right-6 top-6 font-display text-2xl leading-none text-ink md:right-8 md:top-8"
                            >
                              {expandedSpa ? "−" : "+"}
                            </span>
                            <h4 className="font-body pr-10 text-left text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
                              {BOOKING_SPA_GROUP_NAME}
                            </h4>
                            {spaIntro?.note && expandedSpa && (
                              <p className="font-body mt-3 pr-10 text-left text-sm leading-relaxed text-taupe">
                                {spaIntro.note}
                              </p>
                            )}
                            {selectedSpaName && !expandedSpa && (
                              <p className="font-body mt-3 pr-10 text-left text-sm text-ink">
                                {selectedSpaName} selected
                              </p>
                            )}
                          </button>
                          {expandedSpa && (
                            <div
                              id={`care-group-${BOOKING_SPA_GROUP_ID}`}
                              className="mt-3 space-y-3"
                            >
                              {row.services.map((service) => (
                                <CareServiceCard
                                  key={service.id}
                                  pet={pet}
                                  service={service}
                                  selected={selectedServiceId === service.id}
                                  onSelect={handleServiceSelect}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    const service = row.service;
                    const choices = bookingCareChoicesForService(service);
                    if (choices.some((choice) => choice.optionName)) {
                      return (
                        <div key={service.id} className="space-y-3">
                          {(service.options ?? []).map((option) => (
                            <CareColorOptionCard
                              key={`${service.id}:${option.name}`}
                              pet={pet}
                              service={service}
                              option={option}
                              selected={
                                selectedServiceId === service.id &&
                                selectedOptionName === option.name
                              }
                              onSelect={handleServiceSelect}
                            />
                          ))}
                        </div>
                      );
                    }

                    return (
                      <CareServiceCard
                        key={service.id}
                        pet={pet}
                        service={service}
                        selected={selectedServiceId === service.id}
                        onSelect={handleServiceSelect}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedServiceId && (
        <button
          type="button"
          onClick={() => onContinue()}
          className={`${bookingPrimaryBtnClass} mt-8`}
        >
          Continue
        </button>
      )}
    </section>
  );
}

export function isCreativeServiceSelection(service: BookableService) {
  return isCreativeColoringCategory(service.categoryId);
}
