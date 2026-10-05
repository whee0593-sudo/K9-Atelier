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
    "You are not charged when you confirm. After confirming, open your account to confirm rabies vaccination status and add a card on file. You may also upload a current rabies certificate or vaccination record.";

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
    `Review and confirm: ${notice.confirmUrl}`,
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
        label: "Review and Confirm",
      },
    },
    text,
  );
}

function formatPetNameList(names: string[]) {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  if (cleaned.length === 0) return "your dog";
  if (cleaned.length === 1) return cleaned[0]!;
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

export function buildStaffCreatedBookingSms(
  appointment: AppointmentRecord,
  confirmUrl: string,
  petNames: string[] = [appointment.petName],
) {
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  const petLabel = formatPetNameList(petNames);
  return `K9 Atelier reserved a visit for ${petLabel} on ${dateLabel} between ${appointment.appointmentTime}. Review and confirm: ${confirmUrl} Reply STOP to opt out.`;
}

export type StaffBookingInviteNotice = {
  firstName: string;
  bookUrl: string;
  createdAccount: boolean;
};

export function buildStaffBookingInviteEmail(notice: StaffBookingInviteNotice) {
  const greetingName = notice.firstName.trim() || "there";
  const subject = "Complete your K9 Atelier booking";
  const introParagraph = notice.createdAccount
    ? "K9 Atelier started a booking for you. Open the link below to enter your dog details, choose a service time, and finish your reservation."
    : "K9 Atelier invited you to finish booking online. Open the link below to enter your details and reserve a visit.";
  const closingParagraph =
    "You are not charged when you book. After booking, you can confirm rabies vaccination status and add a card on file in your account.";

  const text = [
    `Dear ${greetingName},`,
    "",
    introParagraph,
    "",
    closingParagraph,
    "",
    `Complete booking: ${notice.bookUrl}`,
  ].join("\n");

  return buildCustomerLetterEmail(
    {
      subject,
      greetingName,
      introParagraph,
      detailRows: [],
      estimateNote: "",
      closingParagraph,
      cta: {
        href: notice.bookUrl,
        label: "COMPLETE BOOKING",
      },
    },
    text,
  );
}

export function buildStaffBookingInviteSms(bookUrl: string) {
  return `K9 Atelier: Finish booking your visit here: ${bookUrl} Reply STOP to opt out.`;
}

