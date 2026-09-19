"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  bookingBackLinkClass,
  bookingFieldClass,
  bookingLabelClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";
import { formatPrice } from "@/lib/business";
import {
  formatServicePrice,
  getAddOnService,
  getServicePriceEstimate,
  type BookableService,
} from "@/lib/services";
import { getServiceDisplayName } from "@/lib/service-display";
import { formatServiceAddress, type ServiceAddress, type TravelQuote } from "@/lib/travel";
import type { PetProfile } from "@/lib/pets";
import type { AppointmentRecord } from "@/lib/appointments/types";
import { createCustomerAppointment } from "@/lib/appointments/client";
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
  onBack: () => void;
  onReserved: (appointment: AppointmentRecord, pet: PetProfile) => void;
};

function estimateAddOnTotal(
  addOnIds: string[],
  addOnOptions: Record<string, string>,
  weightLbs: number,
) {
  return addOnIds.reduce((sum, id) => {
    const addOn = getAddOnService(id);
    if (!addOn) return sum;
    const estimate = getServicePriceEstimate(
      addOn,
      weightLbs,
      addOnOptions[id],
    );
    return sum + (estimate?.from ?? 0);
  }, 0);
}

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
  onBack,
  onReserved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [referralStatus, setReferralStatus] = useState<"idle" | "valid" | "invalid">(
    "idle",
  );

  const serviceEstimate = getServicePriceEstimate(service, pet.weightLbs);
  const addOnTotal = estimateAddOnTotal(addOnIds, addOnOptions, pet.weightLbs);
  const serviceFrom = serviceEstimate?.from ?? 0;
  const estimatedTotal = serviceFrom + addOnTotal + travelQuote.fee;
  const displayServiceName = getServiceDisplayName(service.id, service.name);

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
    if (travelQuote.lat == null || travelQuote.lon == null) {
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
        serviceName: displayServiceName,
        addOnIds,
        addOnOptions,
        address,
        travelDistanceMiles: travelQuote.distanceMiles,
        travelFee: travelQuote.fee,
        appointmentDate,
        appointmentTime,
        slotStartMinutes,
        addressLat: travelQuote.lat,
        addressLon: travelQuote.lon,
        estimatedTotal,
        paymentMethodId: paymentMethod.id,
        customerPhone: owner.phone,
        customerFirstName: owner.firstName,
        customerLastName: owner.lastName,
        smsConsent: true,
        photoMarketingConsent: true,
        servicePoliciesConsent: true,
        referralCode: referralCode.trim() || undefined,
      });
      onReserved(appointment, bookingPet);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not confirm your appointment. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <button type="button" onClick={onBack} className={bookingBackLinkClass}>
        ← Back
      </button>
      <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
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
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
            Dog
          </p>
          <p className="font-display mt-2 text-2xl text-ink">{pet.name}</p>
          <p className="font-body mt-1 text-sm text-ink">
            {pet.breed} · {pet.weightLbs} lbs
          </p>
        </div>

        <div className="border-t border-gray-line/70 pt-6">
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            Date &amp; Time
          </p>
          <p className="font-body mt-3 text-sm text-ink">
            {appointmentDate} · {appointmentTime}
          </p>
          <p className="font-body mt-2 text-sm text-taupe">
            {formatServiceAddress(address)}
          </p>
        </div>

        <div className="border-t border-gray-line/70 pt-6">
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            Care
          </p>
          <p className="font-body mt-3 text-sm text-ink">{displayServiceName}</p>
          {addOnIds.length > 0 ? (
            <p className="font-body mt-2 text-sm text-taupe">
              {addOnIds
                .map((id) => {
                  const addOn = getAddOnService(id);
                  return addOn
                    ? getServiceDisplayName(addOn.id, addOn.name)
                    : null;
                })
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>

        <div className="border-t border-gray-line/70 pt-6">
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            Owner
          </p>
          <p className="font-body mt-3 text-sm text-ink">
            {owner.firstName} {owner.lastName}
          </p>
          <p className="font-body mt-1 text-sm text-taupe">{owner.email}</p>
          <p className="font-body mt-1 text-sm text-taupe">{owner.phone}</p>
        </div>

        <div className="border-t border-gray-line/70 pt-6">
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            Payment method on file
          </p>
          <p className="font-body mt-3 text-sm text-ink">
            {formatPaymentMethodLabel(paymentMethod)}
          </p>
          <p className="font-body mt-2 text-xs leading-relaxed text-taupe">
            No charge now. Payment is settled after the appointment.
          </p>
        </div>

        <div className="space-y-3 border-t border-gray-line/70 pt-6 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-taupe">Service</span>
            <span className="text-ink">From {formatPrice(serviceFrom)}</span>
          </div>
          {addOnIds.map((id) => {
            const addOn = getAddOnService(id);
            if (!addOn) return null;
            return (
              <div key={id} className="flex justify-between gap-4">
                <span className="text-taupe">
                  {getServiceDisplayName(addOn.id, addOn.name)}
                </span>
                <span className="text-ink">
                  {formatServicePrice(addOn, pet.weightLbs, addOnOptions[id])}
                </span>
              </div>
            );
          })}
          <div className="flex justify-between gap-4">
            <span className="text-taupe">Travel</span>
            <span className="text-ink">
              {travelQuote.fee === 0
                ? "Complimentary"
                : `+${formatPrice(travelQuote.fee)}`}
            </span>
          </div>
          <div className="flex justify-between gap-4 pt-2">
            <span className="font-medium text-ink">Estimated total</span>
            <span className="font-display text-2xl text-ink">
              From {formatPrice(estimatedTotal)}
            </span>
          </div>
        </div>
      </div>

      <div className={`${bookingNoticeClass} mt-6 space-y-4`}>
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
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
        disabled={loading}
        onClick={() => void handleConfirm()}
        className={`${bookingPrimaryBtnClass} mt-8`}
      >
        {loading ? "Confirming…" : "Confirm Appointment"}
      </button>
    </section>
  );
}
