"use client";

import { Elements } from "@stripe/react-stripe-js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/business";
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
import type { TimePreference } from "@/lib/booking-schedule";
import { createCustomerAppointment } from "@/lib/appointments/client";
import { createPaymentSetupIntent, fetchCustomerPaymentMethods } from "@/lib/payments/client";
import {
  formatPaymentMethodLabel,
  type PaymentMethodRecord,
} from "@/lib/payments/types";
import {
  AddCardForm,
  stripePromiseFor,
} from "@/components/account/PaymentMethodsManager";
import { createClient } from "@/lib/supabase/client";
import { isValidSmsPhone } from "@/lib/sms/phone";
import {
  photoMarketingConsentCopy,
  smsConsentCopy,
} from "@/lib/notifications";
import { vaccinationBookingNeedsAdminConfirmation } from "@/lib/vaccinations/booking";
import { CreativeBookingPolicy } from "@/components/booking/CreativeBookingPolicy";
import type { BookingPolicySectionId } from "@/components/booking/BookingPoliciesModal";
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
  timePreference?: TimePreference | null;
  onOpenPolicy: (section: BookingPolicySectionId) => void;
  onMakeChange: () => void;
  onReserved: (appointment: AppointmentRecord) => void;
  initialReferralCode?: string;
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

function PolicyTermButton({
  children,
  onOpen,
}: {
  children: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      className="underline decoration-champagne underline-offset-2 hover:text-deep-lavender"
    >
      {children}
    </button>
  );
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
  timePreference,
  onOpenPolicy,
  onMakeChange,
  onReserved,
  initialReferralCode = "",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const [referralStatus, setReferralStatus] = useState<
    "idle" | "valid" | "invalid"
  >("idle");
  const [showReferralHelp, setShowReferralHelp] = useState(
    Boolean(initialReferralCode.trim()),
  );

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
  const [phone, setPhone] = useState("");
  const [smsConsent, setSmsConsent] = useState(false);
  const [photoMarketingConsent, setPhotoMarketingConsent] = useState(false);
  const [servicePoliciesConsent, setServicePoliciesConsent] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRecord[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string | null>(
    null,
  );
  const [cardSetup, setCardSetup] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const serviceEstimate = getServicePriceEstimate(service, pet.weightLbs);
  const addOnTotal = estimateAddOnTotal(addOnIds, addOnOptions, pet.weightLbs);
  const serviceFrom = serviceEstimate?.from ?? 0;
  const estimatedTotal = serviceFrom + addOnTotal + travelQuote.fee;
  const creativePolicy = bookingIncludesCreativeColoring(addOnIds)
    ? getCreativeBookingPolicy()
    : undefined;
  const pendingVaccinationReview = vaccinationBookingNeedsAdminConfirmation(
    pet.vaccinationBookingStatus,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSavedDetails() {
      try {
        const [phoneResult, paymentResult] = await Promise.all([
          createClient().from("profiles").select("phone").maybeSingle(),
          fetchCustomerPaymentMethods(),
        ]);
        if (cancelled) return;
        if (phoneResult.data?.phone) {
          setPhone(phoneResult.data.phone);
        }
        setPaymentMethods(paymentResult.methods);
        const defaultMethod =
          paymentResult.methods.find((method) => method.isDefault) ??
          paymentResult.methods[0];
        if (defaultMethod) setSelectedPaymentMethodId(defaultMethod.id);
      } catch {
        // Profile phone and cards are confirmed before reserve.
      }
    }

    void loadSavedDetails();
    return () => {
      cancelled = true;
    };
  }, []);

  const stripePromise = useMemo(
    () => (cardSetup ? stripePromiseFor(cardSetup.publishableKey) : null),
    [cardSetup],
  );

  async function startAddCard() {
    setAddingCard(true);
    try {
      const next = await createPaymentSetupIntent();
      setCardSetup(next);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Card setup is not available yet.",
      );
      setAddingCard(false);
    }
  }

  function rememberCard(method: PaymentMethodRecord) {
    setPaymentMethods((current) => {
      if (current.some((item) => item.id === method.id)) {
        return current.map((item) => (item.id === method.id ? method : item));
      }
      return [...current, method];
    });
    setSelectedPaymentMethodId(method.id);
    setCardSetup(null);
    setAddingCard(false);
  }

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

    if (!photoMarketingConsent) {
      setError(
        "Please confirm you consent to photographing and filming your pet for marketing.",
      );
      return;
    }

    if (!servicePoliciesConsent) {
      setError(
        "Please confirm you have read and agree to the cancellation, rescheduling, payment, and incomplete service policies.",
      );
      return;
    }

    if (!selectedPaymentMethodId) {
      setError(
        "Please add a payment method to finish this reservation. You will not be charged when you book.",
      );
      if (!cardSetup && !addingCard) void startAddCard();
      return;
    }

    if (
      !timePreference ||
      travelQuote.lat == null ||
      travelQuote.lon == null
    ) {
      setError(
        "Please go back and confirm your address and appointment date.",
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
        timePreference: timePreference ?? undefined,
        addressLat: travelQuote.lat,
        addressLon: travelQuote.lon,
        estimatedTotal,
        paymentMethodId: selectedPaymentMethodId,
        customerPhone: phone,
        smsConsent: true,
        photoMarketingConsent: true,
        servicePoliciesConsent: true,
        referralCode: referralCode.trim() || undefined,
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
          <p className="font-body mt-2 text-xs text-taupe">
            Arrival window assigned to fit that day&apos;s route.
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
          <p className="font-body mt-4 text-xs leading-relaxed text-taupe">
            You will not be charged when you book. Payment is settled after your
            appointment. Late cancellations and no-shows may be charged to the
            card you select below.
          </p>
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
          onBlur={() => {
            const code = referralCode.trim();
            if (!code) {
              setReferralStatus("idle");
              return;
            }
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
                  setError(null);
                  return;
                }
                setReferralStatus("invalid");
                if (body.message) setError(body.message);
              })
              .catch(() => {
                setReferralStatus("idle");
              });
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
        <button
          type="button"
          onClick={() => setShowReferralHelp((open) => !open)}
          className={bookingBackLinkClass}
        >
          How Referral Rewards Work
        </button>
        {showReferralHelp ? (
          <div className="font-body space-y-2 text-sm leading-relaxed text-taupe">
            <p>
              New client households receive 10% off eligible service charges on
              their first completed appointment.
            </p>
            <p>
              After the appointment is completed and paid, the referring client
              receives an equal amount in Referral Credit.
            </p>
            <Link href="/referrals" className="text-ink underline">
              View full Referral Rewards rules
            </Link>
          </div>
        ) : null}
      </div>

      <div className={`${bookingNoticeClass} mt-6 space-y-4`}>
        <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
          Payment Method for This Appointment
        </p>
        {paymentMethods.length === 0 && !cardSetup ? (
          <div>
            <p className="font-body text-sm leading-relaxed text-taupe">
              Add a valid card to complete this reservation. You will not be
              charged when you book — payment is settled after your
              appointment.
            </p>
            <button
              type="button"
              onClick={() => void startAddCard()}
              disabled={addingCard}
              className={`${bookingSecondaryBtnClass} mt-4 inline-flex`}
            >
              {addingCard ? "Preparing…" : "Add a payment method"}
            </button>
          </div>
        ) : (
          <ul className="space-y-3">
            {paymentMethods.map((method) => {
              const checked = selectedPaymentMethodId === method.id;
              return (
                <li key={method.id}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => setSelectedPaymentMethodId(method.id)}
                      className="mt-0.5 size-4 shrink-0 accent-deep-lavender"
                    />
                    <span className="font-body text-sm text-ink">
                      {formatPaymentMethodLabel(method)}
                      {method.isDefault ? " · Default" : ""}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {cardSetup && stripePromise ? (
          <div className="border-t border-gray-line/70 pt-4">
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: cardSetup.clientSecret,
                locale: "en",
                appearance: { theme: "stripe" },
              }}
            >
              <AddCardForm
                clientSecret={cardSetup.clientSecret}
                returnUrl={
                  typeof window === "undefined"
                    ? undefined
                    : window.location.href
                }
                onSaved={rememberCard}
                onCancel={() => {
                  setCardSetup(null);
                  setAddingCard(false);
                }}
              />
            </Elements>
          </div>
        ) : paymentMethods.length > 0 ? (
          <button
            type="button"
            onClick={() => void startAddCard()}
            disabled={addingCard}
            className="font-body text-xs text-ink underline"
          >
            {addingCard ? "Preparing…" : "Use a different card"}
          </button>
        ) : null}
      </div>

      {creativePolicy && (
        <CreativeBookingPolicy policy={creativePolicy} className="mt-6" />
      )}

      {pendingVaccinationReview && (
        <p
          className="font-body mt-6 rounded-xl border border-champagne/50 bg-dusty-lavender/20 px-4 py-3 text-sm leading-relaxed text-ink"
          role="status"
        >
          {pet.name}&apos;s vaccination record is still under review. You can
          submit this appointment now. We will notify you once the vaccination
          record is reviewed and your appointment is confirmed.
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
            {smsConsentCopy} See our{" "}
            <Link
              href="/privacy"
              className="underline decoration-champagne underline-offset-2 hover:text-deep-lavender"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/terms"
              className="underline decoration-champagne underline-offset-2 hover:text-deep-lavender"
            >
              Terms
            </Link>
            .
          </span>
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={photoMarketingConsent}
            onChange={(event) =>
              setPhotoMarketingConsent(event.target.checked)
            }
            required
            aria-required="true"
            className="mt-0.5 size-4 shrink-0 accent-deep-lavender"
          />
          <span className="font-body text-xs leading-relaxed text-taupe">
            {photoMarketingConsentCopy}
          </span>
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={servicePoliciesConsent}
            onChange={(event) =>
              setServicePoliciesConsent(event.target.checked)
            }
            required
            aria-required="true"
            className="mt-0.5 size-4 shrink-0 accent-deep-lavender"
          />
          <span className="font-body text-xs leading-relaxed text-taupe">
            I have read and agree to the{" "}
            <PolicyTermButton onOpen={() => onOpenPolicy("cancellation")}>
              cancellation
            </PolicyTermButton>
            ,{" "}
            <PolicyTermButton onOpen={() => onOpenPolicy("rescheduling")}>
              rescheduling
            </PolicyTermButton>
            ,{" "}
            <PolicyTermButton onOpen={() => onOpenPolicy("payment")}>
              payment
            </PolicyTermButton>
            , and{" "}
            <PolicyTermButton onOpen={() => onOpenPolicy("incomplete-service")}>
              incomplete service
            </PolicyTermButton>{" "}
            policies.
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
            ? "Submit for Review"
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
  const pendingReview = appointmentStatus === "pending_confirmation";

  return (
    <section className="text-center">
      <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        {pendingReview
          ? "Vaccination Record Received"
          : "Your Appointment Is Confirmed"}
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
        <p className="mt-6 text-sm leading-relaxed text-taupe">
          {pendingReview
            ? "Your selected appointment is pending while we review your dog’s vaccination record. We will notify you as soon as your appointment is confirmed."
            : "Your appointment has been reserved. You can view the details at any time in your account."}
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
