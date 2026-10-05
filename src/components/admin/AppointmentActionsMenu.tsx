"use client";

import React, { useEffect, useId } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AdminCancelAppointmentButton } from "@/components/admin/AdminCancelAppointmentButton";
import { AdminRescheduleAppointmentButton } from "@/components/admin/AdminRescheduleAppointmentButton";
import { CallCustomerButton } from "@/components/admin/CallCustomerButton";
import { formatFullDate } from "@/lib/appointments/availability-blocks";
import { appointmentStatusLabel } from "@/lib/appointments/map";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { formatPrice } from "@/lib/business";
import type { ChargeKind } from "@/lib/charges/types";
import { formatServiceAddress } from "@/lib/travel";
import { vaccinationStatusLabel } from "@/lib/vaccinations/booking";

const menuItemClass =
  "flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm text-text hover:bg-lavender-light";

export function customerTextHref(input: {
  preview?: boolean;
  customerId: string;
  phone: string | null;
}) {
  const params = new URLSearchParams();
  if (input.customerId) params.set("customer", input.customerId);
  if (input.phone) params.set("phone", input.phone);
  const path = input.preview ? "/admin/messages/preview" : "/admin/messages";
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function customerLabel(appointment: AdminAppointmentRecord) {
  return (
    appointment.customerName?.trim() ||
    appointment.customerEmail?.trim() ||
    "Customer"
  );
}

function formatWeight(weight: number | null | undefined) {
  if (typeof weight !== "number") return "—";
  return `${weight} lb`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-text-muted">{label}</dt>
      <dd className="[overflow-wrap:anywhere]">{value || "—"}</dd>
    </div>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
}

export function AppointmentActionsMenu({
  appointment,
  variant,
  top,
  left,
  preview = false,
  paidKinds = [],
  panel = "actions",
  onClose,
  onChanged,
  onCancelled,
}: {
  appointment: AdminAppointmentRecord;
  variant: "popover" | "sheet";
  top: number;
  left: number;
  preview?: boolean;
  paidKinds?: ChargeKind[];
  panel?: "actions" | "details" | "contact";
  onClose: () => void;
  onChanged?: (next?: { date: string; slotStartMinutes: number }) => void;
  onCancelled?: () => void;
}) {
  const titleId = useId();
  const [view, setView] = React.useState(panel);
  useEscape(onClose);

  const paidService = paidKinds.includes("service");
  const collectBase = preview
    ? "/admin/collect/preview"
    : `/admin/collect/${appointment.id}`;
  const phone = appointment.customerPhone?.trim() || "";
  const email = appointment.customerEmail?.trim() || "";
  const textHref = customerTextHref({
    preview,
    customerId: appointment.customerId,
    phone: phone || null,
  });

  const summary = (
    <dl className="mt-3 space-y-2 text-sm text-text">
      <DetailRow label="Customer" value={customerLabel(appointment)} />
      <DetailRow label="Pet" value={appointment.petName} />
      <DetailRow label="Service" value={appointment.serviceName} />
      <DetailRow label="Date" value={formatFullDate(appointment.appointmentDate)} />
      <DetailRow label="Arrival window" value={appointment.appointmentTime} />
      <DetailRow
        label="Status"
        value={appointmentStatusLabel(
          appointment.status,
          appointment.awaitingCustomerConfirm,
        )}
      />
    </dl>
  );

  const body =
    view === "details" ? (
      <>
        <h3 id={titleId} className="text-base font-medium text-gold-dark">
          Appointment details
        </h3>
        <dl className="mt-3 space-y-2 text-sm text-text">
          <DetailRow label="Customer" value={customerLabel(appointment)} />
          <DetailRow label="Phone" value={phone} />
          <DetailRow label="Email" value={email} />
          <DetailRow label="Pet" value={appointment.petName} />
          <DetailRow label="Breed" value={appointment.petBreed} />
          <DetailRow label="Weight" value={formatWeight(appointment.petWeightLbs)} />
          <DetailRow label="Service" value={appointment.serviceName} />
          <DetailRow
            label="Requested date"
            value={formatFullDate(appointment.appointmentDate)}
          />
          <DetailRow label="Arrival window" value={appointment.appointmentTime} />
          <DetailRow
            label="Address"
            value={formatServiceAddress({
              street: appointment.addressStreet,
              city: appointment.addressCity,
              state: appointment.addressState,
              zip: appointment.addressZip,
            })}
          />
          <DetailRow label="Travel fee" value={formatPrice(appointment.travelFee)} />
          <DetailRow
            label="Vaccination status"
            value={
              appointment.vaccinationStatusAtBooking
                ? vaccinationStatusLabel(appointment.vaccinationStatusAtBooking)
                : "—"
            }
          />
          <DetailRow
            label="Appointment status"
            value={appointmentStatusLabel(
              appointment.status,
              appointment.awaitingCustomerConfirm,
            )}
          />
        </dl>
        <button
          type="button"
          className={`${menuItemClass} mt-4 border border-lavender/40`}
          onClick={() => setView("actions")}
        >
          Back
        </button>
      </>
    ) : view === "contact" ? (
      <>
        <h3 id={titleId} className="text-base font-medium text-gold-dark">
          Contact Customer
        </h3>
        <p className="mt-1 text-sm text-text-muted">{customerLabel(appointment)}</p>
        <div className="mt-3 grid gap-1">
          <CallCustomerButton
            appointmentId={appointment.id}
            customerId={appointment.customerId}
            phone={phone}
            label="Call"
            disabled={!phone}
            preview={preview}
            className="min-h-11 w-full"
            fullWidth
          />
          {phone ? (
            <Link href={textHref} className={menuItemClass} data-appointment-action="text">
              Text
            </Link>
          ) : (
            <button type="button" className={menuItemClass} disabled>
              Text
            </button>
          )}
          {email ? (
            <a href={`mailto:${email}`} className={menuItemClass} data-appointment-action="email">
              Email
            </a>
          ) : (
            <button type="button" className={menuItemClass} disabled>
              Email
            </button>
          )}
        </div>
        <button
          type="button"
          className={`${menuItemClass} mt-2 border border-lavender/40`}
          onClick={() => setView("actions")}
        >
          Back
        </button>
      </>
    ) : (
      <>
        <h3 id={titleId} className="text-base font-medium text-gold-dark">
          Appointment Actions
        </h3>
        {summary}
        <div className="mt-3 grid gap-1">
          <button
            type="button"
            data-appointment-action="view-details"
            className={menuItemClass}
            onClick={() => setView("details")}
          >
            View Details
          </button>
          <AdminRescheduleAppointmentButton
            appointment={appointment}
            preview={preview}
            onChanged={onChanged}
            label="Reschedule"
            dialogTitle="Reschedule"
            limitToOpenSlots
            triggerClassName={menuItemClass}
          />
          <button
            type="button"
            data-appointment-action="contact"
            className={menuItemClass}
            onClick={() => setView("contact")}
          >
            Contact Customer
          </button>
          {appointment.status === "cancelled" ? null : (
            <Link
              href={paidService ? `${collectBase}?view=receipt` : collectBase}
              className={menuItemClass}
            >
              {paidService ? "View payment" : "Collect payment"}
            </Link>
          )}
          <AdminCancelAppointmentButton
            appointment={appointment}
            preview={preview}
            onCancelled={onCancelled}
            confirmTitle="Cancel Appointment?"
            showService
            showReason
            sheetOnMobile
            triggerClassName={`${menuItemClass} text-red-700`}
          />
        </div>
      </>
    );

  const panelNode =
    variant === "sheet" ? (
      <div
        className="fixed inset-0 z-[100] flex items-end bg-ink/40"
        data-variant="sheet"
        data-appointment-actions
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex max-h-[90dvh] min-h-0 w-full max-w-full flex-col overflow-y-auto overscroll-contain rounded-t-2xl border border-lavender/40 bg-cream px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-sm"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-lavender" />
          {body}
        </div>
      </div>
    ) : (
      <div
        className="fixed inset-0 z-[100]"
        data-variant="popover"
        data-appointment-actions
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          style={{ top, left, width: 300, maxWidth: "calc(100vw - 24px)" }}
          className="absolute max-h-[80vh] overflow-y-auto rounded-2xl border border-lavender/40 bg-cream p-3 shadow-sm"
          onClick={(event) => event.stopPropagation()}
        >
          {body}
        </div>
      </div>
    );

  if (typeof document === "undefined") return panelNode;
  return createPortal(panelNode, document.body);
}
