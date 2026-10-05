import React from "react";
import { appointmentCornerMark } from "@/lib/appointments/marks";
import type { AppointmentStatus } from "@/lib/appointments/types";
import type { VaccinationBookingStatus } from "@/lib/vaccinations/types";

type Props = {
  status: AppointmentStatus;
  vaccinationStatusAtBooking?: VaccinationBookingStatus | null;
  customerConfirmedAt?: string | null;
  awaitingCustomerConfirm?: boolean;
};

export function AppointmentCornerMark(appointment: Props) {
  const kind = appointmentCornerMark(appointment);

  if (kind === "customer_yes") {
    return (
      <span className="inline-flex rounded-full bg-gold px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white">
        confirm
      </span>
    );
  }

  return null;
}
