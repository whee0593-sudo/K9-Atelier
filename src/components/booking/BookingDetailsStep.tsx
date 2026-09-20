"use client";

import React from "react";
import { PetScalarFields } from "@/components/account/PetScalarFields";
import {
  bookingBackLinkClass,
  bookingFieldClass,
  bookingLabelClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";
import {
  getBookingParkingField,
  getBookingPrepPetFields,
} from "@/lib/booking-flow";
import type { PetProfile } from "@/lib/pets";

type Props = {
  pet: PetProfile;
  parkingNotes: string;
  onPetChange: (updates: Partial<PetProfile>) => void;
  onParkingNotesChange: (value: string) => void;
  onContinue: () => void | Promise<void>;
  onBack: () => void;
  saving?: boolean;
};

export function BookingDetailsStep({
  pet,
  parkingNotes,
  onPetChange,
  onParkingNotesChange,
  onContinue,
  onBack,
  saving = false,
}: Props) {
  const petFields = getBookingPrepPetFields();
  const parkingField = getBookingParkingField();

  return (
    <section>
      <button type="button" onClick={onBack} className={bookingBackLinkClass}>
        ← Back
      </button>

      <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        03 — Add a Few Details
      </p>
      <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
        Complete a few details to help us prepare for your appointment.
      </h2>
      <p className="font-body mt-4 text-sm leading-relaxed text-taupe">
        Optional notes about {pet.name}, coat, and access help us arrive
        prepared. Skip any that do not apply.
      </p>

      <div className="mt-8 space-y-5">
        <PetScalarFields
          fields={petFields}
          pet={pet}
          onPetChange={onPetChange}
          variant="booking"
        />

        {parkingField ? (
          <div>
            <label className={bookingLabelClass} htmlFor="booking-parking-notes">
              {parkingField.label}
            </label>
            <textarea
              id="booking-parking-notes"
              rows={3}
              value={parkingNotes}
              placeholder={parkingField.placeholder}
              onChange={(event) => onParkingNotesChange(event.target.value)}
              className={`${bookingFieldClass} min-h-[96px] resize-none py-3`}
            />
            {parkingField.note ? (
              <p className="font-body mt-1.5 text-xs leading-relaxed text-taupe">
                {parkingField.note}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void onContinue()}
        className={`${bookingPrimaryBtnClass} mt-10`}
      >
        {saving ? "Saving…" : "Continue"}
      </button>
    </section>
  );
}
