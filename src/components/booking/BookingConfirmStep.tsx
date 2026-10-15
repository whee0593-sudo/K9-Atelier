"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import {
  bookingBackLinkClass,
  bookingFieldClass,
  bookingLabelClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";
import { BookingPriceLines } from "@/components/booking/BookingPriceLines";
import {
  BOOKING_PRICE_DISCLAIMER,
  createSubmitGuard,
  formatBookingDate,
  quoteGuestBooking,
  type BookingPriceQuote,
} from "@/lib/booking-price";
import type { BookableService } from "@/lib/services";
import { formatServiceAddress, type ServiceAddress, type TravelQuote } from "@/lib/travel";
import type { PetProfile } from "@/lib/pets";
import { bookingWeightLbs } from "@/lib/pets/weight";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  AppointmentClientError,
  createCustomerAppointment,
} from "@/lib/appointments/client";
import { createCustomerPet } from "@/lib/pets/client";
import { mapPetProfileToWriteInput } from "@/lib/pets/map";
import { isPersistedPetId } from "@/lib/booking-flow";
import {
  formatPaymentMethodLabel,
  type PaymentMethodRecord,
} from "@/lib/payments/types";
import type { BookingOwnerDetails } from "@/components/booking/BookingOwnerStep";

type Props = {
  pet: PetProfile;
  service: BookableService;
  addOnIds: string[];
  addOnOptions: Record<string, string>;
  address: ServiceAddress;
  travelQuote: TravelQuote;
  appointmentDate: string;
  appointmentTime: string;
  slotStartMinutes: number;
  owner: BookingOwnerDetails;
  paymentMethod: PaymentMethodRecord;
  initialReferralCode?: string;
  idempotencyKey: string;
  onBack: () => void;
  onReserved: (appointment: AppointmentRecord, pet: PetProfile) => void;
};

export function BookingConfirmStep({
  pet,
  service,
  addOnIds,
  addOnOptions,
  address,
  travelQuote,
  appointmentDate,
  appointmentTime,
  slotStartMinutes,
  owner,
  paymentMethod,
  initialReferralCode = "",
  idempotencyKey,
  onBack,
  onReserved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverQuote, setServerQuote] = useState<BookingPriceQuote | null>(null);
  const submitGuard = useRef(createSubmitGuard());
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [referralStatus, setReferralStatus] = useState<"idle" | "valid" | "invalid">(
    "idle",
  );

  const weightLbs = bookingWeightLbs(pet.weightLbs);
  const localQuote =
    weightLbs == null
      ? null
      : quoteGuestBooking({
          serviceId: service.id,
          weightLbs,
          addOnIds,
          addOnOptions,
          distanceMiles: travelQuote.distanceMiles,
        });
  const quoted = serverQuote ? { ok: true as const, quote: serverQuote } : localQuote;
  const quoteKey = [
    service.id,
    weightLbs ?? "",
    travelQuote.distanceMiles,
    [...addOnIds]
      .sort()
      .map((id) => `${id}:${addOnOptions[id] ?? ""}`)
      .join(","),
  ].join("|");

  useEffect(() => {
    setServerQuote(null);
  }, [quoteKey]);

  useEffect(() => {
    const code = initialReferralCode.trim();
    if (!code) return;
    void fetch(`/api/referrals/validate?code=${encodeURIComponent(code)}`, {
      credentials: "include",
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          valid?: boolean;
          message?: string;
        };
        if (body.valid) {
          setReferralStatus("valid");
          return;
        }
        setReferralStatus("invalid");
        if (body.message) setError(body.message);
      })
      .catch(() => undefined);
  }, [initialReferralCode]);

  async function handleConfirm() {
    if (!idempotencyKey) {
      setError("Please review this appointment and confirm again.");
      return;
    }
    if (!submitGuard.current.start()) return;
    if (travelQuote.lat == null || travelQuote.lon == null || !quoted?.ok) {
      submitGuard.current.end();
      setError("Please go back and confirm your address and appointment date.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let bookingPet = pet;
      if (!isPersistedPetId(pet.id)) {
        bookingPet = await createCustomerPet(mapPetProfileToWriteInput(pet));
      }

      const appointment = await createCustomerAppointment({
        petId: bookingPet.id,
        serviceId: service.id,
        serviceName: quoted.quote.serviceName,
        addOnIds,
        addOnOptions,
        address,
        travelDistanceMiles: quoted.quote.travelDistanceMiles,
        travelFee: quoted.quote.travelFee,
        appointmentDate,
        appointmentTime,
        slotStartMinutes,
        addressLat: travelQuote.lat,
        addressLon: travelQuote.lon,
        estimatedTotal: quoted.quote.estimatedTotal,
        paymentMethodId: paymentMethod.id,
        customerPhone: owner.phone,
        customerFirstName: owner.firstName,
        customerLastName: owner.lastName,
        smsConsent: owner.smsConsent,
        photoMarketingConsent: owner.photoMarketingConsent,
        servicePoliciesConsent: owner.servicePoliciesConsent,
        idempotencyKey,
        referralCode: referralCode.trim() || undefined,
      });
      onReserved(appointment, bookingPet);
    } catch (submitError) {
      if (
        submitError instanceof AppointmentClientError &&
        submitError.code === "price_changed" &&
        submitError.quote
      ) {
        setServerQuote(submitError.quote);
      }
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not confirm your appointment. Please try again.",
      );
    } finally {
      submitGuard.current.end();
      setLoading(false);
    }
  }

  return (
    <section>
      <button type="button" onClick={onBack} className={bookingBackLinkClass}>
        ← Back
      </button>
      <p className="font-body mt-8 text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
        Confirm
      </p>
      <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
        Review your appointment
      </h2>
      <p className="font-body mt-4 text-sm text-taupe">
        Please look over these details. Confirming saves this household profile
        and sends your reservation email and text.
      </p>

      <div className={`${bookingNoticeClass} mt-8 space-y-6`}>
        <div>
          <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
            Customer
          </p>
          <p className="font-body mt-3 text-sm text-ink">
            {owner.firstName} {owner.lastName}
          </p>
          <p className="font-body mt-1 text-sm text-taupe">{owner.email}</p>
          <p className="font-body mt-1 text-sm text-taupe">{owner.phone}</p>
        </div>

        <div className="border-t border-gray-line/70 pt-6">
          <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
            Pet
          </p>
          <p className="font-display mt-2 text-2xl text-ink">{pet.name}</p>
          <p className="font-body mt-1 text-sm text-ink">
            {pet.breed} · {pet.weightLbs} lbs
          </p>
        </div>

        <div className="border-t border-gray-line/70 pt-6">
          <p className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            Appointment Date
          </p>
          <p className="font-body mt-3 text-sm text-ink">
            {formatBookingDate(appointmentDate)}
          </p>
          <p className="font-body mt-4 text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            Arrival Window
          </p>
          <p className="font-body mt-3 text-sm text-ink">{appointmentTime}</p>
          <p className="font-body mt-2 text-xs text-taupe">
            Estimated arrival for our mobile route. Timing may vary due to weather
            or traffic. We will text you when we are on the way.
          </p>
          <p className="font-body mt-2 text-sm text-taupe">
            {formatServiceAddress(address)}
          </p>
        </div>

        {quoted?.ok ? (
          <div className="border-t border-gray-line/70 pt-6">
            <BookingPriceLines quote={quoted.quote} />
          </div>
        ) : (
          <p className="font-body border-t border-gray-line/70 pt-6 text-sm text-red-800" role="alert">
            {quoted?.message ?? "Add this dog's weight before we can price the visit."}
          </p>
        )}

        <div className="border-t border-gray-line/70 pt-6">
          <p className="font-body text-[12px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            Payment method on file
          </p>
          <p className="font-body mt-3 text-sm text-ink">
            {formatPaymentMethodLabel(paymentMethod)}
          </p>
          <p className="font-body mt-2 text-xs leading-relaxed text-taupe">
            No charge now. Payment is settled after the appointment.
          </p>
        </div>
      </div>

      <p className="font-body mt-6 text-sm leading-relaxed text-taupe">
        {BOOKING_PRICE_DISCLAIMER}
      </p>

      <div className={`${bookingNoticeClass} mt-6 space-y-4`}>
        <p className="font-body text-[12px] font-medium uppercase tracking-[0.18em] text-taupe">
          Referral Code
        </p>
        <label className={bookingLabelClass} htmlFor="referral-code">
          Have a friend’s referral code?
        </label>
        <input
          id="referral-code"
          type="text"
          autoComplete="off"
          value={referralCode}
          onChange={(event) => {
            setReferralCode(event.target.value.toUpperCase());
            setReferralStatus("idle");
          }}
          className={bookingFieldClass}
          placeholder="PRINCE-PENNY-S"
        />
        {referralStatus === "valid" ? (
          <p className="font-body text-sm text-ink">
            Referral code applied. The 10% new-client savings is calculated after
            the first completed visit.
          </p>
        ) : null}
        <Link href="/referrals" className="font-body text-xs text-ink underline">
          View Referral Rewards rules
        </Link>
      </div>

      {error ? (
        <p
          className="font-body mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={loading || !quoted?.ok || !idempotencyKey}
        onClick={() => void handleConfirm()}
        className={`${bookingPrimaryBtnClass} mt-8`}
      >
        {loading ? "Confirming…" : "Confirm Appointment"}
      </button>
    </section>
  );
}
