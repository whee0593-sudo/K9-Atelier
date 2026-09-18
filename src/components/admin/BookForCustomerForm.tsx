"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StaffBookingDatePicker } from "@/components/admin/StaffBookingDatePicker";
import { formatHourLabel } from "@/lib/appointments/closures";
import { formatPrice } from "@/lib/business";
import {
  allBookableServices,
  getServicePriceEstimate,
  isServiceAvailableForPet,
} from "@/lib/services";
import {
  fallbackStaffScheduleDays,
  selectableStaffDays,
  slotsForStaffDate,
  staffScheduleHint,
} from "@/lib/staff/book-for-customer-schedule";
import type { TravelQuote } from "@/lib/travel";

type Prefill = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
};

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; quote: TravelQuote & { lat: number; lon: number } }
  | { status: "error"; message: string };

type AvailabilityDay = {
  date: string;
  available: boolean;
  slots: number[];
};

type SuccessState = {
  confirmUrl: string;
  emailed: boolean;
  texted: boolean;
  createdAccount: boolean;
  email: string;
  firstName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
};

const fieldClass =
  "mt-1 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text";
const labelClass = "block text-sm font-medium text-text";

export function BookForCustomerForm({
  prefill,
  preview = false,
}: {
  prefill?: Prefill;
  preview?: boolean;
}) {
  const [firstName, setFirstName] = useState(prefill?.firstName ?? "");
  const [lastName, setLastName] = useState(prefill?.lastName ?? "");
  const [email, setEmail] = useState(prefill?.email ?? "");
  const [phone, setPhone] = useState(prefill?.phone ?? "");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [petName, setPetName] = useState("");
  const [petBreed, setPetBreed] = useState("");
  const [petWeight, setPetWeight] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("FL");
  const [zip, setZip] = useState("");
  const [quoteState, setQuoteState] = useState<QuoteState>({ status: "idle" });
  const [days, setDays] = useState<AvailabilityDay[]>(() =>
    fallbackStaffScheduleDays(),
  );
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityLoaded, setAvailabilityLoaded] = useState(preview);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [slotStartMinutes, setSlotStartMinutes] = useState("");
  const [verbalConsent, setVerbalConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [copied, setCopied] = useState(false);

  const weightLbs = Number(petWeight);
  const services = useMemo(
    () =>
      allBookableServices().filter(
        (service) =>
          service.bookableAsPrimary &&
          (!Number.isFinite(weightLbs) ||
            isServiceAvailableForPet(service.id, weightLbs)),
      ),
    [weightLbs],
  );

  const selectedService = services.find((service) => service.id === serviceId);
  const openDays = useMemo(() => selectableStaffDays(days), [days]);
  const openSlots = useMemo(
    () => slotsForStaffDate(days, appointmentDate),
    [days, appointmentDate],
  );
  const quoteReady = quoteState.status === "ready";
  const quoteLat = quoteReady ? quoteState.quote.lat : null;
  const quoteLon = quoteReady ? quoteState.quote.lon : null;
  const scheduleHint = staffScheduleHint({
    quoteReady: preview || quoteReady,
    hasService: preview || Boolean(serviceId),
    loading: availabilityLoading,
    error: availabilityError,
    daysLoaded: preview || availabilityLoaded,
    selectedDate: appointmentDate,
    availableDayCount: openDays.length,
    slotCount: openSlots.length,
  });

  const estimate =
    selectedService && Number.isFinite(weightLbs)
      ? getServicePriceEstimate(selectedService, weightLbs)
      : null;
  const estimatedTotal =
    estimate && quoteState.status === "ready"
      ? Math.round((estimate.from + quoteState.quote.fee) * 100) / 100
      : null;

  async function handleQuote() {
    setError(null);
    setQuoteState({ status: "loading" });
    setDays(fallbackStaffScheduleDays());
    setAppointmentDate("");
    setSlotStartMinutes("");
    try {
      const response = await fetch("/api/travel-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ street, city, state, zip }),
      });
      const body = (await response.json()) as {
        error?: string;
        quote?: TravelQuote & { lat: number; lon: number };
      };
      if (!response.ok || !body.quote) {
        setQuoteState({
          status: "error",
          message: body.error ?? "Could not check that address.",
        });
        return;
      }
      if (!body.quote.withinServiceArea) {
        setQuoteState({ status: "error", message: body.quote.summary });
        return;
      }
      setQuoteState({ status: "ready", quote: body.quote });
    } catch {
      setQuoteState({
        status: "error",
        message: "Could not check that address.",
      });
    }
  }

  useEffect(() => {
    if (!appointmentDate) return;
    if (openDays.some((day) => day.date === appointmentDate)) return;
    setAppointmentDate("");
    setSlotStartMinutes("");
  }, [appointmentDate, openDays]);

  useEffect(() => {
    if (preview) return;
    if (
      quoteLat == null ||
      quoteLon == null ||
      !serviceId ||
      !Number.isFinite(weightLbs) ||
      weightLbs <= 0
    ) {
      setAvailabilityLoading(false);
      setAvailabilityLoaded(false);
      setAvailabilityError(null);
      setDays(fallbackStaffScheduleDays());
      return;
    }

    const controller = new AbortController();
    setAvailabilityLoading(true);
    setAvailabilityError(null);

    async function loadDays() {
      try {
        const params = new URLSearchParams({
          lat: String(quoteLat),
          lon: String(quoteLon),
          zip,
          serviceId,
          weightLbs: String(weightLbs),
        });
        const response = await fetch(`/api/booking/availability?${params}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          error?: string;
          days?: AvailabilityDay[];
        };
        if (!response.ok || !body.days) {
          setDays(fallbackStaffScheduleDays());
          setAvailabilityLoaded(true);
          return;
        }
        setDays(body.days);
        setAvailabilityLoaded(true);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Book for customer availability failed:", error);
        setDays(fallbackStaffScheduleDays());
        setAvailabilityLoaded(true);
      } finally {
        if (!controller.signal.aborted) {
          setAvailabilityLoading(false);
        }
      }
    }

    void loadDays();
    return () => controller.abort();
  }, [preview, quoteLat, quoteLon, serviceId, weightLbs, zip]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setCopied(false);

    if (preview) {
      setSuccess({
        confirmUrl: "https://k9atelier.com/confirm-account?token=preview",
        emailed: notifyEmail,
        texted: notifySms,
        createdAccount: true,
        email,
        firstName,
        serviceName: selectedService?.name ?? "Grooming",
        appointmentDate,
        appointmentTime: slotStartMinutes
          ? formatHourLabel(Math.floor(Number(slotStartMinutes) / 60))
          : "9:00 AM",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/customer-bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          notifyEmail,
          notifySms,
          verbalConsent,
          pet: {
            name: petName,
            breed: petBreed,
            weightLbs,
          },
          serviceId,
          appointmentDate,
          slotStartMinutes: Number(slotStartMinutes),
          address: { street, city, state, zip },
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        confirmUrl?: string;
        emailed?: boolean;
        texted?: boolean;
        customer?: {
          email: string;
          firstName: string;
          createdAccount: boolean;
        };
        appointment?: {
          serviceName: string;
          appointmentDate: string;
          appointmentTime: string;
        };
      };
      if (!response.ok || !body.confirmUrl || !body.appointment || !body.customer) {
        throw new Error(body.error ?? "Could not create this booking.");
      }
      setSuccess({
        confirmUrl: body.confirmUrl,
        emailed: body.emailed === true,
        texted: body.texted === true,
        createdAccount: body.customer.createdAccount,
        email: body.customer.email,
        firstName: body.customer.firstName,
        serviceName: body.appointment.serviceName,
        appointmentDate: body.appointment.appointmentDate,
        appointmentTime: body.appointment.appointmentTime,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not create this booking.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-lavender/30 bg-cream p-6">
        <h3 className="font-medium text-gold-dark">Confirmation link ready</h3>
        <p className="mt-2 text-sm text-text">
          {success.createdAccount
            ? `A customer account was created for ${success.firstName}.`
            : `This booking was added to ${success.firstName}'s existing account.`}
        </p>
        <p className="mt-2 text-sm text-text-muted">
          {success.serviceName} on {success.appointmentDate} ·{" "}
          {success.appointmentTime}
        </p>
        <p className="mt-3 text-sm text-text-muted">
          {success.emailed
            ? `Email sent to ${success.email}. `
            : "Email was not sent. "}
          {success.texted
            ? "A text was sent to their phone."
            : "A text was not sent."}
        </p>
        <label className={`${labelClass} mt-5`} htmlFor="confirm-url">
          Customer confirmation link
        </label>
        <input
          id="confirm-url"
          readOnly
          value={success.confirmUrl}
          className={fieldClass}
        />
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white hover:bg-gold-dark"
            onClick={() => {
              void navigator.clipboard.writeText(success.confirmUrl);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-lavender/40 px-4 py-2 text-sm text-text-muted hover:text-text"
            onClick={() => setSuccess(null)}
          >
            Book another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-8 rounded-2xl border border-lavender/30 bg-cream p-6"
    >
      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="customer-first-name">
            First name
          </label>
          <input
            id="customer-first-name"
            className={fieldClass}
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="customer-last-name">
            Last name
          </label>
          <input
            id="customer-last-name"
            className={fieldClass}
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="customer-email">
            Email
          </label>
          <input
            id="customer-email"
            type="email"
            className={fieldClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="customer-phone">
            Mobile phone
          </label>
          <input
            id="customer-phone"
            type="tel"
            className={fieldClass}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </div>
      </section>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text">
          Send confirmation link
        </legend>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(event) => setNotifyEmail(event.target.checked)}
          />
          Email
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={notifySms}
            onChange={(event) => setNotifySms(event.target.checked)}
          />
          Text message
        </label>
      </fieldset>

      <section className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="pet-name">
            Dog name
          </label>
          <input
            id="pet-name"
            className={fieldClass}
            value={petName}
            onChange={(event) => setPetName(event.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="pet-breed">
            Breed
          </label>
          <input
            id="pet-breed"
            className={fieldClass}
            value={petBreed}
            onChange={(event) => setPetBreed(event.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="pet-weight">
            Weight (lbs)
          </label>
          <input
            id="pet-weight"
            type="number"
            min="0.1"
            step="0.1"
            className={fieldClass}
            value={petWeight}
            onChange={(event) => setPetWeight(event.target.value)}
            required
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="address-street">
            Street
          </label>
          <input
            id="address-street"
            className={fieldClass}
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            required
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="address-city">
            City
          </label>
          <input
            id="address-city"
            className={fieldClass}
            value={city}
            onChange={(event) => setCity(event.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass} htmlFor="address-state">
              State
            </label>
            <input
              id="address-state"
              className={fieldClass}
              value={state}
              onChange={(event) => setState(event.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="address-zip">
              ZIP
            </label>
            <input
              id="address-zip"
              className={fieldClass}
              value={zip}
              onChange={(event) => setZip(event.target.value)}
              required
            />
          </div>
        </div>
      </section>

      <div>
        <button
          type="button"
          onClick={() => void handleQuote()}
          className="rounded-xl border border-lavender/40 px-4 py-2 text-sm text-text hover:border-gold/40"
        >
          {quoteState.status === "loading" ? "Checking address…" : "Check service area"}
        </button>
        {quoteState.status === "ready" ? (
          <p className="mt-2 text-sm text-text-muted">{quoteState.quote.summary}</p>
        ) : null}
        {quoteState.status === "error" ? (
          <p className="mt-2 text-sm text-red-800" role="alert">
            {quoteState.message}
          </p>
        ) : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="service-id">
            Service
          </label>
          <select
            id="service-id"
            className={fieldClass}
            value={serviceId}
            onChange={(event) => {
              setServiceId(event.target.value);
              setAppointmentDate("");
              setSlotStartMinutes("");
            }}
            required
          >
            <option value="">Select a service</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="appointment-date">
            Date
          </label>
          <StaffBookingDatePicker
            id="appointment-date"
            value={appointmentDate}
            openDates={openDays.map((day) => day.date)}
            preview={preview}
            onChange={(date) => {
              setAppointmentDate(date);
              setSlotStartMinutes("");
            }}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="appointment-slot">
            Start time
          </label>
          <select
            id="appointment-slot"
            className={fieldClass}
            value={slotStartMinutes}
            onChange={(event) => setSlotStartMinutes(event.target.value)}
            disabled={availabilityLoading}
            required
          >
            <option value="">
              {availabilityLoading ? "Loading times…" : "Select a time"}
            </option>
            {openSlots.map((slot) => (
              <option key={slot} value={slot}>
                {formatHourLabel(Math.floor(slot / 60))}
              </option>
            ))}
          </select>
          {availabilityError ? (
            <p className="mt-2 text-sm text-red-800" role="alert">
              {availabilityError}
            </p>
          ) : null}
          {scheduleHint ? (
            <p className="mt-2 text-sm text-text-muted">{scheduleHint}</p>
          ) : null}
        </div>
        <div className="text-sm text-text-muted">
          {estimatedTotal != null ? (
            <p>Estimated total: from {formatPrice(estimatedTotal)}</p>
          ) : (
            <p>Estimate appears after address and service are set.</p>
          )}
        </div>
      </section>

      <label className="flex items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          className="mt-1"
          checked={verbalConsent}
          onChange={(event) => setVerbalConsent(event.target.checked)}
          required
        />
        The customer agreed by phone or in person to the cancellation, payment,
        photo, and text-message policies, and to receive this confirmation link.
      </label>

      {error ? (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl bg-gold px-6 py-2.5 text-sm font-medium text-white hover:bg-gold-dark disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create account and booking"}
        </button>
        <Link href="/admin/pets" className="text-sm text-gold-dark hover:underline">
          Back to customers
        </Link>
      </div>
    </form>
  );
}
