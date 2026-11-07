import { appointmentNeedsAddress, MISSING_BOOKING_ADDRESS_MESSAGE } from "./booking-address";
import { ARRIVAL_WINDOW_PENDING_LABEL } from "@/lib/appointments/arrival-window";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  appointmentDetailRows,
  formatAppointmentDateLabel,
} from "@/lib/email/html-templates";
import { buildCustomerLetterEmail } from "@/lib/email/layout";
import { estimateNote } from "@/lib/notifications";
import { formatPrice } from "@/lib/business";
import { customerAppointmentServiceLines, customerVisitEstimate } from "@/lib/appointments/customer-visits";
import { formatEstimatedDuration } from "@/lib/staff/schedule-conflict";
import { formatMinutesLabel } from "@/lib/appointments/closures";

export function staffCreatedVisitDetailRows(appointment: AppointmentRecord, siblings: AppointmentRecord[]) {
  const pets = [appointment, ...siblings.filter((pet) => pet.id !== appointment.id)].filter((pet) => pet.id === appointment.id || (
    appointment.visitId && pet.visitId === appointment.visitId &&
    pet.customerId === appointment.customerId && pet.appointmentDate === appointment.appointmentDate
  )).filter((pet) => pet.status !== "cancelled");
  const ordered = [...pets].sort((a, b) => (a.scheduledStart ?? 1440) - (b.scheduledStart ?? 1440));
  const first = ordered[0] ?? appointment;
  const time = first.scheduledStart == null ? first.appointmentTime : formatMinutesLabel(first.scheduledStart);
  const duration = ordered.length > 0 && ordered.every((pet) => (pet.estimatedDurationMinutes ?? 0) > 0)
    ? formatEstimatedDuration(ordered.reduce((sum, pet) => sum + pet.estimatedDurationMinutes!, 0))
    : "To be confirmed";
  const address = appointmentNeedsAddress(appointment) ? "Please add your address using the confirmation link." : appointmentDetailRows(appointment).find(([label]) => label === "Address")![1];
  const rows: Array<[string, string]> = [
    ["Date & Time", `${formatAppointmentDateLabel(first.appointmentDate)} · ${time}`],
    ["Estimated Service Duration", duration],
    ["Address", address],
  ];
  const byPet = new Map<string, AppointmentRecord[]>();
  for (const entry of ordered) {
    const key = entry.petId || entry.id;
    byPet.set(key, [...(byPet.get(key) ?? []), entry]);
  }
  for (const services of byPet.values()) {
    const pet = services[0]!;
    rows.push(["Pet", `${pet.petName}${pet.petBreed ? ` (${pet.petBreed})` : ""}`]);
    rows.push(["Services", services.flatMap((service) => customerAppointmentServiceLines(service).map((line) => line.name)).join(" · ")]);
  }
  // Stored appointment estimates already include their allocated share of travel.
  const travelFee = ordered.reduce((sum, pet) => sum + Math.round(pet.travelFee * 100), 0) / 100;
  if (travelFee > 0) rows.push(["Travelling Fee", formatPrice(travelFee)]);
  const total = customerVisitEstimate(ordered);
  rows.push(["Estimated Total", total == null ? "To be confirmed" : `From ${formatPrice(total)}${appointmentNeedsAddress(appointment) ? " · Travel fee to be calculated after your address is added" : ""}`]);
  return rows;
}

export type StaffCreatedBookingNotice = {
  firstName: string;
  confirmUrl: string;
  createdAccount: boolean;
  requiresProfileCompletion?: boolean;
  requiresAddress?: boolean;
};

export function buildStaffCreatedBookingEmail(
  appointment: AppointmentRecord,
  notice: StaffCreatedBookingNotice,
  appointments: AppointmentRecord[] = [appointment],
) {
  const visitRows = staffCreatedVisitDetailRows(appointment, appointments);
  const confirmUrl = new URL(notice.confirmUrl);
  const needsAddress = notice.requiresAddress || appointmentNeedsAddress(appointment);
  confirmUrl.pathname = needsAddress ? "/confirm-account" : "/confirm-account/appointment";
  confirmUrl.hash = "";
  const greetingName = notice.firstName.trim() || "there";
  const subject = "Please confirm your K9 Atelier appointment";
  const introParagraph = "Please review the details of your appointment with K9 Atelier and click the button below to confirm.";
  const closingParagraph = needsAddress ? MISSING_BOOKING_ADDRESS_MESSAGE : "";

  const text = [
    `Dear ${greetingName},`,
    "",
    introParagraph,
    "",
    ...visitRows.map(
      ([label, value]) => `${label}: ${value}`,
    ),
    "",
    estimateNote,
    "",
    closingParagraph,
    "",
    `Confirm: ${confirmUrl.toString()}`,
  ].join("\n");

  return buildCustomerLetterEmail(
    {
      subject,
      greetingName,
      introParagraph,
      detailRows: visitRows.map(([label, value]) => ({
        label,
        value,
      })),
      estimateNote,
      closingParagraph,
      cta: {
        href: confirmUrl.toString(),
        label: "Confirm",
        variant: "primary",
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
  _confirmUrl: string,
  petNames: string[] = [appointment.petName],
  _profileNotice?: {firstName: string; requiresProfileCompletion: boolean; requiresAddress?: boolean},
) {
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  const petLabel = formatPetNameList(petNames);
  const time = appointment.scheduledStart == null ? appointment.appointmentTime : formatMinutesLabel(appointment.scheduledStart);
  const when =
    time && time !== ARRIVAL_WINDOW_PENDING_LABEL
      ? `${dateLabel} ${time}`
      : dateLabel;
  if (_profileNotice?.requiresAddress || appointmentNeedsAddress(appointment)) return `K9 Atelier reserved an appointment for ${petLabel} on ${when}. Please add your service address and complete your appointment details: ${_confirmUrl} Reply STOP to opt out.`;
  return `K9 Atelier reserved an appointment for ${petLabel} on ${when}. Please reply C to confirm your appointment. Reply STOP to opt out.`;
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

