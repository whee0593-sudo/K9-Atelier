"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StaffBookingDatePicker } from "@/components/admin/StaffBookingDatePicker";
import { formatHourLabel } from "@/lib/appointments/closures";
import { formatPrice } from "@/lib/business";
import {
  allBookableServices,
  estimateServiceDurationMinutes,
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
  mode: "invite" | "booking";
  confirmUrl: string;
  emailed: boolean;
  texted: boolean;
  createdAccount: boolean;
  email: string;
  firstName: string;
  serviceName: string | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
};

type PetDraft = {
  key: string;
  name: string;
  breed: string;
  weightLbs: string;
};

function createPetDraft(): PetDraft {
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `pet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return { key, name: "", breed: "", weightLbs: "" };
}

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
  const [notifyEmail, setNotifyEmail] = useState(Boolean(prefill?.email));
  const [notifySms, setNotifySms] = useState(Boolean(prefill?.phone) || !prefill?.email);
  const [pets, setPets] = useState<PetDraft[]>(() => [createPetDraft()]);
  const [serviceId, setServiceId] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
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

  const petWeights = useMemo(
    () =>
      pets
        .map((pet) => Number(pet.weightLbs))
        .filter((weight) => Number.isFinite(weight) && weight > 0),
    [pets],
  );
  const primaryWeightLbs = petWeights[0] ?? Number.NaN;
  const services = useMemo(
    () =>
      allBookableServices().filter(
        (service) =>
          service.bookableAsPrimary &&
          (petWeights.length === 0 ||
            petWeights.every((weight) =>
              isServiceAvailableForPet(service.id, weight),
            )),
      ),
    [petWeights],
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

  const estimatedServiceTotal =
    selectedService && petWeights.length === pets.length
      ? petWeights.reduce((sum, weight) => {
          const estimate = getServicePriceEstimate(selectedService, weight);
          return sum + (estimate?.from ?? 0);
        }, 0)
      : null;
  const estimatedTotal =
    estimatedServiceTotal != null && quoteState.status === "ready"
      ? Math.round((estimatedServiceTotal + quoteState.quote.fee) * 100) / 100
      : null;
  const totalDurationMinutes =
    selectedService && petWeights.length === pets.length
      ? petWeights.reduce(
          (sum, weight) =>
            sum + estimateServiceDurationMinutes(selectedService.id, weight),
          0,
        )
      : null;

  function updatePet(key: string, field: keyof Omit<PetDraft, "key">, value: string) {
    setPets((current) =>
      current.map((pet) =>
        pet.key === key ? { ...pet, [field]: value } : pet,
      ),
    );
  }

  function addPetRow() {
    setPets((current) => [...current, createPetDraft()]);
  }

  function removePetRow(key: string) {
    setPets((current) =>
      current.length <= 1 ? current : current.filter((pet) => pet.key !== key),
    );
  }

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
    if (!appointmentDate || !slotStartMinutes) return;
    if (openSlots.some((slot) => String(slot) === slotStartMinutes)) return;
    setSlotStartMinutes("");
  }, [appointmentDate, openSlots, slotStartMinutes]);

  useEffect(() => {
    if (preview) return;
    if (
      quoteLat == null ||
      quoteLon == null ||
      !serviceId ||
      petWeights.length !== pets.length ||
      totalDurationMinutes == null ||
      totalDurationMinutes <= 0
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
          weightLbs: String(primaryWeightLbs),
          durationMinutes: String(totalDurationMinutes),
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
  }, [
    preview,
    quoteLat,
    quoteLon,
    serviceId,
    petWeights,
    pets.length,
    primaryWeightLbs,
    totalDurationMinutes,
    zip,
  ]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setCopied(false);

    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedEmail && !trimmedPhone) {
      setError("Enter a customer email or mobile phone number.");
      return;
    }

    const filledPets = pets
      .map((pet) => ({
        name: pet.name.trim(),
        breed: pet.breed.trim(),
        weightLbs: Number(pet.weightLbs),
      }))
      .filter(
        (pet) =>
          pet.name ||
          pet.breed ||
          (Number.isFinite(pet.weightLbs) && pet.weightLbs > 0),
      );

    if (preview) {
      const inviteOnly = filledPets.length === 0 || !serviceId || !appointmentDate || !slotStartMinutes;
      setSuccess({
        mode: inviteOnly ? "invite" : "booking",
        confirmUrl: inviteOnly
          ? "https://k9atelier.com/book"
          : "https://k9atelier.com/confirm-account?token=preview",
        emailed: notifyEmail && Boolean(trimmedEmail),
        texted: notifySms && Boolean(trimmedPhone),
        createdAccount: Boolean(trimmedEmail),
        email: trimmedEmail,
        firstName,
        serviceName: selectedService?.name ?? null,
        appointmentDate: appointmentDate || null,
        appointmentTime: slotStartMinutes
          ? formatHourLabel(Math.floor(Number(slotStartMinutes) / 60))
          : null,
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
          email: trimmedEmail,
          phone: trimmedPhone,
          notifyEmail,
          notifySms,
          verbalConsent,
          pets: filledPets,
          serviceId: serviceId || undefined,
          appointmentDate: appointmentDate || undefined,
          slotStartMinutes: slotStartMinutes
            ? Number(slotStartMinutes)
            : undefined,
          address:
            street.trim() || city.trim() || state.trim() || zip.trim()
              ? { street, city, state, zip }
              : undefined,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        mode?: "invite" | "booking";
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
        } | null;
      };
      if (!response.ok || !body.confirmUrl || !body.customer) {
        throw new Error(body.error ?? "Could not send this booking link.");
      }
      setSuccess({
        mode: body.mode === "booking" ? "booking" : "invite",
        confirmUrl: body.confirmUrl,
        emailed: body.emailed === true,
        texted: body.texted === true,
        createdAccount: body.customer.createdAccount,
        email: body.customer.email,
        firstName: body.customer.firstName,
        serviceName: body.appointment?.serviceName ?? null,
        appointmentDate: body.appointment?.appointmentDate ?? null,
        appointmentTime: body.appointment?.appointmentTime ?? null,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Could not send this booking link.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    const displayName = success.firstName.trim() || "the customer";
    return (
      <div className="rounded-2xl border border-lavender/30 bg-cream p-6">
        <h3 className="font-medium text-gold-dark">
          {success.mode === "invite" ? "Booking link ready" : "Confirmation link ready"}
        </h3>
        <p className="mt-2 text-sm text-text">
          {success.mode === "invite"
            ? success.createdAccount
              ? `A customer account was started for ${displayName}. They can finish the required booking details from the link.`
              : `${displayName} can finish the required booking details from the link.`
            : success.createdAccount
              ? `A customer account was created for ${displayName}.`
              : `This booking was added to ${displayName}'s existing account.`}
        </p>
        {success.mode === "booking" &&
        success.serviceName &&
        success.appointmentDate &&
        success.appointmentTime ? (
          <p className="mt-2 text-sm text-text-muted">
            {success.serviceName} on {success.appointmentDate} ·{" "}
            {success.appointmentTime}
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-muted">
            The customer completes dog details, service, address, and schedule
            online.
          </p>
        )}
        <p className="mt-3 text-sm text-text-muted">
          {success.emailed
            ? `Email sent${success.email ? ` to ${success.email}` : ""}. `
            : "Email was not sent. "}
          {success.texted
            ? "A text was sent to their phone."
            : "A text was not sent."}
        </p>
        <label className={`${labelClass} mt-5`} htmlFor="confirm-url">
          {success.mode === "invite"
            ? "Customer booking link"
            : "Customer confirmation link"}
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
      <p className="text-sm text-text-muted">
        Only an email or mobile phone is required. Leave other fields blank and
        the customer can finish them from the booking link.
      </p>

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
            onChange={(event) => {
              setEmail(event.target.value);
              if (event.target.value.trim()) setNotifyEmail(true);
            }}
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
            onChange={(event) => {
              setPhone(event.target.value);
              if (event.target.value.trim()) setNotifySms(true);
            }}
          />
          <p className="mt-1 text-xs text-text-muted">
            Provide email or phone (at least one).
          </p>
        </div>
      </section>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text">
          Send booking link
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

      <section className="space-y-4">
        {pets.map((pet, index) => {
          const nameId = `pet-name-${pet.key}`;
          const breedId = `pet-breed-${pet.key}`;
          const weightId = `pet-weight-${pet.key}`;
          return (
            <div key={pet.key} className="space-y-2">
              {pets.length > 1 ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-text-muted">
                    Dog {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => removePetRow(pet.key)}
                    className="text-sm text-text-muted hover:text-text"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className={labelClass} htmlFor={nameId}>
                    Dog name
                  </label>
                  <input
                    id={nameId}
                    className={fieldClass}
                    value={pet.name}
                    onChange={(event) =>
                      updatePet(pet.key, "name", event.target.value)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={breedId}>
                    Breed
                  </label>
                  <input
                    id={breedId}
                    className={fieldClass}
                    value={pet.breed}
                    onChange={(event) =>
                      updatePet(pet.key, "breed", event.target.value)
                    }
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor={weightId}>
                    Weight (lbs)
                  </label>
                  <input
                    id={weightId}
                    type="number"
                    min="0.1"
                    step="0.1"
                    className={fieldClass}
                    value={pet.weightLbs}
                    onChange={(event) =>
                      updatePet(pet.key, "weightLbs", event.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
        <div>
          <button
            type="button"
            onClick={addPetRow}
            className="rounded-xl border border-lavender/40 px-4 py-2 text-sm text-text hover:border-gold/40"
          >
            Add
          </button>
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
        {estimatedTotal != null ? (
          <div className="text-sm text-text-muted">
            <p>Estimated total: from {formatPrice(estimatedTotal)}</p>
          </div>
        ) : null}
      </section>

      <label className="flex items-start gap-2 text-sm text-text">
        <input
          type="checkbox"
          className="mt-1"
          checked={verbalConsent}
          onChange={(event) => setVerbalConsent(event.target.checked)}
        />
        The customer agreed by phone or in person to the cancellation, payment,
        photo, and text-message policies, and to receive this booking link.
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
          {submitting ? "Sending…" : "Send booking link"}
        </button>
        <Link href="/admin/pets" className="text-sm text-gold-dark hover:underline">
          Back to customers
        </Link>
      </div>
    </form>
  );
}
