"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CustomerProfileForm } from "@/components/account/CustomerProfileForm";
import type { CustomerProfile } from "@/lib/profiles/types";
import type { StaffCustomerRecord } from "@/lib/profiles/staff-service";
import {
  customerDeleteConfirmMessage,
  customerFreezeConfirmMessage,
} from "@/lib/profiles/delete-guard";
import { isOwnerEmail } from "@/lib/staff/owner";
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

function customerLabel(profile: CustomerProfile) {
  const name = `${profile.firstName} ${profile.lastName}`.trim();
  return name || profile.email;
}

function bookForCustomerHref(profile: CustomerProfile) {
  const params = new URLSearchParams();
  if (profile.email) params.set("email", profile.email);
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

function uniqueServiceAddresses(
  appointments: StaffCustomerHistory["appointments"],
) {
  const seen = new Set<string>();
  const addresses: string[] = [];
  for (const appointment of appointments) {
    const label = formatAppointmentAddress(appointment);
    if (!label || seen.has(label)) continue;
    seen.add(label);
    addresses.push(label);
  }
  return addresses;
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

  if (!open) return null;

  const addresses = history ? uniqueServiceAddresses(history.appointments) : [];

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
        <p className="mt-2 text-sm text-text-muted">
          Guests do not keep a saved address book. Addresses come from booked
          visits. Use Book for customer to add or change a visit address.
        </p>
        {!history ? (
          <p className="mt-3 text-sm text-text-muted">Loading addresses…</p>
        ) : addresses.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">
            No visit addresses yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm text-text">
            {addresses.map((address) => (
              <li
                key={address}
                className="rounded-xl border border-lavender/30 px-4 py-3"
              >
                {address}
              </li>
            ))}
          </ul>
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
  const roleLabel = isOwnerEmail(customer.profile.email)
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
          <p className="font-medium text-text">{customerLabel(customer.profile)}</p>
          <p className="mt-1 text-sm text-text-muted">
            {roleLabel}
            {customer.frozen ? " · Frozen" : ""}
            {" · "}
            {customer.profile.email}
            {customer.profile.phone ? ` · ${customer.profile.phone}` : ""}
          </p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {customer.kind === "customer" && !customer.frozen ? (
            <a
              href={bookForCustomerHref(customer.profile)}
              className="rounded-xl border border-lavender/40 px-3 py-2 text-sm text-text-muted hover:border-gold/40 hover:text-text"
            >
              Book for customer
            </a>
          ) : null}
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
                    href={bookForCustomerHref(customer.profile)}
                    className="rounded-xl border border-lavender/40 px-3 py-2 text-sm text-text-muted hover:border-gold/40 hover:text-text"
                  >
                    Book for customer
                  </a>
                ) : null}
                <CallCustomerButton
                  customerId={customer.profile.id}
                  disabled={!customer.profile.phone}
                  preview={preview}
                />
                {renderOwnerActions()}
              </div>
            </div>
            <div className="mt-4">
              <CustomerProfileForm
                profile={customer.profile}
                saveUrl={`/api/admin/customers/${customer.profile.id}`}
                onSaved={onProfileSaved}
                audience="staff"
                preview={preview}
              />
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
                ? bookForCustomerHref(customer.profile)
                : undefined
            }
          />
          <StaffCustomerPets
            customerId={customer.profile.id}
            pets={customer.pets}
            preview={preview}
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
              <p className="mt-2 text-sm text-text-muted">
                Freeze blocks sign-in. Delete permanently removes this login,
                pet profiles, cards on file, and appointment history.
              </p>
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
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

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

  function renderList(title: string, items: StaffCustomerRecord[], empty: string) {
    return (
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-gold-dark">{title}</h3>
        {items.length === 0 ? (
          <p className="text-sm text-text-muted">{empty}</p>
        ) : (
          items.map((customer) => (
            <CustomerRecordCard
              key={customer.profile.id}
              customer={customer}
              startOpen={customer.profile.id === focusCustomerId}
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
          ))
        )}
      </section>
    );
  }

  return (
    <div className="space-y-10">
      {renderList("Administrators", loadState.admins, "No administrator accounts.")}
      {renderList("Customers", loadState.customers, "No customer accounts yet.")}
    </div>
  );
}
