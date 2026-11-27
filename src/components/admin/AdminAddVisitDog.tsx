"use client";

import React, { useEffect, useId, useState } from "react";
import { staffRescheduleServices } from "@/lib/appointments/staff-reschedule-input";
import type { StaffBookingProfilePet } from "@/lib/staff/customer-booking-profile";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";

export function AdminAddVisitDog({ appointment, booked, onSaved, onSaving }: {
  appointment: AdminAppointmentRecord;
  booked: AdminAppointmentRecord[];
  onSaved: () => void;
  onSaving: (saving: boolean) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [pets, setPets] = useState<StaffBookingProfilePet[] | null>(null);
  const [petId, setPetId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const available = pets?.filter((pet) => !booked.some((row) => row.petId === pet.id));
  const pet = available?.find((item) => item.id === petId);
  const services = staffRescheduleServices(pet?.weightLbs);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function loadPets() {
      try {
        const params = new URLSearchParams({ customerId: appointment.customerId });
        const response = await fetch(`/api/admin/customer-booking-profile?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const body = await response.json();
        if (!controller.signal.aborted) setPets(body.profile.pets);
      } catch {
        if (!controller.signal.aborted) setError("Could not load the customer's dogs.");
      }
    }
    void loadPets();
    return () => controller.abort();
  }, [appointment.customerId, open]);

  async function addDog() {
    if (!petId || !serviceId || saving) return;
    setSaving(true);
    onSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/appointments/${appointment.id}/dogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petId, serviceId }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Could not add this dog.");
        return;
      }
      onSaved();
    } catch {
      setError("Could not add this dog.");
    } finally {
      setSaving(false);
      onSaving(false);
    }
  }

  if (!open) return (
    <button type="button" className="mt-2 text-sm font-medium text-gold-dark underline" onClick={() => setOpen(true)}>
      Add a dog
    </button>
  );

  const fieldClass = "mt-1 w-full rounded-xl border border-lavender/40 bg-white px-4 py-2.5 text-sm text-text";
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-lavender/40 p-3 text-sm">
      {!pets && !error ? <p role="status">Loading dogs…</p> : null}
      {available?.length === 0 ? <p>There are no other saved dogs for this customer.</p> : null}
      {available?.length ? (
        <>
          <label htmlFor={`${id}-dog`} className="block">
            Dog
            <select id={`${id}-dog`} className={fieldClass} value={petId} disabled={saving} onChange={(event) => {
              setPetId(event.target.value);
              setServiceId("");
              setError("");
            }}>
              <option value="">Choose a dog</option>
              {available.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {pet && services.length ? (
            <label htmlFor={`${id}-service`} className="block">
              Service
              <select id={`${id}-service`} className={fieldClass} value={serviceId} disabled={saving} onChange={(event) => setServiceId(event.target.value)}>
                <option value="">Choose a service</option>
                {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
              </select>
            </label>
          ) : pet ? <p>Add the dog's weight to their profile to see available services.</p> : null}
        </>
      ) : null}
      {error ? <p role="alert" className="text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        {!!available?.length && (
          <button type="button" disabled={saving || !serviceId} onClick={() => void addDog()} className="rounded-xl bg-gold px-3 py-2 text-cream disabled:opacity-50">
            {saving ? "Adding…" : "Add to visit"}
          </button>
        )}
        <button type="button" disabled={saving} className="px-2 py-2" onClick={() => {
          setOpen(false);
          setPets(null);
          setPetId("");
          setServiceId("");
          setError("");
        }}>Back</button>
      </div>
    </div>
  );
}
