"use client";

import { useEffect, useState } from "react";
import {
  formatServicePrice,
  getBookableServicesForPet,
  getServicePriceEstimate,
  isCreativeColoringCategory,
  isSpaService,
  type BookableService,
} from "@/lib/services";
import {
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

export function BookingExperienceStep({
  pet,
  selectedServiceId,
  onSelect,
  onContinue,
  onBack,
}: Props) {
  const [includeMembersOnly, setIncludeMembersOnly] = useState(false);
  const services = getBookableServicesForPet(pet.weightLbs, {
    includeMembersOnly,
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIncludeMembersOnly(Boolean(user));
    });
  }, []);

  return (
    <section>
      <button type="button" onClick={onBack} className={bookingBackLinkClass}>
        ← Back
      </button>

      <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Select an Experience
      </p>
      <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
        Choose the care experience you would like us to reserve for {pet.name}.
      </h2>

      <div className="mt-10 space-y-4">
        {services.map((service) => {
          const selected = selectedServiceId === service.id;
          const estimate = getServicePriceEstimate(service, pet.weightLbs);
          const displayName = getServiceDisplayName(service.id, service.name);
          const description = getServiceDisplayDescription(
            service.id,
            service.description,
          );
          const isSpa = isSpaService(service.id);

          return (
            <article
              key={service.id}
              className={`${bookingCardClass} ${
                selected ? bookingCardSelectedClass : ""
              }`}
            >
              <h3 className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
                {displayName}
              </h3>
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
                onClick={() => {
                  onSelect(service);
                  onContinue(service);
                }}
                className={`${bookingPrimaryBtnClass} mt-6`}
              >
                {selected ? "Selected" : isSpa ? "Explore" : "Select"}
              </button>
            </article>
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
