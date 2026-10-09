import { ARRIVAL_WINDOW_PENDING_LABEL } from "@/lib/appointments/arrival-window";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  appointmentDetailRows,
  formatAppointmentDateLabel,
} from "@/lib/email/html-templates";
import { buildCustomerLetterEmail } from "@/lib/email/layout";
import { estimateNote } from "@/lib/notifications";
import { formatVisitPetNames } from "@/lib/visits/pet-names";

export type StaffCreatedBookingNotice = {
  firstName: string;
  confirmUrl: string;
  createdAccount: boolean;
  petNames?: string[];
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
    "A card on file is required to secure this appointment. Add one on the review and confirm page if you do not already have one. You are not charged when you confirm. Rabies vaccination details are optional and can be added later.";

  const detailRows = appointmentDetailRows(appointment).map(([label, value]) => {
    if (label === "Pet" && notice.petNames && notice.petNames.length > 1) {
      return [label, formatPetNameList(notice.petNames)] as [string, string];
    }
    return [label, value] as [string, string];
  });

  const text = [
    `Dear ${greetingName},`,
    "",
    introParagraph,
    "",
    ...detailRows.map(([label, value]) => `${label}: ${value}`),
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
      detailRows: detailRows.map(([label, value]) => ({
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
  return formatVisitPetNames(names, "your dog");
}

export function buildStaffCreatedBookingSms(
  appointment: AppointmentRecord,
  confirmUrl: string,
  petNames: string[] = [appointment.petName],
) {
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  const petLabel = formatPetNameList(petNames);
  const when =
    appointment.appointmentTime &&
    appointment.appointmentTime !== ARRIVAL_WINDOW_PENDING_LABEL
      ? `${dateLabel} between ${appointment.appointmentTime}`
      : dateLabel;
  return `K9 Atelier reserved a visit for ${petLabel} on ${when}. Review and confirm, and add a card to secure it: ${confirmUrl} Reply STOP to opt out.`;
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
    "You are not charged when you book. A card on file is required before the visit is secured. Rabies vaccination details are optional.";

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

