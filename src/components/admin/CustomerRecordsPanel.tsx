"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CustomerProfileForm } from "@/components/account/CustomerProfileForm";
import { CreateCustomerProfileForm } from "@/components/admin/CreateCustomerProfileForm";
import type { CustomerProfile } from "@/lib/profiles/types";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";
import {
  customerDeleteConfirmMessage,
  customerFreezeConfirmMessage,
} from "@/lib/profiles/delete-guard";
import { isInternalCustomerEmail, isOwnerEmail } from "@/lib/staff/owner";
import type { PaymentMethodRecord } from "@/lib/payments/types";
import type { StaffCustomerHistory } from "@/lib/charges/history";
import { formatLineItemMoney } from "@/lib/charges/list-amount";
import { formatChargeMoney } from "@/lib/charges/money";
import { formatStaffVisitTiming } from "@/lib/charges/hourly";
import { AppointmentCornerMark } from "@/components/admin/AppointmentCornerMark";
import { CallCustomerButton } from "@/components/admin/CallCustomerButton";
import { CustomerAdminNotesEditor } from "@/components/admin/CustomerAdminNotesEditor";
import { StaffCustomerPassword } from "@/components/admin/StaffCustomerPassword";
import { StaffCustomerPayments } from "@/components/admin/StaffCustomerPayments";
import { StaffCustomerPets } from "@/components/admin/StaffCustomerPets";
import { StaffCustomerReferrals } from "@/components/admin/StaffCustomerReferrals";
import type { StaffReferralView } from "@/components/admin/StaffCustomerReferrals";

type LoadState =
  | { status: "loading" }
  | {
      status: "ready";
      admins: StaffCustomerRecord[];
      customers: StaffCustomerRecord[];
    }
  | { status: "error"; message: string; authRequired?: boolean };

function sortCustomers(items: StaffCustomerRecord[]) {
  return [...items].sort((left, right) =>
    left.profile.email.localeCompare(right.profile.email),
  );
}

function visibleAccountEmail(email: string) {
  return isInternalCustomerEmail(email) ? "" : email.trim();
}

function customerLabel(profile: CustomerProfile) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  return name || visibleAccountEmail(profile.email) || "Customer";
}

function profileDetailValue(value: string) {
  const text = value.trim();
  return text || "—";
}

function OwnerProfileDetails({ profile }: { profile: CustomerProfile }) {
  const rows: Array<{ label: string; value: string; wide?: boolean }> = [
    {
      label: "Email",
      value: profileDetailValue(visibleAccountEmail(profile.email)),
    },
    { label: "First Name", value: profileDetailValue(profile.firstName) },
    { label: "Last Name", value: profileDetailValue(profile.lastName) },
    { label: "Mobile Phone", value: profileDetailValue(profile.phone) },
    {
      label: "Preferred Contact Method",
      value: profileDetailValue(profile.preferredContact),
    },
    {
      label: "Emergency Contact Name",
      value: profileDetailValue(profile.emergencyContactName),
      wide: true,
    },
    {
      label: "Emergency Contact Phone",
      value: profileDetailValue(profile.emergencyContactPhone),
    },
    {
      label: "Relationship",
      value: profileDetailValue(profile.emergencyContactRelationship),
    },
  ];

  return (
    <dl className="grid gap-4 border-t border-lavender/30 px-4 py-4 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className={row.wide ? "sm:col-span-2" : undefined}>
          <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-muted">
            {row.label}
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-text">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function bookForCustomerHref(profile: CustomerProfile) {
  const params = new URLSearchParams();
  if (profile.id) params.set("customerId", profile.id);
  const email = visibleAccountEmail(profile.email);
  if (email) params.set("email", email);
  if (profile.firstName) params.set("firstName", profile.firstName);
  if (profile.lastName) params.set("lastName", profile.lastName);
  if (profile.phone) params.set("phone", profile.phone);
  const query = params.toString();
  return query
    ? `/admin/book-for-customer?${query}`
    : "/admin/book-for-customer";
}

function AccountActionButton({
  label,
  busyLabel,
  busy,
  danger = false,
  onClick,
}: {
  label: string;
  busyLabel: string;
  busy: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`rounded-xl border px-3 py-2 text-sm disabled:opacity-60 ${
        danger
          ? "border-lavender/40 text-text-muted hover:border-red-300 hover:text-red-800"
          : "border-lavender/40 text-text-muted hover:border-gold/40 hover:text-text"
      }`}
    >
      {busy ? busyLabel : label}
    </button>
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
  if (status === "pending_confirmation") return "Pending Review";
  if (status === "cancelled") return "Cancelled";
  return "Confirmed";
}

type ServiceAddressParts = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

function formatAppointmentAddress(appointment: {
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
}) {
  const cityLine = [appointment.addressCity, appointment.addressState]
    .filter(Boolean)
    .join(", ");
  const withZip = [cityLine, appointment.addressZip].filter(Boolean).join(" ");
  return [appointment.addressStreet, withZip].filter(Boolean).join(", ");
}

function addressKey(address: ServiceAddressParts) {
  return [address.street, address.city, address.state, address.zip]
    .map((part) => part.trim().toLowerCase())
    .join("|");
}

function uniqueServiceAddresses(
  appointments: StaffCustomerHistory["appointments"],
): ServiceAddressParts[] {
  const seen = new Set<string>();
  const addresses: ServiceAddressParts[] = [];
  for (const appointment of appointments) {
    const next: ServiceAddressParts = {
      street: appointment.addressStreet,
      city: appointment.addressCity,
      state: appointment.addressState,
      zip: appointment.addressZip,
    };
    const label = formatAppointmentAddress(appointment);
    const key = addressKey(next);
    if (!label || seen.has(key)) continue;
    seen.add(key);
    addresses.push(next);
  }
  return addresses;
}

function addressInputClassName() {
  return "mt-1.5 w-full rounded-xl border border-lavender/40 bg-cream px-4 py-2.5 text-sm text-text placeholder:text-text-muted/50";
}

function ServiceAddressFields({
  draft,
  onChange,
}: {
  draft: ServiceAddressParts;
  onChange: (next: ServiceAddressParts) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-medium text-text sm:col-span-2">
        Street Address
        <input
          value={draft.street}
          onChange={(event) =>
            onChange({ ...draft, street: event.target.value })
          }
          className={addressInputClassName()}
        />
      </label>
      <label className="block text-sm font-medium text-text">
        City
        <input
          value={draft.city}
          onChange={(event) => onChange({ ...draft, city: event.target.value })}
          className={addressInputClassName()}
        />
      </label>
      <label className="block text-sm font-medium text-text">
        State
        <input
          value={draft.state}
          onChange={(event) =>
            onChange({ ...draft, state: event.target.value })
          }
          className={addressInputClassName()}
        />
      </label>
      <label className="block text-sm font-medium text-text">
        ZIP
        <input
          value={draft.zip}
          onChange={(event) => onChange({ ...draft, zip: event.target.value })}
          className={addressInputClassName()}
        />
      </label>
    </div>
  );
}

function ServiceAddressEditor({
  customerId,
  address,
  preview = false,
  onSaved,
}: {
  customerId: string;
  address: ServiceAddressParts;
  preview?: boolean;
  onSaved: (from: ServiceAddressParts, to: ServiceAddressParts) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ServiceAddressParts>(address);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(address);
    setEditing(false);
    setError(null);
    setSaved(false);
  }, [address]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const next = {
        street: draft.street.trim(),
        city: draft.city.trim(),
        state: draft.state.trim(),
        zip: draft.zip.trim(),
      };
      if (preview) {
        onSaved(address, next);
        setSaved(true);
        setEditing(false);
        return;
      }

      const response = await fetch(
        `/api/admin/customers/${customerId}/addresses`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: address, to: next }),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        address?: ServiceAddressParts;
      };
      if (!response.ok || !body.address) {
        throw new Error(body.error ?? "Could not save this address.");
      }
      onSaved(address, body.address);
      setSaved(true);
      setEditing(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this address.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <li className="rounded-xl border border-lavender/30 px-4 py-3 text-sm text-text">
        <div className="flex items-start justify-between gap-3">
          <p>
            {formatAppointmentAddress({
              addressStreet: address.street,
              addressCity: address.city,
              addressState: address.state,
              addressZip: address.zip,
            })}
          </p>
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setError(null);
              setSaved(false);
            }}
            className="shrink-0 rounded-xl border border-lavender/40 px-3 py-1.5 text-sm text-text-muted hover:border-gold/40 hover:text-text"
          >
            Edit
          </button>
        </div>
        {saved ? <p className="mt-2 text-xs text-text-muted">Saved</p> : null}
      </li>
    );
  }

  return (
    <li className="rounded-xl border border-lavender/30 px-4 py-4 text-sm">
      <ServiceAddressFields draft={draft} onChange={setDraft} />
      {error ? (
        <p className="mt-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Address"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(address);
            setEditing(false);
            setError(null);
          }}
          disabled={saving}
          className="rounded-xl border border-lavender px-4 py-2 text-sm text-text-muted disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </li>
  );
}

function ServiceAddressAddForm({
  customerId,
  preview = false,
  onAdded,
}: {
  customerId: string;
  preview?: boolean;
  onAdded: (address: ServiceAddressParts) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ServiceAddressParts>({
    street: "",
    city: "",
    state: "FL",
    zip: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const next = {
        street: draft.street.trim(),
        city: draft.city.trim(),
        state: draft.state.trim(),
        zip: draft.zip.trim(),
      };
      if (preview) {
        onAdded(next);
        setDraft({ street: "", city: "", state: "FL", zip: "" });
        setOpen(false);
        return;
      }

      const response = await fetch(
        `/api/admin/customers/${customerId}/addresses`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        address?: ServiceAddressParts;
      };
      if (!response.ok || !body.address) {
        throw new Error(body.error ?? "Could not add this address.");
      }
      onAdded(body.address);
      setDraft({ street: "", city: "", state: "FL", zip: "" });
      setOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not add this address.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className="mt-3 rounded-xl border border-dashed border-gold/50 px-4 py-2 text-sm text-gold-dark hover:border-gold hover:bg-gold/5"
      >
        + Add address
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-lavender/30 px-4 py-4 text-sm">
      <p className="text-sm font-medium text-gold-dark">New service address</p>
      <div className="mt-3">
        <ServiceAddressFields draft={draft} onChange={setDraft} />
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Address"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          disabled={saving}
          className="rounded-xl border border-lavender px-4 py-2 text-sm text-text-muted disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CustomerHistory({
  customerId,
  open,
  preview = false,
  previewHistory,
  bookHref,
}: {
  customerId: string;
  open: boolean;
  preview?: boolean;
  previewHistory?: StaffCustomerHistory;
  bookHref?: string;
}) {
  const [history, setHistory] = useState<StaffCustomerHistory | null>(
    preview ? previewHistory ?? { appointments: [], orders: [] } : null,
  );
  const [addresses, setAddresses] = useState<ServiceAddressParts[] | null>(
    preview
      ? uniqueServiceAddresses(previewHistory?.appointments ?? [])
      : null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || history || preview) return;
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
  }, [customerId, history, open, preview]);

  useEffect(() => {
    if (!open || addresses || preview) return;
    let cancelled = false;
    void fetch(`/api/admin/customers/${customerId}/addresses`, {
      credentials: "include",
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          error?: string;
          addresses?: ServiceAddressParts[];
        };
        if (cancelled) return;
        if (!response.ok) {
          // Fall back to visit addresses from history when the saved-address
          // table is unavailable (e.g. migration not applied yet).
          if (history) {
            setAddresses(uniqueServiceAddresses(history.appointments));
          }
          return;
        }
        setAddresses(body.addresses ?? []);
      })
      .catch(() => {
        if (!cancelled && history) {
          setAddresses(uniqueServiceAddresses(history.appointments));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [addresses, customerId, history, open, preview]);

  if (!open) return null;

  function applyAddressRewrite(
    from: ServiceAddressParts,
    to: ServiceAddressParts,
  ) {
    setAddresses((current) => {
      const list = current ?? [];
      return list.map((address) =>
        addressKey(address) === addressKey(from) ? to : address,
      );
    });
    setHistory((current) => {
      if (!current) return current;
      return {
        ...current,
        appointments: current.appointments.map((appointment) => {
          if (
            appointment.addressStreet !== from.street ||
            appointment.addressCity !== from.city ||
            appointment.addressState !== from.state ||
            appointment.addressZip !== from.zip
          ) {
            return appointment;
          }
          return {
            ...appointment,
            addressStreet: to.street,
            addressCity: to.city,
            addressState: to.state,
            addressZip: to.zip,
          };
        }),
      };
    });
  }

  function applyAddressAdd(address: ServiceAddressParts) {
    setAddresses((current) => {
      const list = current ?? [];
      if (list.some((item) => addressKey(item) === addressKey(address))) {
        return list;
      }
      return [...list, address];
    });
  }

  return (
    <>
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-medium text-gold-dark">
            Service addresses
          </h3>
          {bookHref ? (
            <a
              href={bookHref}
              className="rounded-xl border border-lavender/40 px-3 py-2 text-sm text-text-muted hover:border-gold/40 hover:text-text"
            >
              Book for customer
            </a>
          ) : null}
        </div>
        {addresses == null ? (
          <p className="mt-3 text-sm text-text-muted">Loading addresses…</p>
        ) : (
          <>
            {addresses.length === 0 ? (
              <p className="mt-3 text-sm text-text-muted">
                No service addresses yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {addresses.map((address) => (
                  <ServiceAddressEditor
                    key={addressKey(address)}
                    customerId={customerId}
                    address={address}
                    preview={preview}
                    onSaved={applyAddressRewrite}
                  />
                ))}
              </ul>
            )}
            <ServiceAddressAddForm
              customerId={customerId}
              preview={preview}
              onAdded={applyAddressAdd}
            />
          </>
        )}
      </section>
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
                  <span
                    className={
                      appointment.status === "cancelled"
                        ? "text-text-muted"
                        : "text-gold-dark"
                    }
                  >
                    {appointmentStatusLabel(appointment.status)}
                  </span>
                </p>
                <p className="mt-1 text-xs text-gold-dark">
                  {formatStaffVisitTiming(
                    appointment.serviceStartedAt,
                    appointment.serviceEndedAt,
                    appointment.timezone,
                  )}
                </p>
                {formatAppointmentAddress(appointment) ? (
                  <p className="mt-1 text-xs text-text-muted">
                    {formatAppointmentAddress(appointment)}
                  </p>
                ) : null}
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
                  {order.kind === "no_show"
                    ? "No-show"
                    : order.kind === "cancellation"
                      ? "Cancellation"
                      : "Service"}
                  {order.petName ? ` · ${order.petName}` : ""}
                  {order.serviceName ? ` · ${order.serviceName}` : ""}
                </p>
                {order.lineItems.length > 0 ? (
                  <p className="mt-1 text-xs text-text-muted">
                    {order.lineItems
                      .map((item) => `${item.label} ${formatLineItemMoney(item)}`)
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

export function CustomerRecordCard({
  customer,
  startOpen,
  preview = false,
  previewHistory,
  previewReferrals,
  onProfileSaved,
  onPetSaved,
  onPetCreated,
  onPetArchived,
  onPaymentMethodsChange,
  onDeleted,
  onFrozenChange,
}: {
  customer: StaffCustomerRecord;
  startOpen?: boolean;
  preview?: boolean;
  previewHistory?: StaffCustomerHistory;
  previewReferrals?: StaffReferralView;
  onProfileSaved: (profile: CustomerProfile) => void;
  onPetSaved: (pet: StaffCustomerRecord["pets"][number]) => void;
  onPetCreated: (pet: StaffCustomerRecord["pets"][number]) => void;
  onPetArchived: (petId: string) => void;
  onPaymentMethodsChange: (methods: PaymentMethodRecord[]) => void;
  onDeleted: (customerId: string) => void;
  onFrozenChange: (customerId: string, frozen: boolean) => void;
}) {
  const [open, setOpen] = useState(Boolean(startOpen));
  const [busyAction, setBusyAction] = useState<"delete" | "freeze" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [profile, setProfile] = useState(customer.profile);
  const [profileEditing, setProfileEditing] = useState(false);

  useEffect(() => {
    setProfile(customer.profile);
  }, [customer.profile]);

  const roleLabel = isOwnerEmail(profile.email)
    ? "Owner"
    : customer.kind === "admin"
      ? "Administrator"
      : "Customer";

  async function handleDelete() {
    const label = customerLabel(customer.profile);
    if (!window.confirm(customerDeleteConfirmMessage(label))) return;

    if (preview) {
      onDeleted(customer.profile.id);
      return;
    }

    setBusyAction("delete");
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/customers/${customer.profile.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not delete this account.");
      }
      onDeleted(customer.profile.id);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not delete this account.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleFreeze() {
    const label = customerLabel(customer.profile);
    const nextFrozen = !customer.frozen;
    if (!window.confirm(customerFreezeConfirmMessage(label, customer.frozen))) {
      return;
    }

    if (preview) {
      onFrozenChange(customer.profile.id, nextFrozen);
      return;
    }

    setBusyAction("freeze");
    setActionError(null);
    try {
      const response = await fetch(
        `/api/admin/customers/${customer.profile.id}/freeze`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frozen: nextFrozen }),
        },
      );
      const body = (await response.json()) as { error?: string; frozen?: boolean };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not update this account.");
      }
      onFrozenChange(customer.profile.id, body.frozen ?? nextFrozen);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update this account.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function renderOwnerActions() {
    return (
      <>
        {customer.canFreeze ? (
          <AccountActionButton
            label={customer.frozen ? "Unfreeze" : "Freeze"}
            busyLabel={customer.frozen ? "Unfreezing…" : "Freezing…"}
            busy={busyAction === "freeze"}
            onClick={() => void handleFreeze()}
          />
        ) : null}
        {customer.canDelete ? (
          <AccountActionButton
            label="Delete"
            busyLabel="Deleting…"
            busy={busyAction === "delete"}
            danger
            onClick={() => void handleDelete()}
          />
        ) : null}
      </>
    );
  }

  return (
    <article className="rounded-2xl border border-lavender/30 bg-cream">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="font-medium text-text">{customerLabel(profile)}</p>
          <p className="mt-1 text-sm text-text-muted">
            {roleLabel}
            {customer.frozen ? " · Frozen" : ""}
            {visibleAccountEmail(profile.email)
              ? ` · ${visibleAccountEmail(profile.email)}`
              : ""}
            {profile.phone ? ` · ${profile.phone}` : ""}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {customer.kind === "customer" && !customer.frozen ? (
            <a
              href={bookForCustomerHref(profile)}
              className="rounded-xl border border-lavender/40 px-3 py-2 text-sm text-text-muted hover:border-gold/40 hover:text-text"
            >
              Book for customer
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setProfileEditing(true);
            }}
            className="rounded-xl border border-lavender/40 px-3 py-2 text-sm text-text-muted hover:border-gold/40 hover:text-text"
          >
            Edit
          </button>
          {renderOwnerActions()}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="min-h-[40px] min-w-[40px] text-sm text-gold-dark"
            aria-expanded={open}
            aria-label={open ? "Collapse customer" : "Expand customer"}
          >
            {open ? "−" : "+"}
          </button>
        </div>
      </div>
      {open && (
        <div className="space-y-8 border-t border-lavender/30 px-5 py-6">
          {actionError ? (
            <p className="text-sm text-red-800" role="alert">
              {actionError}
            </p>
          ) : null}
          <CustomerAdminNotesEditor
            customerId={customer.profile.id}
            preview={preview}
          />
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-medium text-gold-dark">Owner Profile</h3>
              <div className="flex flex-wrap items-center gap-2">
                {customer.kind === "customer" && !customer.frozen ? (
                  <a
                    href={bookForCustomerHref(profile)}
                    className="rounded-xl border border-lavender/40 px-3 py-2 text-sm text-text-muted hover:border-gold/40 hover:text-text"
                  >
                    Book for customer
                  </a>
                ) : null}
                <CallCustomerButton
                  customerId={customer.profile.id}
                  disabled={!profile.phone}
                  preview={preview}
                />
                {renderOwnerActions()}
              </div>
            </div>
            <div className="mt-4">
              {profileEditing ? (
                <CustomerProfileForm
                  profile={profile}
                  saveUrl={`/api/admin/customers/${profile.id}`}
                  onSaved={(next) => {
                    setProfile(next);
                    onProfileSaved(next);
                    setProfileEditing(false);
                  }}
                  onCancel={() => setProfileEditing(false)}
                  audience="staff"
                  preview={preview}
                />
              ) : (
                <OwnerProfileDetails profile={profile} />
              )}
            </div>
          </section>
          <StaffCustomerPayments
            customerId={customer.profile.id}
            methods={customer.paymentMethods}
            preview={preview}
            onChange={onPaymentMethodsChange}
          />
          <CustomerHistory
            customerId={customer.profile.id}
            open={open}
            preview={preview}
            previewHistory={previewHistory}
            bookHref={
              customer.kind === "customer" && !customer.frozen
                ? bookForCustomerHref(profile)
                : undefined
            }
          />
          <StaffCustomerPets
            customerId={customer.profile.id}
            pets={customer.pets}
            preview={preview}
            appointments={preview ? previewHistory?.appointments : undefined}
            onPetSaved={onPetSaved}
            onPetCreated={onPetCreated}
            onPetArchived={onPetArchived}
          />
          <StaffCustomerReferrals
            customerId={customer.profile.id}
            preview={preview}
            previewView={previewReferrals}
          />
          <StaffCustomerPassword
            customerId={customer.profile.id}
            preview={preview}
          />
          {customer.canDelete || customer.canFreeze ? (
            <section className="border-t border-lavender/30 pt-6">
              <h3 className="text-base font-medium text-gold-dark">
                Account access
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">{renderOwnerActions()}</div>
            </section>
          ) : null}
        </div>
      )}
    </article>
  );
}

export function CustomerRecordsPanel({
  focusCustomerId,
  preview = false,
  previewCustomers,
  previewHistoryByCustomerId,
  previewReferralsByCustomerId,
}: {
  focusCustomerId?: string;
  preview?: boolean;
  previewCustomers?: StaffCustomerRecord[];
  previewHistoryByCustomerId?: Record<string, StaffCustomerHistory>;
  previewReferralsByCustomerId?: Record<string, StaffReferralView>;
}) {
  const [loadState, setLoadState] = useState<LoadState>(() =>
    preview && previewCustomers
      ? {
          status: "ready",
          admins: previewCustomers.filter((item) => item.kind === "admin"),
          customers: previewCustomers.filter((item) => item.kind !== "admin"),
        }
      : { status: "loading" },
  );
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);
  const [createDrafts, setCreateDrafts] = useState<number[]>([]);

  const loadCustomers = useCallback(async () => {
    if (preview && previewCustomers) {
      setLoadState({
        status: "ready",
        admins: previewCustomers.filter((item) => item.kind === "admin"),
        customers: previewCustomers.filter((item) => item.kind !== "admin"),
      });
      return;
    }
    setLoadState({ status: "loading" });
    try {
      const response = await fetch("/api/admin/customers", {
        credentials: "include",
      });
      const body = (await response.json()) as {
        error?: string;
        admins?: StaffCustomerRecord[];
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
          message: body.error ?? "Could not load registered accounts.",
        });
        return;
      }
      setLoadState({
        status: "ready",
        admins: body.admins ?? [],
        customers: body.customers ?? [],
      });
    } catch {
      setLoadState({
        status: "error",
        message: "Could not load registered accounts.",
      });
    }
  }, [preview, previewCustomers]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  if (loadState.status === "loading") {
    return <p className="text-sm text-text-muted">Loading registered accounts…</p>;
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

  function updateLists(
    current: Extract<LoadState, { status: "ready" }>,
    updater: (item: StaffCustomerRecord) => StaffCustomerRecord | null,
  ): Extract<LoadState, { status: "ready" }> {
    const apply = (items: StaffCustomerRecord[]) =>
      items
        .map(updater)
        .filter((item): item is StaffCustomerRecord => item !== null);
    return {
      status: "ready",
      admins: apply(current.admins),
      customers: apply(current.customers),
    };
  }

  function addCreateDraft() {
    setCreateDrafts((current) => {
      const nextId = current.reduce((max, id) => Math.max(max, id), 0) + 1;
      return [nextId, ...current];
    });
  }

  function removeCreateDraft(id: number) {
    setCreateDrafts((current) => current.filter((draftId) => draftId !== id));
  }

  function renderCards(items: StaffCustomerRecord[], empty: string) {
    if (items.length === 0) {
      return <p className="text-sm text-text-muted">{empty}</p>;
    }
    return items.map((customer) => (
            <CustomerRecordCard
              key={customer.profile.id}
              customer={customer}
              startOpen={
                customer.profile.id === focusCustomerId ||
                customer.profile.id === createdCustomerId
              }
              preview={preview}
              previewHistory={previewHistoryByCustomerId?.[customer.profile.id]}
              previewReferrals={previewReferralsByCustomerId?.[customer.profile.id]}
              onDeleted={(customerId) => {
                setLoadState((current) => {
                  if (current.status !== "ready") return current;
                  return updateLists(current, (item) =>
                    item.profile.id === customerId ? null : item,
                  );
                });
              }}
              onFrozenChange={(customerId, frozen) => {
                setLoadState((current) => {
                  if (current.status !== "ready") return current;
                  return updateLists(current, (item) =>
                    item.profile.id === customerId ? { ...item, frozen } : item,
                  );
                });
              }}
              onProfileSaved={(profile) => {
                setLoadState((current) => {
                  if (current.status !== "ready") return current;
                  return updateLists(current, (item) =>
                    item.profile.id === profile.id ? { ...item, profile } : item,
                  );
                });
              }}
              onPetSaved={(pet) => {
                setLoadState((current) => {
                  if (current.status !== "ready") return current;
                  return updateLists(current, (item) =>
                    item.profile.id === customer.profile.id
                      ? {
                          ...item,
                          pets: item.pets.map((existing) =>
                            existing.id === pet.id ? pet : existing,
                          ),
                        }
                      : item,
                  );
                });
              }}
              onPetCreated={(pet) => {
                setLoadState((current) => {
                  if (current.status !== "ready") return current;
                  return updateLists(current, (item) =>
                    item.profile.id === customer.profile.id
                      ? { ...item, pets: [...item.pets, pet] }
                      : item,
                  );
                });
              }}
              onPetArchived={(petId) => {
                setLoadState((current) => {
                  if (current.status !== "ready") return current;
                  return updateLists(current, (item) =>
                    item.profile.id === customer.profile.id
                      ? {
                          ...item,
                          pets: item.pets.filter((existing) => existing.id !== petId),
                        }
                      : item,
                  );
                });
              }}
              onPaymentMethodsChange={(methods) => {
                setLoadState((current) => {
                  if (current.status !== "ready") return current;
                  return updateLists(current, (item) =>
                    item.profile.id === customer.profile.id
                      ? { ...item, paymentMethods: methods }
                      : item,
                  );
                });
              }}
            />
    ));
  }

  function renderList(title: string, items: StaffCustomerRecord[], empty: string) {
    return (
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gold-dark">{title}</h3>
        {renderCards(items, empty)}
      </section>
    );
  }

  const existingEmails = [...loadState.admins, ...loadState.customers].map(
    (item) => item.profile.email,
  );

  return (
    <div className="space-y-10">
      {renderList("Administrators", loadState.admins, "No administrator accounts.")}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-lg font-semibold text-gold-dark">
            Create customer profile
          </h3>
          <button
            type="button"
            onClick={addCreateDraft}
            className="shrink-0 rounded-xl border border-lavender/40 px-3 py-2 text-sm text-text-muted hover:border-gold/40 hover:text-text"
          >
            Add+
          </button>
        </div>
        {createDrafts.map((id) => (
          <div
            key={id}
            className="rounded-2xl border border-lavender/30 bg-cream px-5 py-6"
          >
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => removeCreateDraft(id)}
                className="rounded-xl border border-lavender/40 px-3 py-1.5 text-sm text-text-muted hover:border-gold/40 hover:text-text"
              >
                Remove
              </button>
            </div>
            <CreateCustomerProfileForm
              preview={preview}
              existingEmails={existingEmails}
              onCreated={() => removeCreateDraft(id)}
              onSaved={(customer) => {
                setCreatedCustomerId(customer.profile.id);
                setLoadState((current) => {
                  if (current.status !== "ready") return current;
                  const without = current.customers.filter(
                    (item) => item.profile.id !== customer.profile.id,
                  );
                  return {
                    ...current,
                    customers: sortCustomers([...without, customer]),
                  };
                });
              }}
            />
          </div>
        ))}
      </section>
      {renderList("Customers", loadState.customers, "No customer accounts yet.")}
    </div>
  );
}
