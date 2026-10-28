"use client";
import { HourlyVisitTimer } from "@/components/admin/HourlyVisitTimer";

import Link from "next/link";
import { carePageTiming } from "@/lib/visits/operations";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatVisitClock,
  formatVisitDuration,
  formatVisitTimeRange,
} from "@/lib/charges/hourly";
import { buildPreviewCollectContext } from "@/lib/charges/preview";
import type { CollectContext } from "@/lib/charges/types";
import { formatServiceAddress } from "@/lib/travel";
import { AppointmentCornerMark } from "@/components/admin/AppointmentCornerMark";
import { CheckoutTextToggle } from "@/components/admin/CheckoutTextToggle";
import { VisitServiceEditor } from "@/components/admin/VisitServiceEditor";
import { sumLineItems } from "@/lib/charges/money";
import { buildVisitServicesUpdatedSms } from "@/lib/sms/visit-update-copy";
import type { ChargeLineItem } from "@/lib/charges/types";

export function VisitCheckIn({
  appointmentId,
  preview = false,
}: {
  appointmentId: string;
  preview?: boolean;
}) {
  const [selectedPetId, setSelectedPetId] = useState(appointmentId);
  const [context, setContext] = useState<CollectContext | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendCheckoutText, setSendCheckoutText] = useState(true);
  const [lineItems, setLineItems] = useState<ChargeLineItem[]>([]);
  const [savedLineItems, setSavedLineItems] = useState<ChargeLineItem[]>([]);
  const loadVersion = useRef(0);
  const servicesDirty = JSON.stringify(lineItems) !== JSON.stringify(savedLineItems);
  const [savingServices, setSavingServices] = useState(false);
  const [servicesNotice, setServicesNotice] = useState<string | null>(null);
  const [confirmAddOnCharge, setConfirmAddOnCharge] = useState<string | null>(null);

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setError(null);
    if (preview) {
      const body = buildPreviewCollectContext();
      setContext(body);
      setLineItems(body.careLineItems ?? body.lineItems);
      setSavedLineItems(body.careLineItems ?? body.lineItems);
      setStartedAt(carePageTiming(body).startedAt);
      setEndedAt(carePageTiming(body).endedAt);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/admin/collect/${selectedPetId}`, {
        credentials: "include",
      });
      const body = (await response.json()) as CollectContext & { error?: string };
      if (version !== loadVersion.current) return;
      if (!response.ok) {
        setContext(null);
        setError(body.error ?? "Could not load this appointment.");
        return;
      }
      setContext(body);
      setLineItems(body.careLineItems ?? body.lineItems);
      setSavedLineItems(body.careLineItems ?? body.lineItems);
      setStartedAt(carePageTiming(body).startedAt);
      setEndedAt(carePageTiming(body).endedAt);
    } catch {
      if (version === loadVersion.current) {
        setContext(null);
        setError("Could not load this appointment.");
      }
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, [selectedPetId, preview]);

  useEffect(() => {
    void load();
    return () => { loadVersion.current += 1; };
  }, [load]);

  useEffect(() => {
    if (!startedAt || endedAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, endedAt]);

  async function setTiming(action: "check_in" | "check_out") {
    if (savingServices || (action === "check_out" && servicesDirty)) return;
    const stamp = new Date().toISOString();
    if (preview) {
      if (action === "check_in") {
        setStartedAt(stamp);
        setEndedAt(null);
      } else {
        setEndedAt(stamp);
      }
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/appointments/${appointmentId}/timing`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            scope: "visit",
            sendCheckoutText: action === "check_out" ? sendCheckoutText : undefined,
          }),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        startedAt?: string | null;
        endedAt?: string | null;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not update the visit.");
        return;
      }
      setStartedAt(body.startedAt ?? null);
      setEndedAt(body.endedAt ?? null);
    } catch {
      setError("Could not update the visit.");
    } finally {
      setBusy(false);
    }
  }

  async function saveServices(confirmIncompatibleAddOns = false) {
    if (!context || !servicesDirty || savingServices || lineItems.length === 0) return;
    setSavingServices(true);
    setError(null);
    setServicesNotice(null);
    if (preview) {
      const total = Math.round(sumLineItems(lineItems) * 100) / 100;
      setContext({
        ...context,
        lineItems,
        careLineItems: lineItems,
        visit: context.visit ? { ...context.visit, pets: context.visit.pets?.map(pet => pet.id === selectedPetId ? { ...pet, serviceName: lineItems[0]?.label ?? pet.serviceName } : pet) } : undefined,
        appointment: {
          ...context.appointment,
          serviceName: lineItems[0]?.label ?? context.appointment.serviceName,
          estimatedTotal: total,
        },
      });
      setSavedLineItems(lineItems);
      setServicesNotice(
        `Preview only · guest would receive: ${buildVisitServicesUpdatedSms({
          services: lineItems,
          estimatedTotal: total,
        })}`,
      );
      setSavingServices(false);
      return;
    }
    try {
      const response = await fetch(
        `/api/admin/appointments/${selectedPetId}/services`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineItems, confirmIncompatibleAddOns }),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        code?: string;
        serviceName?: string;
        estimatedTotal?: number;
        smsSent?: boolean;
      };
      if (!response.ok) {
        if (body.code === "addon_confirmation_required") {
          setConfirmAddOnCharge(
            body.error ??
              "That add-on cannot be booked with this service.",
          );
          return;
        }
        setConfirmAddOnCharge(null);
        setError(body.error ?? "Could not save the services.");
        return;
      }
      setConfirmAddOnCharge(null);
      setContext({
        ...context,
        lineItems,
        careLineItems: lineItems,
        visit: context.visit ? { ...context.visit, pets: context.visit.pets?.map(pet => pet.id === selectedPetId ? { ...pet, serviceName: body.serviceName ?? lineItems[0]?.label ?? pet.serviceName } : pet) } : undefined,
        appointment: {
          ...context.appointment,
          serviceName: body.serviceName ?? lineItems[0]?.label ?? context.appointment.serviceName,
          estimatedTotal: body.estimatedTotal ?? context.appointment.estimatedTotal,
        },
      });
      setSavedLineItems(lineItems);
      setServicesNotice(
        body.smsSent
          ? "Services saved. The guest was texted the update."
          : "Services saved. The guest could not be texted.",
      );
    } catch {
      setError("Could not save the services.");
    } finally {
      setSavingServices(false);
    }
  }

  if (loading) {
    return <p className="font-body text-sm text-taupe">Preparing check-in…</p>;
  }

  if (!context) {
    return (
      <div>
        <p className="font-body text-sm text-red-800">{error}</p>
        <Link href="/admin/appointments" className="mt-4 inline-block text-sm underline">
          Back to appointments
        </Link>
      </div>
    );
  }

  const appointment = context.appointment;
  const timeZone = appointment.timezone;

  return (
    <div className="relative mx-auto flex min-h-[80vh] w-full max-w-lg flex-col justify-center text-center">
      <div className="absolute right-0 top-0">
        <AppointmentCornerMark
          status={appointment.status}
          vaccinationStatusAtBooking={appointment.vaccinationStatusAtBooking}
          customerConfirmedAt={appointment.customerConfirmedAt}
        />
      </div>
      {preview ? (
        <p className="mb-6 rounded-xl border border-champagne bg-cream px-4 py-2 text-xs uppercase tracking-[0.16em] text-taupe">
          Preview only · no save
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <p className="font-body text-[10px] font-medium uppercase tracking-[0.18em] text-taupe">
        Arrived
      </p>
      <h1 className="font-display mt-4 text-5xl text-ink">{context.visit?.petNames?.join(" & ") || appointment.petName}</h1>
      <p className="font-body mt-3 text-base text-taupe">
        {appointment.customerName ?? appointment.customerEmail}
      </p>
      {context.petWeightStatus === "missing" ? (
        <p className="font-body mt-4 text-sm text-red-800">
          This dog has no weight on file. Suggested grooming prices stay hidden until a weight is saved.
        </p>
      ) : null}
      <p className="font-body mt-6 text-sm text-ink">
        {lineItems.length > 0
          ? lineItems.map((item) => item.label).join(" · ")
          : appointment.serviceName}
      </p>
      <p className="font-body mt-2 text-sm text-taupe">
        {formatServiceAddress({
          street: appointment.addressStreet,
          city: appointment.addressCity,
          state: appointment.addressState,
          zip: appointment.addressZip,
        })}
      </p>
      <p className="font-body mt-1 text-sm text-taupe">
        {appointment.appointmentTime}
      </p>

      {context.visit?.hourlyPets?.map(pet => (
        <section key={pet.id} className="mt-6 rounded-xl border border-lavender/30 p-4">
          <h2 className="font-medium text-ink">{pet.petName} · Service timer</h2>
          <HourlyVisitTimer appointmentId={pet.id} preview={preview} rate={pet.rate}
            startedAt={pet.startedAt} endedAt={pet.endedAt} timeZone={timeZone}
            onTimesChange={timing => setContext(current => current?.visit ? { ...current, visit: { ...current.visit,
              hourlyPets: current.visit.hourlyPets?.map(row => row.id === pet.id ? {...row, ...timing} : row),
            }} : current)} />
        </section>
      ))}
      <div className="mt-10">
        {!startedAt ? (
          <>
            <p className="font-body text-sm text-taupe">
              Check in when you arrive and start the visit.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void setTiming("check_in")}
              className="mt-6 w-full rounded-sm bg-deep-lavender px-6 py-5 text-[12px] font-medium uppercase tracking-[0.16em] text-ivory disabled:opacity-50"
            >
              Check in
            </button>
          </>
        ) : !endedAt ? (
          <>
            <p className="font-display text-3xl text-ink">
              Checked in at {formatVisitClock(startedAt, timeZone)}
            </p>
            <p className="font-body mt-3 text-sm text-taupe">
              In progress · {formatVisitDuration(startedAt, null, now)}
            </p>
            {(context.visit?.pets?.length ?? 0) > 1 ? (
              <label className="mt-6 block text-left text-sm text-taupe">
                Care for
                <select value={selectedPetId} disabled={busy || savingServices || servicesDirty}
                  onChange={event => { setLoading(true); setSelectedPetId(event.target.value); setServicesNotice(null); setConfirmAddOnCharge(null); }}
                  className="mt-2 w-full rounded-xl border border-lavender/40 bg-white px-3 py-2 text-ink">
                  {context.visit?.pets?.map(pet => <option key={pet.id} value={pet.id}>{pet.petName} — {pet.serviceName}</option>)}
                </select>
              </label>
            ) : null}
            <VisitServiceEditor
              lineItems={lineItems}
              catalogGroups={context.catalogGroups ?? []}
              disabled={busy || savingServices}
              dirty={servicesDirty}
              saving={savingServices}
              notice={servicesNotice}
              onChange={(items) => {
                setLineItems(items);
                setServicesNotice(null);
                setConfirmAddOnCharge(null);
              }}
              onSave={() => void saveServices(false)}
            />
            {confirmAddOnCharge ? (
              <div className="mt-4 rounded-xl border border-champagne bg-cream px-4 py-4 text-left">
                <p className="font-body text-sm text-ink">{confirmAddOnCharge}</p>
                <p className="font-body mt-2 text-sm text-taupe">
                  Saving will add this charge. Continue only if the extra care fee is intentional.
                </p>
                <button
                  type="button"
                  disabled={busy || savingServices}
                  onClick={() => void saveServices(true)}
                  className="mt-4 w-full rounded-sm border border-lavender/50 bg-white px-6 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-ink disabled:opacity-50"
                >
                  {savingServices ? "Saving…" : "Confirm extra charge"}
                </button>
              </div>
            ) : null}
            {servicesDirty ? <p className="mt-4 text-sm text-taupe" role="status">Save changes for {appointment.petName} before switching dogs or checking out.</p> : null}
            <CheckoutTextToggle
              checked={sendCheckoutText}
              onChange={setSendCheckoutText}
              disabled={busy || savingServices}
              className="mt-8"
            />
            <button
              type="button"
              disabled={busy || savingServices || servicesDirty}
              onClick={() => void setTiming("check_out")}
              className="mt-4 w-full rounded-sm bg-gold px-6 py-5 text-[12px] font-medium uppercase tracking-[0.16em] text-white disabled:opacity-50"
            >
              Check out
            </button>
          </>
        ) : (
          <>
            <p className="font-display text-3xl text-ink">
              {formatVisitTimeRange(startedAt, endedAt, timeZone)}
            </p>
            <p className="font-body mt-3 text-sm text-taupe">
              Visit timed · {formatVisitDuration(startedAt, endedAt)}
            </p>
            <Link
              href={
                preview
                  ? "/admin/collect/preview"
                  : `/admin/collect/${appointmentId}`
              }
              className="mt-8 inline-flex w-full items-center justify-center rounded-sm bg-deep-lavender px-6 py-5 text-[12px] font-medium uppercase tracking-[0.16em] text-ivory"
            >
              Collect payment
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={() => void setTiming("check_in")}
              className="mt-4 w-full text-sm text-taupe underline"
            >
              Start again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
