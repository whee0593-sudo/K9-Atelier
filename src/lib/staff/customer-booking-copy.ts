import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  appointmentDetailRows,
  formatAppointmentDateLabel,
} from "@/lib/email/html-templates";
import { buildCustomerLetterEmail } from "@/lib/email/layout";
import { estimateNote } from "@/lib/notifications";

export type StaffCreatedBookingNotice = {
  firstName: string;
  confirmUrl: string;
  createdAccount: boolean;
};

export function buildStaffCreatedBookingEmail(
  appointment: AppointmentRecord,
  notice: StaffCreatedBookingNotice,
) {
  const greetingName = notice.firstName.trim() || "there";
  const subject = "Please confirm your K9 Atelier appointment";
  const introParagraph = notice.createdAccount
    ? "K9 Atelier reserved this grooming visit for you. Open the link below to confirm the appointment and create your password so you can manage it online."
    : "K9 Atelier reserved this grooming visit for you. Open the link below to confirm the appointment.";
  const closingParagraph =
    "You are not charged when you confirm. A card on file is collected later, before or at the visit.";

  const text = [
    `Dear ${greetingName},`,
    "",
    introParagraph,
    "",
    ...appointmentDetailRows(appointment).map(
      ([label, value]) => `${label}: ${value}`,
    ),
    "",
    estimateNote,
    "",
    closingParagraph,
    "",
    `Confirm appointment: ${notice.confirmUrl}`,
  ].join("\n");

  return buildCustomerLetterEmail(
    {
      subject,
      greetingName,
      introParagraph,
      detailRows: appointmentDetailRows(appointment).map(([label, value]) => ({
        label,
        value,
      })),
      estimateNote,
      closingParagraph,
      cta: {
        href: notice.confirmUrl,
        label: "CONFIRM APPOINTMENT",
      },
    },
    text,
  );
}

export function buildStaffCreatedBookingSms(
  appointment: AppointmentRecord,
  confirmUrl: string,
) {
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  return `K9 Atelier reserved a visit for ${appointment.petName} on ${dateLabel} between ${appointment.appointmentTime}. Confirm here: ${confirmUrl} Reply STOP to opt out.`;
}

