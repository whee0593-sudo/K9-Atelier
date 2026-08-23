import { appointmentCornerMark } from "@/lib/appointments/marks";
import type { AppointmentStatus } from "@/lib/appointments/types";
import type { VaccinationBookingStatus } from "@/lib/vaccinations/types";

type Props = {
  status: AppointmentStatus;
  vaccinationStatusAtBooking?: VaccinationBookingStatus | null;
  customerConfirmedAt?: string | null;
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

  if (kind === "vaccination_alert") {
    return (
      <span
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-sm font-bold leading-none text-white"
        title="Vaccination not approved — appointment is not booked"
        aria-label="Vaccination not approved"
      >
        !
      </span>
    );
  }

  return null;
}
