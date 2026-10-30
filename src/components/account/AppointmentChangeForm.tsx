"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { AppointmentAddDogForm } from "@/components/account/AppointmentAddDogForm";
import { getAddOnService } from "@/lib/services";
import { BookingExperienceStep } from "@/components/booking/BookingExperienceStep";
import { emptyBookingServiceSelection, quoteAddedDogServices, toggleBookingServiceSelection } from "@/lib/booking/service-selection";
import { getServiceDisplayName } from "@/lib/service-display";
import { formatServiceAddress } from "@/lib/travel";
import type { PetProfile } from "@/lib/pets";
import { bookingWeightLbs } from "@/lib/pets/weight";
import { buildPreviewOnTheWayAppointments } from "@/lib/appointments/calendar-preview";

type VisitContext = {
  lat: number | null;
  lon: number | null;
  zip: string;
  serviceId: string;
  addOnIds: string[];
};

type ChangeFeeQuote = {
  fee: number;
  needsPriceReview: boolean;
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
  const router = useRouter();
  const confirmingRef = useRef(false);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [visit, setVisit] = useState<VisitContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<AppointmentChangeAction | null>(null);
  const [removeId, setRemoveId] = useState<string>("");
  const [selectedAddPet, setSelectedAddPet] = useState<PetProfile | null>(null);
  const [editingAddPet, setEditingAddPet] = useState(false);
  const addPetId = selectedAddPet?.id ?? "";
  const [addSelection, setAddSelection] = useState(emptyBookingServiceSelection);
  const [servicePickerOpen, setServicePickerOpen] = useState(false);
  const addServiceId = addSelection.serviceId;
  const [nextDate, setNextDate] = useState<string | null>(null);
  const [nextSlotStartMinutes, setNextSlotStartMinutes] = useState<number | null>(
    null,
  );
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [policiesOpen, setPoliciesOpen] = useState(false);
  const [serverQuote, setServerQuote] = useState<ChangeFeeQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
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
          quote?: ChangeFeeQuote;
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error ?? "Could not load this appointment.");
          return;
        }
        setAppointments(body.appointments ?? []);
        setVisit(body.visit ?? null);
        setServerQuote(body.quote ?? null);
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
    if (preview || !action) return;
    const selectedAction = action;
    let cancelled = false;
    async function loadQuote() {
      setQuoteLoading(true);
      try {
        const params = new URLSearchParams({ action: selectedAction });
        if (selectedAction === "remove_dog" && removeId) {
          params.set("removeAppointmentId", removeId);
        }
        if (selectedAction === "reschedule" && nextDate && nextSlotStartMinutes != null) {
          params.set("date", nextDate);
          params.set("slotStartMinutes", String(nextSlotStartMinutes));
        }
        const response = await fetch(
          `/api/appointments/${appointmentId}/change?${params}`,
          { credentials: "include" },
        );
        const body = (await response.json()) as {
          error?: string;
          quote?: ChangeFeeQuote;
        };
        if (cancelled) return;
        if (!response.ok || !body.quote) {
          setServerQuote(null);
          setError(body.error ?? "Could not load the change fee.");
          return;
        }
        setServerQuote(body.quote);
      } catch {
        if (!cancelled) {
          setServerQuote(null);
          setError("Could not load the change fee.");
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }
    void loadQuote();
    return () => {
      cancelled = true;
    };
  }, [action, appointmentId, nextDate, nextSlotStartMinutes, preview, removeId]);

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
  const selectedAddWeight = selectedAddPet
    ? bookingWeightLbs(selectedAddPet.weightLbs)
    : null;
  const addQuote = selectedAddWeight != null && addServiceId
    ? quoteAddedDogServices(addSelection, selectedAddWeight, selectedAddPet?.fixedServicePrices) : null;
  const validAddService = Boolean(addQuote?.ok);
  const selectedIds = [...(addServiceId ? [addServiceId] : []), ...addSelection.addOnIds];
  const selectionLabel = selectedIds.map(id => {
    const service = getAddOnService(id);
    return addSelection.addOnOptions[id] ?? (service ? getServiceDisplayName(service.id, service.name) : id);
  }).join(" + ");

  const feeTargets =
    action === "remove_dog"
      ? appointments.filter((item) => item.id === removeId)
      : action === "add_dog" || !action
        ? []
        : appointments;
  const band = preview
    ? "late"
    : first
      ? changeNoticeBand(first.appointmentDate, first.scheduledStart)
      : "complimentary";
  const previewHasAddOns = feeTargets.some((item) => item.addOnIds.length > 0);
  const previewEstimate = feeTargets.reduce(
    (sum, item) => sum + (item.estimatedTotal ?? 0),
    0,
  );
  const needsPriceReview = preview
    ? previewHasAddOns
    : Boolean(serverQuote?.needsPriceReview);
  const fee = !action
    ? 0
    : preview
      ? previewHasAddOns
        ? 0
        : changeFeeAmount(action, previewEstimate, band)
      : quoteLoading
        ? 0
        : (serverQuote?.fee ?? 0);

  const canConfirm = useMemo(() => {
    if (!action || needsPriceReview) return false;
    if (!preview && (quoteLoading || !serverQuote)) return false;
    if (action === "reschedule") return Boolean(nextDate && nextSlotStartMinutes != null);
    if (action === "add_dog") return Boolean(addPetId && validAddService && !editingAddPet);
    if (action === "remove_dog") {
      return appointments.length > 1 && Boolean(removeId);
    }
    return true;
  }, [
    action,
    addPetId,
    addServiceId,
    validAddService,
    editingAddPet,
    appointments.length,
    needsPriceReview,
    nextDate,
    nextSlotStartMinutes,
    preview,
    quoteLoading,
    removeId,
    serverQuote,
  ]);

  async function confirmChange() {
    if (!action || !canConfirm || busy || confirmingRef.current) return;
    if (preview) {
      setDone(true);
      return;
    }
    setBusy(true);
    confirmingRef.current = true;
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
            slotStartMinutes: nextSlotStartMinutes,
            petId: addPetId,
            serviceId: addServiceId,
            addOnIds: addSelection.addOnIds,
            addOnOptions: addSelection.addOnOptions,
            removeAppointmentId: removeId,
            expectedAmount: serverQuote?.fee,
          }),
        },
      );
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not save this change.");
        return;
      }
      setDone(true);
      if (action === "add_dog") router.push(`/account/appointments/${appointmentId}/change-requested`);
    } catch {
      setError("Could not save this change.");
    } finally {
      confirmingRef.current = false;
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
        {action === "add_dog" ? <div className="space-y-3" role="status">
          <h3 className="text-xl font-semibold text-gold-dark">Thank you for letting us know!</h3>
          <p className="text-sm text-text">We’ll review the day’s schedule and text you once the change has been confirmed.</p>
        </div> : <p className="text-sm text-text">Your appointment has been updated.</p>}
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
              disabled={busy}
              onClick={() => {
                setAction(item);
                setServerQuote(null);
                setQuoteLoading(!preview);
                setError(null);
                setNextDate(null);
                setNextSlotStartMinutes(null);
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
          onConfirmed={(date, slotStartMinutes) => {
            setNextDate(date);
            setNextSlotStartMinutes(slotStartMinutes);
            setError(null);
          }}
          onBack={() => setAction(null)}
        />
      ) : null}

      <div hidden={action !== "add_dog"} className="space-y-4">
          <div>
            <p className={bookingLabelClass}>Dog to add</p>
            <AppointmentAddDogForm preview={preview} disabled={busy}
              onEditingChange={setEditingAddPet}
              onSaved={pet => {
                setSelectedAddPet(pet);
                const weight = bookingWeightLbs(pet.weightLbs);
                if (weight == null || (addServiceId && !quoteAddedDogServices(addSelection,weight,pet.fixedServicePrices).ok)) setAddSelection(emptyBookingServiceSelection());
              }} />
          </div>
          <div className="space-y-3">
            <p className={bookingLabelClass}>Service</p>
            <button type="button" aria-label="Choose services" aria-expanded={servicePickerOpen} aria-controls="add-dog-services"
              disabled={!selectedAddPet || editingAddPet || busy} onClick={() => setServicePickerOpen(current => !current)}
              className={`${bookingFieldClass} flex items-center justify-between gap-3 text-left disabled:opacity-60`}>
              <span>{selectionLabel || "Select services"}</span><span aria-hidden="true">{servicePickerOpen ? "−" : "+"}</span>
            </button>
            {servicePickerOpen && selectedAddPet ? <fieldset id="add-dog-services" disabled={editingAddPet || busy} className="disabled:opacity-60">
              <legend className="sr-only">Choose services for {selectedAddPet.name}</legend>
              <BookingExperienceStep embedded membersOnlyAllowed pet={selectedAddPet}
                selectedServiceId={addServiceId || null} selectedIds={selectedIds} selectedOptions={addSelection.addOnOptions}
                onSelect={(service,option) => setAddSelection(current => toggleBookingServiceSelection(current,service,option))}
                onContinue={() => {}} onBack={() => {}} />
            </fieldset> : null}
            {selectedIds.length && !addServiceId ? <p role="status" className="text-sm text-text-muted">Choose a primary bath or grooming service for these add-ons.</p> : null}
            {addQuote && !addQuote.ok ? <p role="alert" className="text-sm text-red-700">{addQuote.message}</p> : null}
          </div>
      </div>

      {action === "remove_dog" ? (
        <label className="block">
          <span className={bookingLabelClass}>Dog to remove</span>
          <select
            className={bookingFieldClass}
            value={removeId}
            onChange={(event) => {
              setRemoveId(event.target.value);
              setServerQuote(null);
              setQuoteLoading(!preview);
            }}
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
              {nextSlotStartMinutes != null
                ? ` · ${Math.floor(nextSlotStartMinutes / 60) % 12 || 12}:00 ${
                    nextSlotStartMinutes >= 12 * 60 ? "PM" : "AM"
                  }`
                : ""}
            </p>
          ) : null}
          {needsPriceReview ? (
            <p className="text-sm text-text">
              We need to review this visit&apos;s saved price before a change fee
              can be charged. Please contact us. Nothing has been charged.
            </p>
          ) : quoteLoading && !preview ? (
            <p className="text-sm text-text-muted">Checking the change fee…</p>
          ) : fee > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gold-dark">
                {changeFeeWarning(fee)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              {action === "add_dog"
                ? "Adding another pet is subject to availability and is not confirmed automatically. We’ll review the day’s schedule and text you once the change has been confirmed."
                : "This change does not include a cancellation fee."}
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
