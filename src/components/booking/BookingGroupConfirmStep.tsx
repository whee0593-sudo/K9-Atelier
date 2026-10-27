"use client";

import { useRef, useState } from "react";
import type { BookingDogService } from "@/lib/booking/dogs";
import type { BookingOwnerDetails } from "@/components/booking/BookingOwnerStep";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  formatPaymentMethodLabel,
  type PaymentMethodRecord,
} from "@/lib/payments/types";
import {
  formatBookingDate,
  quoteGuestBooking,
  type BookingPriceQuote,
} from "@/lib/booking-price";
import { isPersistedPetId } from "@/lib/booking-flow";
import { createCustomerPet } from "@/lib/pets/client";
import { mapPetProfileToWriteInput } from "@/lib/pets/map";
import { formatPrice } from "@/lib/business";
import {
  formatServiceAddress,
  type ServiceAddress,
  type TravelQuote,
} from "@/lib/travel";
import { BookingReviewQuote } from "@/components/booking/BookingReviewQuote";
import {
  bookingBackLinkClass,
  bookingFieldClass,
  bookingLabelClass,
  bookingNoticeClass,
  bookingPrimaryBtnClass,
} from "@/components/booking/booking-ui";

type Props = {
  dogs: BookingDogService[];
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
  onDogsSaved: (dogs: BookingDogService[]) => void;
  onReserved: (
    appointment: AppointmentRecord,
    dogs: BookingDogService[],
  ) => void;
};

export function BookingGroupConfirmStep(props: Props) {
  const { dogs, address, travelQuote, owner, paymentMethod } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverQuotes, setServerQuotes] = useState<BookingPriceQuote[] | null>(
    null,
  );
  const [referralCode, setReferralCode] = useState(
    props.initialReferralCode ?? "",
  );
  const pending = useRef(false);
  // Retain saved IDs across failed submissions and lost responses.
  const savedDogs = useRef([...dogs]);
  const quotes =
    serverQuotes ??
    dogs.map((dog, index) => {
      const result = quoteGuestBooking({
        serviceId: dog.service.id,
        weightLbs: dog.pet.weightLbs ?? 0,
        addOnIds: dog.addOnIds,
        addOnOptions: dog.addOnOptions,
        distanceMiles: index === 0 ? travelQuote.distanceMiles : 0,
      });
      return result.ok ? result.quote : null;
    });
  const ready = quotes.every((quote) => quote !== null);

  async function confirm() {
    if (pending.current || !ready || !props.idempotencyKey) return;
    pending.current = true;
    setLoading(true);
    setError(null);
    try {
      for (const [index, dog] of savedDogs.current.entries()) {
        if (!isPersistedPetId(dog.pet.id)) {
          const pet = await createCustomerPet(
            mapPetProfileToWriteInput(dog.pet),
          );
          savedDogs.current[index] = { ...dog, pet };
          props.onDogsSaved([...savedDogs.current]);
        }
      }
      const response = await fetch("/api/booking/group", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dogs: savedDogs.current.map((dog, index) => ({
            petId: dog.pet.id,
            serviceId: dog.service.id,
            serviceName: dog.service.name,
            addOnIds: dog.addOnIds,
            addOnOptions: dog.addOnOptions,
            spaGoals: dog.spaGoals,
            estimatedTotal: quotes[index]?.estimatedTotal,
          })),
          address,
          appointmentDate: props.appointmentDate,
          appointmentTime: props.appointmentTime,
          slotStartMinutes: props.slotStartMinutes,
          addressLat: travelQuote.lat,
          addressLon: travelQuote.lon,
          travelDistanceMiles: travelQuote.distanceMiles,
          travelFee: travelQuote.fee,
          paymentMethodId: paymentMethod.id,
          customerPhone: owner.phone,
          customerFirstName: owner.firstName,
          customerLastName: owner.lastName,
          idempotencyKey: props.idempotencyKey,
          referralCode: referralCode.trim() || undefined,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        appointment?: AppointmentRecord;
        quotes?: BookingPriceQuote[];
      };
      if (!response.ok || !body.appointment) {
        if (body.quotes?.length === dogs.length) setServerQuotes(body.quotes);
        throw new Error(
          body.error ?? "Could not confirm your visit. Please try again.",
        );
      }
      props.onReserved(body.appointment, savedDogs.current);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not confirm your visit. Please try again.",
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <section aria-busy={loading}>
      <button
        type="button"
        disabled={loading}
        onClick={props.onBack}
        className={bookingBackLinkClass}
      >
        ← Back
      </button>
      <h2 className="font-display mt-8 text-3xl text-ink md:text-4xl">
        Review &amp; Confirm
      </h2>
      <p className="font-body mt-4 text-sm text-taupe">
        One visit for {dogs.length} dogs. Please review each dog&apos;s care
        below.
      </p>
      <div
        className={`${bookingNoticeClass} mt-8 space-y-3 font-body text-sm text-ink`}
      >
        <p>
          {owner.firstName} {owner.lastName} · {owner.email} · {owner.phone}
        </p>
        <p>
          {formatBookingDate(props.appointmentDate)} · {props.appointmentTime}
        </p>
        <p>{formatServiceAddress(address)}</p>
        <p>
          Payment method: {formatPaymentMethodLabel(paymentMethod)}. No charge
          today.
        </p>
      </div>
      <div className="mt-6 space-y-6">
        {dogs.map((dog, index) => (
          <article
            key={dog.pet.id}
            className={`${bookingNoticeClass} space-y-4`}
          >
            <h3 className="font-display text-2xl text-ink">
              {index + 1}. {dog.pet.name}
            </h3>
            <p className="font-body text-sm text-taupe">
              {dog.pet.breed} · {dog.pet.weightLbs} lbs
            </p>
            {quotes[index] ? (
              <BookingReviewQuote quote={quotes[index]} />
            ) : (
              <p role="alert">
                Please check this dog&apos;s service and weight.
              </p>
            )}
          </article>
        ))}
      </div>
      {ready ? (
        <p className="font-body mt-6 text-lg text-ink">
          Estimated visit total: From{" "}
          {formatPrice(
            quotes.reduce(
              (total, quote) => total + (quote?.estimatedTotal ?? 0),
              0,
            ),
          )}
          . Travel is included once per visit.
        </p>
      ) : null}
      <label
        className={`${bookingLabelClass} mt-6`}
        htmlFor="group-referral-code"
      >
        Referral code (optional)
      </label>
      <input
        id="group-referral-code"
        className={bookingFieldClass}
        value={referralCode}
        onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
        disabled={loading}
      />
      {error ? (
        <p className="font-body mt-6 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={loading || !ready || !props.idempotencyKey}
        onClick={() => void confirm()}
        className={`${bookingPrimaryBtnClass} mt-8`}
      >
        {loading ? "Confirming…" : "Confirm & Submit Booking"}
      </button>
    </section>
  );
}
