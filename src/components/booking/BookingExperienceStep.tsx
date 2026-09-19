"use client";

import React, { useEffect, useState } from "react";
import {
  formatServicePrice,
  getServicePriceEstimate,
  isCreativeColoringCategory,
  isSpaService,
  type BookableService,
} from "@/lib/services";
import {
  getBookingCareCategories,
  nextExpandedCareCategoryId,
} from "@/lib/booking-flow";
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
  onSelect: (service: BookableService) => void;
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
  const isSpa = isSpaService(service.id);

  return (
    <article
      className={`${bookingCardClass} ${selected ? bookingCardSelectedClass : ""}`}
    >
      <h4 className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
        {displayName}
      </h4>
      <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
        {description}
      </p>
      <p className="font-body mt-6 text-[10px] font-medium uppercase tracking-[0.14em] text-taupe">
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
        {selected ? "Selected" : isSpa ? "Explore" : "Select"}
      </button>
    </article>
  );
}

export function BookingExperienceStep({
  pet,
  selectedServiceId,
  onSelect,
  onContinue,
  onBack,
}: Props) {
  const [includeMembersOnly, setIncludeMembersOnly] = useState(false);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(
    null,
  );
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
    setExpandedCategoryId((current) =>
      nextExpandedCareCategoryId(current, categoryId),
    );
  }

  function handleServiceSelect(service: BookableService) {
    onSelect(service);
    setExpandedCategoryId(null);
  }

  return (
    <section>
      <button type="button" onClick={onBack} className={bookingBackLinkClass}>
        ← Back
      </button>

      <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
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
            ? getServiceDisplayName(
                selectedInCategory.id,
                selectedInCategory.name,
              )
            : null;

          return (
            <div key={category.id}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`care-category-${category.id}`}
                onClick={() => handleCategoryToggle(category.id)}
                className={`${bookingCardClass} relative w-full ${
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
                <h3 className="font-body pr-10 text-left text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
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
                  {category.services.map((service) => (
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
