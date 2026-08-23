"use client";

import { useCallback, useEffect, useState } from "react";
import { CustomerProfileForm } from "@/components/account/CustomerProfileForm";
import { PetProfileFieldsForm } from "@/components/account/PetProfileFieldsForm";
import { mapPetRecordToUiProfile, mapPetProfileToWriteInput } from "@/lib/pets/map";
import { normalizePetProfile, type PetProfile } from "@/lib/pets";
import type { CustomerProfile } from "@/lib/profiles/types";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";
import { formatPaymentMethodLabel } from "@/lib/payments/types";
import type { StaffCustomerHistory } from "@/lib/charges/history";
import { formatChargeMoney } from "@/lib/charges/money";
import { formatStaffVisitTiming } from "@/lib/charges/hourly";
import { AppointmentCornerMark } from "@/components/admin/AppointmentCornerMark";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; customers: StaffCustomerRecord[] }
  | { status: "error"; message: string; authRequired?: boolean };

function customerLabel(profile: CustomerProfile) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  return name || profile.email;
}

function StaffPetEditor({
  customerId,
  pet,
  onSaved,
}: {
  customerId: string;
  pet: StaffCustomerRecord["pets"][number];
  onSaved: (pet: StaffCustomerRecord["pets"][number]) => void;
}) {
  const [draft, setDraft] = useState<PetProfile>(() =>
    normalizePetProfile({
      ...mapPetRecordToUiProfile(pet),
      adminServiceNotes: pet.adminServiceNotes,
    }),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(
      normalizePetProfile({
        ...mapPetRecordToUiProfile(pet),
        adminServiceNotes: pet.adminServiceNotes,
      }),
    );
  }, [pet]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/customers/${customerId}/pets/${pet.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...mapPetProfileToWriteInput(draft),
            adminServiceNotes: draft.adminServiceNotes ?? "",
          }),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        pet?: StaffCustomerRecord["pets"][number];
      };
      if (!response.ok || !body.pet) {
        throw new Error(body.error ?? "Could not save this pet profile.");
      }
      onSaved(body.pet);
      setSaved(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this pet profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <PetProfileFieldsForm
        pet={draft}
        onPetChange={(updates) => {
          setDraft((current) => normalizePetProfile({ ...current, ...updates }));
          setSaved(false);
        }}
        petPersisted
      />
      <label className="block text-sm font-medium text-text">
        Service & Product Notes (Admin Only)
        <textarea
          value={draft.adminServiceNotes ?? ""}
          onChange={(event) => {
            setDraft((current) => ({
              ...current,
              adminServiceNotes: event.target.value,
            }));
            setSaved(false);
          }}
          rows={3}
          className="mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text"
        />
      </label>
      {error && (
        <p className="text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Pet"}
        </button>
        {saved && <span className="text-xs text-text-muted">Saved</span>}
      </div>
    </div>
  );
}

function formatHistoryDate(iso: string) {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function appointmentStatusLabel(status: string) {
  if (status === "pending_confirmation") return "Pending";
  if (status === "cancelled") return "Cancelled";
  return "Booked";
}

function CustomerHistory({ customerId, open }: { customerId: string; open: boolean }) {
  const [history, setHistory] = useState<StaffCustomerHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || history) return;
    let cancelled = false;
    void fetch(`/api/admin/customers/${customerId}/history`, {
      credentials: "include",
    })
      .then(async (response) => {
        const body = (await response.json()) as StaffCustomerHistory & {
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(body.error ?? "Could not load history.");
          return;
        }
        setHistory({ appointments: body.appointments, orders: body.orders });
      })
      .catch(() => {
        if (!cancelled) setError("Could not load history.");
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, history, open]);

  if (!open) return null;

  return (
    <>
      <section>
        <h3 className="text-base font-medium text-gold-dark">
          Appointment history
        </h3>
        {error ? (
          <p className="mt-3 text-sm text-red-800">{error}</p>
        ) : !history ? (
          <p className="mt-3 text-sm text-text-muted">Loading history…</p>
        ) : history.appointments.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No appointments yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-lavender/30 overflow-hidden rounded-xl border border-lavender/30">
            {history.appointments.map((appointment) => (
              <li key={appointment.id} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-text">
                    {formatHistoryDate(appointment.appointmentDate)}
                    <span className="ml-2 font-normal text-text-muted">
                      {appointment.appointmentTime}
                    </span>
                  </p>
                  <AppointmentCornerMark
                    status={appointment.status}
                    vaccinationStatusAtBooking={
                      appointment.vaccinationStatusAtBooking
                    }
                    customerConfirmedAt={appointment.customerConfirmedAt}
                  />
                </div>
                <p className="mt-1 text-text-muted">
                  {appointment.petName} · {appointment.serviceName} ·{" "}
                  {appointmentStatusLabel(appointment.status)}
                </p>
                <p className="mt-1 text-xs text-gold-dark">
                  {formatStaffVisitTiming(
                    appointment.serviceStartedAt,
                    appointment.serviceEndedAt,
                    appointment.timezone,
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="text-base font-medium text-gold-dark">Paid orders</h3>
        {!history ? null : history.orders.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">No paid orders yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-lavender/30 overflow-hidden rounded-xl border border-lavender/30">
            {history.orders.map((order) => (
              <li key={order.id} className="px-4 py-3 text-sm">
                <p className="font-medium text-text">
                  {formatHistoryDate(order.appointmentDate)} ·{" "}
                  {formatChargeMoney(order.total)}
                </p>
                <p className="mt-1 text-text-muted">
                  {order.kind === "no_show" ? "No-show" : "Service"}
                  {order.petName ? ` · ${order.petName}` : ""}
                  {order.serviceName ? ` · ${order.serviceName}` : ""}
                </p>
                {order.lineItems.length > 0 ? (
                  <p className="mt-1 text-xs text-text-muted">
                    {order.lineItems
                      .map((item) => `${item.label} ${formatChargeMoney(item.amount)}`)
                      .join(" · ")}
                    {order.tipAmount > 0
                      ? ` · Tip ${formatChargeMoney(order.tipAmount)}`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function CustomerCard({
  customer,
  startOpen,
  onProfileSaved,
  onPetSaved,
}: {
  customer: StaffCustomerRecord;
  startOpen?: boolean;
  onProfileSaved: (profile: CustomerProfile) => void;
  onPetSaved: (pet: StaffCustomerRecord["pets"][number]) => void;
}) {
  const [open, setOpen] = useState(Boolean(startOpen));

  return (
    <article className="rounded-2xl border border-lavender/30 bg-cream">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <p className="font-medium text-text">{customerLabel(customer.profile)}</p>
          <p className="mt-1 text-sm text-text-muted">
            {customer.profile.email}
            {customer.profile.phone ? ` · ${customer.profile.phone}` : ""}
          </p>
        </div>
        <span className="text-sm text-gold-dark">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-8 border-t border-lavender/30 px-5 py-6">
          <section>
            <h3 className="text-base font-medium text-gold-dark">Owner Profile</h3>
            <div className="mt-4">
              <CustomerProfileForm
                profile={customer.profile}
                saveUrl={`/api/admin/customers/${customer.profile.id}`}
                onSaved={onProfileSaved}
              />
            </div>
          </section>
          <section>
            <h3 className="text-base font-medium text-gold-dark">Payment Methods</h3>
            {customer.paymentMethods.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No cards on file.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-text">
                {customer.paymentMethods.map((method) => (
                  <li key={method.id}>{formatPaymentMethodLabel(method)}</li>
                ))}
              </ul>
            )}
          </section>
          <CustomerHistory customerId={customer.profile.id} open={open} />
          <section>
            <h3 className="text-base font-medium text-gold-dark">Pet Profiles</h3>
            {customer.pets.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">No pet profiles yet.</p>
            ) : (
              <div className="mt-4 space-y-6">
                {customer.pets.map((pet) => (
                  <div
                    key={pet.id}
                    className="rounded-xl border border-lavender/30 px-4 py-4"
                  >
                    <p className="font-medium text-text">
                      {pet.name} · {pet.breed}
                    </p>
                    <StaffPetEditor
                      customerId={customer.profile.id}
                      pet={pet}
                      onSaved={onPetSaved}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </article>
  );
}

export function CustomerRecordsPanel({
  focusCustomerId,
}: {
  focusCustomerId?: string;
}) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  const loadCustomers = useCallback(async () => {
    setLoadState({ status: "loading" });
    try {
      const response = await fetch("/api/admin/customers", {
        credentials: "include",
      });
      const body = (await response.json()) as {
        error?: string;
        customers?: StaffCustomerRecord[];
      };

      if (response.status === 401) {
        setLoadState({
          status: "error",
          message: "Sign in with your team email to edit customer records.",
          authRequired: true,
        });
        return;
      }
      if (response.status === 403) {
        setLoadState({
          status: "error",
          message:
            "Your account is not authorized for staff records. Contact Penny if you need access.",
        });
        return;
      }
      if (!response.ok) {
        setLoadState({
          status: "error",
          message: body.error ?? "Could not load customer records.",
        });
        return;
      }
      setLoadState({ status: "ready", customers: body.customers ?? [] });
    } catch {
      setLoadState({
        status: "error",
        message: "Could not load customer records.",
      });
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  if (loadState.status === "loading") {
    return <p className="text-sm text-text-muted">Loading customer records…</p>;
  }

  if (loadState.status === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <p>{loadState.message}</p>
        {loadState.authRequired && (
          <a href="/login/admin" className="mt-3 inline-block underline">
            Staff sign in
          </a>
        )}
      </div>
    );
  }

  if (loadState.customers.length === 0) {
    return <p className="text-sm text-text-muted">No customer accounts yet.</p>;
  }

  return (
    <div className="space-y-4">
      {loadState.customers.map((customer) => (
        <CustomerCard
          key={customer.profile.id}
          customer={customer}
          startOpen={customer.profile.id === focusCustomerId}
          onProfileSaved={(profile) => {
            setLoadState((current) => {
              if (current.status !== "ready") return current;
              return {
                status: "ready",
                customers: current.customers.map((item) =>
                  item.profile.id === profile.id ? { ...item, profile } : item,
                ),
              };
            });
          }}
          onPetSaved={(pet) => {
            setLoadState((current) => {
              if (current.status !== "ready") return current;
              return {
                status: "ready",
                customers: current.customers.map((item) => ({
                  ...item,
                  pets: item.pets.map((existing) =>
                    existing.id === pet.id ? pet : existing,
                  ),
                })),
              };
            });
          }}
        />
      ))}
    </div>
  );
}
