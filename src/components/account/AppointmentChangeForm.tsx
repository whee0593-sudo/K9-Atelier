"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookingPoliciesModal } from "@/components/booking/BookingPoliciesModal";
import { DateTimeStep, type AvailabilityDay } from "@/components/booking/DateTimeStep";
import {
  bookingFieldClass,
  bookingLabelClass,
  bookingPrimaryBtnClass,
  bookingSecondaryBtnClass,
} from "@/components/booking/booking-ui";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  changeFeeAmount,
  changeFeeWarning,
  changeNoticeBand,
  type AppointmentChangeAction,
} from "@/lib/appointments/change-policy";
import { formatPrice } from "@/lib/business";
import type { TimePreference } from "@/lib/booking-schedule";
import { useCustomerPets } from "@/lib/pets/use-customer-pets";
import { allBookableServices, formatServicePrice, getBookableServicesForPet } from "@/lib/services";
import { formatServiceAddress } from "@/lib/travel";
import { vaccinationReadyToBook } from "@/lib/vaccinations/booking";
import { buildPreviewOnTheWayAppointments } from "@/lib/appointments/calendar-preview";

type VisitContext = {
  lat: number | null;
  lon: number | null;
  zip: string;
  serviceId: string;
  addOnIds: string[];
};

function formatShortDate(iso: string): string {
  const date = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const ACTION_LABELS: Record<AppointmentChangeAction, string> = {
  reschedule: "Reschedule",
  cancel: "Cancel visit",
  add_dog: "Add a dog",
  remove_dog: "Remove a dog",
};

export function AppointmentChangeForm({
  appointmentId,
  preview = false,
}: {
  appointmentId: string;
  preview?: boolean;
}) {
  const { pets } = useCustomerPets();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [visit, setVisit] = useState<VisitContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<AppointmentChangeAction | null>(null);
  const [removeId, setRemoveId] = useState<string>("");
  const [addPetId, setAddPetId] = useState("");
  const [addServiceId, setAddServiceId] = useState("");
  const [nextDate, setNextDate] = useState<string | null>(null);
  const [nextPreference, setNextPreference] = useState<TimePreference | null>(
    null,
  );
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const policyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (preview) {
      const samples = buildPreviewOnTheWayAppointments();
      setAppointments(samples);
      setVisit({
        lat: 26.823,
        lon: -80.138,
        zip: samples[0]?.addressZip ?? "33418",
        serviceId: samples[0]?.serviceId ?? "signature-bath-care",
        addOnIds: [],
      });
      setRemoveId(samples[0]?.id ?? appointmentId);
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/appointments/${appointmentId}/change?action=cancel`,
          { credentials: "include" },
        );
        const body = (await response.json()) as {
          error?: string;
          appointments?: AppointmentRecord[];
          visit?: VisitContext;
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error ?? "Could not load this appointment.");
          return;
        }
        setAppointments(body.appointments ?? []);
        setVisit(body.visit ?? null);
        setRemoveId(appointmentId);
      } catch {
        if (!cancelled) setError("Could not load this appointment.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [appointmentId, preview]);

  useEffect(() => {
    if (action !== "reschedule" || !visit?.lat || !visit.lon) return;
    let cancelled = false;
    async function loadDays() {
      setAvailabilityLoading(true);
      try {
        const params = new URLSearchParams({
          lat: String(visit!.lat),
          lon: String(visit!.lon),
          zip: visit!.zip,
          serviceId: visit!.serviceId,
          weightLbs: "20",
          addOnIds: visit!.addOnIds.join(","),
        });
        const response = await fetch(`/api/booking/availability?${params}`, {
          credentials: "include",
        });
        const body = (await response.json()) as {
          error?: string;
          days?: AvailabilityDay[];
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error ?? "Could not load available dates.");
          return;
        }
        setDays(body.days ?? []);
      } catch {
        if (!cancelled) setError("Could not load available dates.");
      } finally {
        if (!cancelled) setAvailabilityLoading(false);
      }
    }
    void loadDays();
    return () => {
      cancelled = true;
    };
  }, [action, visit]);

  const first = appointments[0];
  const bookedPetIds = new Set(appointments.map((item) => item.petId));
  const addablePets = pets.filter(
    (pet) =>
      !bookedPetIds.has(pet.id) &&
      vaccinationReadyToBook(pet.vaccinationBookingStatus),
  );
  const selectedAddPet = addablePets.find((pet) => pet.id === addPetId) ?? null;
  const addServices = selectedAddPet
    ? getBookableServicesForPet(selectedAddPet.weightLbs, {
        includeMembersOnly: true,
      })
    : allBookableServices();

  const feeTargets =
    action === "remove_dog"
      ? appointments.filter((item) => item.id === removeId)
      : action === "add_dog" || !action
        ? []
        : appointments;
  const estimatedTotal = feeTargets.reduce(
    (sum, item) => sum + (item.estimatedTotal ?? 0),
    0,
  );
  const band = preview
    ? "late"
    : first
      ? changeNoticeBand(first.appointmentDate, first.scheduledStart)
      : "complimentary";
  const fee = action ? changeFeeAmount(action, estimatedTotal, band) : 0;

  const canConfirm = useMemo(() => {
    if (!action) return false;
    if (action === "reschedule") return Boolean(nextDate && nextPreference);
    if (action === "add_dog") return Boolean(addPetId && addServiceId);
    if (action === "remove_dog") {
      return appointments.length > 1 && Boolean(removeId);
    }
    return true;
  }, [
    action,
    addPetId,
    addServiceId,
    appointments.length,
    nextDate,
    nextPreference,
    removeId,
  ]);

  async function confirmChange() {
    if (!action) return;
    if (preview) {
      setDone(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/appointments/${appointmentId}/change`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            date: nextDate,
            timePreference: nextPreference,
            petId: addPetId,
            serviceId: addServiceId,
            removeAppointmentId: removeId,
          }),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not save this change.");
        return;
      }
      setDone(true);
    } catch {
      setError("Could not save this change.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-text-muted">Loading appointment…</p>;
  }

  if (!first) {
    return (
      <p className="text-sm text-text-muted">
        This appointment is no longer available to change.
      </p>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text">Your appointment has been updated.</p>
        <Link href="/account/appointments" className={bookingPrimaryBtnClass}>
          Back to appointments
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-lavender/30 bg-cream px-4 py-4">
        <p className="font-medium text-gold-dark">
          {formatShortDate(first.appointmentDate)} · {first.appointmentTime}
        </p>
        <p className="mt-1 text-sm text-text-muted">
          {formatServiceAddress({
            street: first.addressStreet,
            city: first.addressCity,
            state: first.addressState,
            zip: first.addressZip,
          })}
        </p>
        <ul className="mt-3 space-y-1 text-sm text-text">
          {appointments.map((item) => (
            <li key={item.id}>
              {item.petName} · {item.serviceName}
              {item.estimatedTotal != null
                ? ` · from ${formatPrice(item.estimatedTotal)}`
                : ""}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {(
          [
            "reschedule",
            "cancel",
            appointments.length > 1 ? "remove_dog" : null,
            "add_dog",
          ] as const
        )
          .filter((item): item is AppointmentChangeAction => Boolean(item))
          .map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setAction(item);
                setError(null);
                setNextDate(null);
                setNextPreference(null);
              }}
              className={
                action === item
                  ? `${bookingPrimaryBtnClass} !w-full sm:!w-full`
                  : `${bookingSecondaryBtnClass} w-full`
              }
            >
              {ACTION_LABELS[item]}
            </button>
          ))}
      </div>

      {action === "reschedule" && !nextDate ? (
        <DateTimeStep
          days={days}
          loading={availabilityLoading}
          error={error}
          onConfirmed={(date, preference) => {
            setNextDate(date);
            setNextPreference(preference);
            setError(null);
          }}
          onBack={() => setAction(null)}
        />
      ) : null}

      {action === "add_dog" ? (
        <div className="space-y-4">
          <label className="block">
            <span className={bookingLabelClass}>Dog to add</span>
            <select
              className={bookingFieldClass}
              value={addPetId}
              onChange={(event) => {
                setAddPetId(event.target.value);
                setAddServiceId("");
              }}
            >
              <option value="">Select a dog</option>
              {addablePets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>
          </label>
          {addablePets.length === 0 ? (
            <p className="text-sm text-text-muted">
              Add another dog in your pet profiles, with a current vaccine
              record, before attaching them to this visit.
            </p>
          ) : null}
          <label className="block">
            <span className={bookingLabelClass}>Service</span>
            <select
              className={bookingFieldClass}
              value={addServiceId}
              onChange={(event) => setAddServiceId(event.target.value)}
              disabled={!selectedAddPet}
            >
              <option value="">Select a service</option>
              {addServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                  {selectedAddPet
                    ? ` · ${formatServicePrice(service, selectedAddPet.weightLbs)}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {action === "remove_dog" ? (
        <label className="block">
          <span className={bookingLabelClass}>Dog to remove</span>
          <select
            className={bookingFieldClass}
            value={removeId}
            onChange={(event) => setRemoveId(event.target.value)}
          >
            {appointments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.petName} · {item.serviceName}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {action && (action !== "reschedule" || nextDate) ? (
        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 text-center">
          {action === "reschedule" && nextDate ? (
            <p className="text-sm text-text">
              New time: {formatShortDate(nextDate)}
              {nextPreference ? ` · ${nextPreference}` : ""}
            </p>
          ) : null}
          {fee > 0 ? (
            <p className="text-sm font-medium text-gold-dark">
              {changeFeeWarning(fee)}
            </p>
          ) : (
            <p className="text-sm text-text-muted">
              This change does not include a cancellation fee.
              {action === "add_dog"
                ? " Adding another pet is subject to availability and is not confirmed automatically. We’ll review the day’s schedule and email you once the change has been confirmed."
                : ""}
            </p>
          )}
          <button
            ref={policyRef}
            type="button"
            onClick={() => setPoliciesOpen(true)}
            className="text-sm font-medium text-gold-dark underline"
          >
            Cancellation &amp; Rescheduling Policy
          </button>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="button"
            disabled={!canConfirm || busy}
            onClick={() => void confirmChange()}
            className={`${bookingPrimaryBtnClass} !w-full sm:!w-full`}
          >
            {busy ? "Saving…" : "Confirm"}
          </button>
        </div>
      ) : error && action !== "reschedule" ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : null}

      <BookingPoliciesModal
        open={policiesOpen}
        onClose={() => setPoliciesOpen(false)}
        returnFocusRef={policyRef}
        initialSection="cancellation"
      />
    </div>
  );
}
