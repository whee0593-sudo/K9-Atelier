"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { business, formatPrice } from "@/lib/business";
import {
  bookingIncludesCreativeColoring,
  formatServicePrice,
  getAddOnService,
  getCreativeBookingPolicy,
  getServicePriceEstimate,
  type BookableService,
  type SelectedService,
} from "@/lib/services";
import { getServiceDisplayName } from "@/lib/service-display";
import { formatServiceAddress, type ServiceAddress, type TravelQuote } from "@/lib/travel";
import type { PetProfile } from "@/lib/pets";
import type { AppointmentRecord } from "@/lib/appointments/types";
import { createCustomerAppointment } from "@/lib/appointments/client";
import { createClient } from "@/lib/supabase/client";
import { isValidSmsPhone } from "@/lib/sms/phone";
import { smsConsentCopy } from "@/lib/notifications";
import { vaccinationBookingNeedsAdminConfirmation } from "@/lib/vaccinations/booking";
import { CreativeBookingPolicy } from "@/components/booking/CreativeBookingPolicy";
import {
  bookingBackLinkClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
  bookingSecondaryBtnClass,
  bookingFieldClass,
  bookingLabelClass,
} from "@/components/booking/booking-ui";

type Props = {
  pet: PetProfile;
  service: BookableService;
  bookingSelection: SelectedService;
  addOnIds: string[];
  addOnOptions: Record<string, string>;
  address: ServiceAddress;
  travelQuote: TravelQuote;
  appointmentDate: string;
  appointmentTime: string;
  onMakeChange: () => void;
  onReserved: (appointment: AppointmentRecord) => void;
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

export function BookingReviewStep({
  pet,
  service,
  bookingSelection,
  addOnIds,
  addOnOptions,
  address,
  travelQuote,
  appointmentDate,
  appointmentTime,
  onMakeChange,
  onReserved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const serviceEstimate = getServicePriceEstimate(service, pet.weightLbs);
  const addOnTotal = estimateAddOnTotal(addOnIds, addOnOptions, pet.weightLbs);
  const serviceFrom = serviceEstimate?.from ?? 0;
  const estimatedTotal = serviceFrom + addOnTotal + travelQuote.fee;
  const deposit = business.booking.newClientDeposit;
  const creativePolicy = bookingIncludesCreativeColoring(addOnIds)
    ? getCreativeBookingPolicy()
    : undefined;
  const pendingVaccinationReview = vaccinationBookingNeedsAdminConfirmation(
    pet.vaccinationBookingStatus,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSavedPhone() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("profiles")
          .select("phone")
          .maybeSingle();
        if (!cancelled && data?.phone) {
          setPhone(data.phone);
        }
      } catch {
        // Profile phone is optional until the customer enters it below.
      }
    }

    void loadSavedPhone();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayServiceName = getServiceDisplayName(
    service.id,
    bookingSelection.serviceName,
  );

  async function handleReserve() {
    if (!isValidSmsPhone(phone)) {
      setError(
        "Please enter a valid US mobile number so we can text appointment updates.",
      );
      return;
    }

    if (!smsConsent) {
      setError(
        "Please confirm you agree to receive appointment text messages.",
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const appointment = await createCustomerAppointment({
        petId: pet.id,
        serviceId: service.id,
        serviceName: displayServiceName,
        addOnIds,
        addOnOptions,
        address,
        travelDistanceMiles: travelQuote.distanceMiles,
        travelFee: travelQuote.fee,
        appointmentDate,
        appointmentTime,
        estimatedTotal,
        newClientDeposit: deposit,
        customerPhone: phone,
        smsConsent: true,
      });
      onReserved(appointment);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not save your appointment. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <button type="button" onClick={onMakeChange} className={bookingBackLinkClass}>
        ← Make a Change
      </button>

      <p className="font-body mt-8 text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Review &amp; Reserve
      </p>
      <h2 className="font-display mt-4 text-3xl text-ink md:text-4xl">
        Your Appointment
      </h2>
      <p className="font-body mt-4 text-sm text-taupe">
        Please review {pet.name}&apos;s private appointment before reserving.
      </p>

      <div className={`${bookingNoticeClass} mt-8 space-y-6`}>
        <div>
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
            {pet.name}
          </p>
          <p className="font-body mt-1 text-sm text-ink">
            {pet.breed} · {pet.weightLbs} lbs
          </p>
        </div>

        <div className="border-t border-gray-line/70 pt-6">
          <p className="font-body text-[10px] font-medium uppercase tracking-[0.16em] text-deep-lavender">
            {displayServiceName}
          </p>
          <p className="font-body mt-3 text-sm text-ink">
            {appointmentDate} · {appointmentTime}
          </p>
          <p className="font-body mt-2 text-sm text-taupe">
            {formatServiceAddress(address)}
          </p>
        </div>

        <div className="space-y-3 border-t border-gray-line/70 pt-6 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-taupe">Service</span>
            <span className="text-ink">
              From {formatPrice(serviceFrom)}
            </span>
          </div>
          {addOnIds.length > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-taupe">Care Options</span>
              <span className="text-right text-ink">
                {addOnIds.map((id) => {
                  const addOn = getAddOnService(id);
                  if (!addOn) return null;
                  return (
                    <span key={id} className="block">
                      {getServiceDisplayName(addOn.id, addOn.name)}{" "}
                      {formatServicePrice(addOn, pet.weightLbs, addOnOptions[id])}
                    </span>
                  );
                })}
              </span>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <span className="text-taupe">Travel</span>
            <span className="text-ink">
              {travelQuote.fee === 0
                ? "Complimentary"
                : `+${formatPrice(travelQuote.fee)}`}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-line/70 pt-6">
          <div className="flex justify-between gap-4 text-sm">
            <span className="font-medium text-ink">Estimated Service</span>
            <span className="font-display text-2xl text-ink">
              From {formatPrice(estimatedTotal)}
            </span>
          </div>
          <div className="mt-4 flex justify-between gap-4 text-sm">
            <span className="text-taupe">New Client Deposit Today</span>
            <span className="text-ink">{formatPrice(deposit)}</span>
          </div>
          <p className="font-body mt-4 text-xs leading-relaxed text-taupe">
            A ${deposit} deposit reserves your first K9 Atelier appointment and
            will be applied toward your final service total.
          </p>
        </div>
      </div>

      {creativePolicy && (
        <CreativeBookingPolicy policy={creativePolicy} className="mt-6" />
      )}

      {pendingVaccinationReview && (
        <p
          className="font-body mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800"
          role="status"
        >
          {pet.name}&apos;s vaccination record is pending staff review. You may
          submit this appointment request now, but it will not be confirmed until
          our team approves the vaccination record.
        </p>
      )}

      <div className="mt-8">
        <label className="block">
          <span className={bookingLabelClass}>Mobile phone for appointment texts</span>
          <input
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(561) 555-0123"
            className={bookingFieldClass}
          />
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(event) => setSmsConsent(event.target.checked)}
            required
            aria-required="true"
            className="mt-0.5 size-4 shrink-0 accent-deep-lavender"
          />
          <span className="font-body text-xs leading-relaxed text-taupe">
            {smsConsentCopy}
          </span>
        </label>
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
        onClick={() => void handleReserve()}
        className={`${bookingPrimaryBtnClass} mt-8`}
      >
        {loading
          ? "Saving…"
          : pendingVaccinationReview
            ? "Submit Appointment Request"
            : "Reserve Appointment"}
      </button>

      <button
        type="button"
        onClick={onMakeChange}
        className={`${bookingSecondaryBtnClass} mt-4 w-full sm:w-auto`}
      >
        Make a Change
      </button>
    </section>
  );
}

export function BookingConfirmationView({
  pet,
  serviceName,
  appointmentDate,
  appointmentTime,
  address,
  appointmentStatus,
}: {
  pet: PetProfile;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  address: ServiceAddress;
  appointmentStatus?: AppointmentRecord["status"];
}) {
  const pendingConfirmation =
    appointmentStatus === "pending_confirmation" ||
    (appointmentStatus == null &&
      vaccinationBookingNeedsAdminConfirmation(pet.vaccinationBookingStatus));

  return (
    <section className="text-center">
      <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        {pendingConfirmation
          ? "Request Received"
          : "Your Appointment Is Reserved"}
      </p>
      <h2 className="font-display mt-5 text-4xl text-ink md:text-5xl">
        {pendingConfirmation ? (
          <>
            We&apos;re Reviewing
            <br />
            {pet.name}&apos;s Request.
          </>
        ) : (
          <>
            We Look Forward
            <br />
            to Welcoming {pet.name}.
          </>
        )}
      </h2>

      <div className={`${bookingNoticeClass} mx-auto mt-10 max-w-lg text-left`}>
        <p className="text-sm text-ink">{serviceName}</p>
        <p className="mt-3 text-sm text-taupe">
          {appointmentDate} · {appointmentTime}
        </p>
        <p className="mt-2 text-sm text-taupe">
          {formatServiceAddress(address)}
        </p>
        {pendingConfirmation ? (
          <p className="mt-6 text-sm leading-relaxed text-red-800">
            Your appointment request has been received. It will remain pending
            until our team confirms the appointment. We will contact you once
            your appointment is confirmed.
          </p>
        ) : (
          <p className="mt-6 text-xs text-taupe">
            Your appointment has been reserved exclusively for {pet.name}. We
            will email and text updates to this reservation.
          </p>
        )}
      </div>

      <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <Link href="/account/bookings" className={bookingPrimaryBtnClass}>
          View Appointment
        </Link>
        <Link href="/" className={bookingSecondaryBtnClass}>
          Return Home
        </Link>
      </div>
    </section>
  );
}
