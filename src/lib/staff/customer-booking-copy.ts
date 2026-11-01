import { ARRIVAL_WINDOW_PENDING_LABEL } from "@/lib/appointments/arrival-window";
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
  requiresProfileCompletion?: boolean;
};

export function buildStaffCreatedBookingEmail(
  appointment: AppointmentRecord,
  notice: StaffCreatedBookingNotice,
) {
  if (notice.requiresProfileCompletion) {
    const greetingName = notice.firstName.trim() || "there";
    const subject = "Please complete your profile to confirm your appointment";
    const introParagraph = "Your appointment is not confirmed yet because some required information is missing. Please click the button below to complete your profile.";
    const closingParagraph = "";
    const detailRows = appointmentDetailRows(appointment).map(([label,value]) => ({label,value:label === "Address" ? [appointment.addressStreet, appointment.addressCity].filter(Boolean).join(", ") : value}));
    const text = [`Hi ${greetingName},`, "", introParagraph, "", ...detailRows.map(({label,value}) => `${label}: ${value}`), "", closingParagraph, "", `Complete profile & confirm appointment: ${notice.confirmUrl}`].join("\n");
    return buildCustomerLetterEmail({subject,greetingName,greeting:"Hi",introParagraph,detailRows,estimateNote:"",closingParagraph,cta:{href:notice.confirmUrl,label:"Complete profile & confirm appointment"}},text);
  }
  const greetingName = notice.firstName.trim() || "there";
  const subject = "Please confirm your K9 Atelier appointment";
  const introParagraph = "K9 Atelier reserved this grooming visit for you. Please reply C to our appointment text message to confirm.";
  const closingParagraph =
    "You can use the link below to review your details, set up your account, or add a payment method. To confirm online, review your details, add a card if needed, and select Save & confirm appointment. Rabies vaccination details are optional and can be added later.";

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
    `Review details: ${notice.confirmUrl}`,
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
        label: "Review Details",
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
  profileNotice?: {firstName: string; requiresProfileCompletion: boolean},
) {
  if (profileNotice?.requiresProfileCompletion) {
    const name = profileNotice.firstName.trim() || "there";
    return `K9 ATELIER: Hi ${name}, your appointment for ${formatPetNameList(petNames)} is not confirmed yet because some required information is missing. Please use the link below to complete your profile and confirm your appointment.\n\n${confirmUrl}\n\nReply STOP to opt out.`;
  }
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  const petLabel = formatPetNameList(petNames);
  const when =
    appointment.appointmentTime &&
    appointment.appointmentTime !== ARRIVAL_WINDOW_PENDING_LABEL
      ? `${dateLabel} between ${appointment.appointmentTime}`
      : dateLabel;
  return `K9 Atelier reserved a visit for ${petLabel} on ${when}. Please reply C to confirm your appointment. Or save your details and confirm online: ${confirmUrl} Reply STOP to opt out.`;
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

