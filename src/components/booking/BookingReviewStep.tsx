"use client";

import Link from "next/link";
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
import { newClientDepositNotice } from "@/lib/notifications";
import { CreativeBookingPolicy } from "@/components/booking/CreativeBookingPolicy";
import {
  bookingBackLinkClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
  bookingSecondaryBtnClass,
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
  onReserved: () => void;
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
  const serviceEstimate = getServicePriceEstimate(service, pet.weightLbs);
  const addOnTotal = estimateAddOnTotal(addOnIds, addOnOptions, pet.weightLbs);
  const serviceFrom = serviceEstimate?.from ?? 0;
  const estimatedTotal = serviceFrom + addOnTotal + travelQuote.fee;
  const deposit = business.booking.newClientDeposit;
  const creativePolicy = bookingIncludesCreativeColoring(addOnIds)
    ? getCreativeBookingPolicy()
    : undefined;

  const displayServiceName = getServiceDisplayName(
    service.id,
    bookingSelection.serviceName,
  );

  const mailtoHref = `mailto:${business.brand.email}?subject=${encodeURIComponent(
    `Appointment Request - ${pet.name}`,
  )}&body=${encodeURIComponent(
    [
      `Pet: ${pet.name} (${pet.weightLbs} lbs)`,
      `Service: ${displayServiceName}`,
      ...addOnIds.map((id) => {
        const addOn = getAddOnService(id);
        if (!addOn) return null;
        const option = addOnOptions[id];
        return `Care option: ${getServiceDisplayName(addOn.id, addOn.name)}${option ? ` · ${option}` : ""}`;
      }),
      `Address: ${formatServiceAddress(address)}`,
      `Travel: ${travelQuote.distanceMiles} mi · Fee $${travelQuote.fee}`,
      `Date: ${appointmentDate}`,
      `Time: ${appointmentTime}`,
      `Estimated service: From ${formatPrice(estimatedTotal)}`,
      "",
      newClientDepositNotice,
    ]
      .filter(Boolean)
      .join("\n"),
  )}`;

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

      <a
        href={mailtoHref}
        onClick={onReserved}
        className={`${bookingPrimaryBtnClass} mt-8`}
      >
        Reserve Appointment
      </a>

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
}: {
  pet: PetProfile;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  address: ServiceAddress;
}) {
  return (
    <section className="text-center">
      <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Your Appointment Is Reserved
      </p>
      <h2 className="font-display mt-5 text-4xl text-ink md:text-5xl">
        We Look Forward
        <br />
        to Welcoming {pet.name}.
      </h2>

      <div className={`${bookingNoticeClass} mx-auto mt-10 max-w-lg text-left`}>
        <p className="text-sm text-ink">{serviceName}</p>
        <p className="mt-3 text-sm text-taupe">
          {appointmentDate} · {appointmentTime}
        </p>
        <p className="mt-2 text-sm text-taupe">
          {formatServiceAddress(address)}
        </p>
        <p className="mt-6 text-xs text-taupe">
          Your appointment has been reserved exclusively for {pet.name}.
        </p>
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
