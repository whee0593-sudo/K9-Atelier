import Link from "next/link";
import { AdminCancelAppointmentButton } from "@/components/admin/AdminCancelAppointmentButton";
import { CallCustomerButton } from "@/components/admin/CallCustomerButton";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import type { ChargeKind } from "@/lib/charges/types";

export function AppointmentActionLinks({
  appointment,
  paidKinds,
  preview = false,
  onCancelled,
}: {
  appointment: AdminAppointmentRecord;
  paidKinds: ChargeKind[];
  preview?: boolean;
  onCancelled?: () => void;
}) {
  const completed = Boolean(appointment.serviceEndedAt);
  const paidService = paidKinds.includes("service");
  const paidNoShow = paidKinds.includes("no_show");
  const collectBase = preview
    ? "/admin/collect/preview"
    : `/admin/collect/${appointment.id}`;
  const arriveHref = preview
    ? "/admin/arrive/preview"
    : `/admin/arrive/${appointment.id}`;

  return (
    <>
      <CallCustomerButton
        appointmentId={appointment.id}
        disabled={!appointment.customerPhone}
        preview={preview}
      />
      <Link
        href={`/admin/pets?customer=${appointment.customerId}`}
        className="rounded-xl border border-lavender/40 px-4 py-2 text-sm font-medium text-text"
      >
        Customer record
      </Link>
      {appointment.status === "cancelled" ? null : (
        <>
          {completed ? null : (
            <Link
              href={arriveHref}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-medium text-cream"
            >
              {appointment.serviceStartedAt ? "View check-in" : "Check in"}
            </Link>
          )}
          <Link
            href={
              paidService ? `${collectBase}?view=receipt` : collectBase
            }
            className="rounded-xl bg-deep-lavender px-4 py-2 text-sm font-medium text-ivory"
          >
            {paidService ? "View payment" : "Collect payment"}
          </Link>
          {paidService ? (
            <Link
              href={`${collectBase}?view=refund`}
              className="rounded-xl border border-lavender/40 px-4 py-2 text-sm font-medium text-text"
            >
              Refund
            </Link>
          ) : null}
          {completed ? null : (
            <Link
              href={
                preview
                  ? "/admin/collect/preview?kind=no_show"
                  : `${collectBase}?kind=no_show`
              }
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700"
            >
              {paidNoShow ? "No-show charged" : "Charge no-show"}
            </Link>
          )}
          <AdminCancelAppointmentButton
            appointment={appointment}
            preview={preview}
            onCancelled={onCancelled}
          />
        </>
      )}
    </>
  );
}
