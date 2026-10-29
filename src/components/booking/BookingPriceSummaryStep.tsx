"use client";

import React from "react";
import {
  bookingBackLinkClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";
import { BookingPriceLines } from "@/components/booking/BookingPriceLines";
import { quoteGuestBooking } from "@/lib/booking-price";
import type { BookableService } from "@/lib/services";
import type { PetProfile } from "@/lib/pets";
import { bookingWeightLbs } from "@/lib/pets/weight";

type Props = {
  pet: PetProfile;
  service: BookableService;
  addOnIds: string[];
  addOnOptions: Record<string, string>;
  distanceMiles: number;
  onBack: () => void;
  onContinue: () => void;
};

export function BookingPriceSummaryStep({
  pet,
  service,
  addOnIds,
  addOnOptions,
  distanceMiles,
  onBack,
  onContinue,
}: Props) {
  const weightLbs = bookingWeightLbs(pet.weightLbs);
  const quoted =
    weightLbs == null
      ? null
      : quoteGuestBooking({
          serviceId: service.id,
          fixedServicePrices: pet.fixedServicePrices,
          weightLbs,
          addOnIds,
          addOnOptions,
          distanceMiles,
        });

  return (
    <section>
      <button type="button" onClick={onBack} className={bookingBackLinkClass}>
        ← Back
      </button>
      <p className="font-body mt-8 text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
        Price
      </p>
      <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
        Estimated total
      </h2>
      <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
        Review this price before saving a card. You can go back to change the
        service, add-ons, date, or address. Continuing does not book the
        appointment and does not charge a card.
      </p>

      {quoted?.ok ? (
        <div className={`${bookingNoticeClass} mt-8`}>
          <BookingPriceLines quote={quoted.quote} />
        </div>
      ) : (
        <p
          className="font-body mt-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {quoted?.message ?? "Add this dog's weight before we can price the visit."}
        </p>
      )}

      <button
        type="button"
        onClick={onContinue}
        disabled={!quoted?.ok}
        className={`${bookingPrimaryBtnClass} mt-8`}
      >
        Continue
      </button>
    </section>
  );
}
