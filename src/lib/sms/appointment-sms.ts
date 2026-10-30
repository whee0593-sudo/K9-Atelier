import type { AppointmentRecord } from "@/lib/appointments/types";
import { buildCommunicationContext } from "@/lib/communications/context";
import { communicationToDelivery } from "@/lib/communications/delivery";
import type { CustomerContact } from "@/lib/email/appointment-context";
import { bookingDetailsFromAppointment } from "@/lib/email/html-templates";
import {
  buildAppointmentConfirmRequestSms,
  buildAppointmentDeclinedSms,
  buildAppointmentEnRouteSms,
  buildAppointmentReminderSms,
  buildAppointmentStaffCancelledSms,
  buildAppointmentSubmittedSms,
  buildBookingConfirmationSms,
  type BookingConfirmationDetails,
} from "@/lib/notifications";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { streetNameForSms } from "@/lib/sms/street-name";
import { sendSms } from "@/lib/sms/twilio";
import { formatVisitPetNames } from "@/lib/visits/pet-names";
import type { ProviderDelivery } from "@/lib/visits/provider-delivery";

function smsCustomerName(customer: CustomerContact) {
  const first = customer.firstName?.trim();
  if (first) return first;
  const full = customer.name?.trim();
  if (!full) return undefined;
  return full.split(/\s+/)[0];
}

function detailsForSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
): BookingConfirmationDetails {
  return {
    ...bookingDetailsFromAppointment(appointment, customer),
    customerName: smsCustomerName(customer),
    streetName: streetNameForSms(appointment.addressStreet),
  };
}

function logisticsContext(
  notificationType: string,
  appointment: AppointmentRecord,
  phone: string,
  scope?: { appointmentIds?: string[]; petIds?: string[]; fingerprint?: string },
) {
  const appointmentIds = scope?.appointmentIds?.length
    ? scope.appointmentIds
    : [appointment.id];
  const petIds = scope?.petIds?.length ? scope.petIds : [appointment.petId];
  return buildCommunicationContext({
    notificationType,
    recipient: phone,
    customerId: appointment.customerId,
    visitId: appointment.visitId ?? null,
    appointmentIds,
    petIds,
    dedupe: appointment.visitId ? "visit" : "appointment",
    fingerprint: scope?.fingerprint,
    allowSendWithoutSnapshot: notificationType === "booking_confirmation",
  });
}

async function sendCustomerSms(
  notificationType: string,
  appointment: AppointmentRecord,
  phone: string | null | undefined,
  body: string,
  scope?: { appointmentIds?: string[]; petIds?: string[]; fingerprint?: string },
): Promise<ProviderDelivery> {
  const to = phone ? normalizePhoneToE164(phone) : null;
  if (!to) {
    console.warn("SMS skipped: missing or invalid customer phone");
    return "rejected";
  }

  try {
    return communicationToDelivery(
      await sendSms({
        to,
        body,
        communication: logisticsContext(notificationType, appointment, to, scope),
      }),
    );
  } catch (error) {
    console.error("SMS send failed:", error);
    return "uncertain";
  }
}

function namedDetails(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  petNames?: string[],
) {
  const details = detailsForSms(appointment, customer);
  if (petNames && petNames.length > 0) {
    details.petName = formatVisitPetNames(petNames, details.petName);
  }
  return details;
}

export async function sendAppointmentSubmittedSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  petNames?: string[],
) {
  const details = namedDetails(appointment, customer, petNames);
  const confirmed = appointment.status === "confirmed";
  const body = confirmed
    ? buildBookingConfirmationSms(details)
    : buildAppointmentSubmittedSms(details);
  return sendCustomerSms(
    confirmed ? "booking_confirmation" : "appointment_submitted",
    appointment,
    customer.phone,
    body,
  );
}

export async function sendAppointmentConfirmedSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  petNames?: string[],
  fingerprint?: string,
) {
  return sendCustomerSms(
    "booking_confirmation",
    appointment,
    customer.phone,
    buildBookingConfirmationSms(namedDetails(appointment, customer, petNames)),
    fingerprint ? { fingerprint } : undefined,
  );
}

export async function sendAppointmentDeclinedSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  petName?: string,
) {
  const details = detailsForSms(appointment, customer);
  if (petName) details.petName = petName;
  return sendCustomerSms(
    "staff_declined",
    appointment,
    customer.phone,
    buildAppointmentDeclinedSms(details),
  );
}

export async function sendAppointmentStaffCancelledSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  petName?: string,
) {
  const details = detailsForSms(appointment, customer);
  if (petName) details.petName = petName;
  return sendCustomerSms(
    "staff_cancelled",
    appointment,
    customer.phone,
    buildAppointmentStaffCancelledSms(details),
  );
}

export async function sendAppointmentReminderSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  petNames?: string[],
  scope?: { appointmentIds?: string[]; petIds?: string[] },
) {
  return sendCustomerSms(
    "appointment_reminder",
    appointment,
    customer.phone,
    buildAppointmentReminderSms(namedDetails(appointment, customer, petNames)),
    scope,
  );
}

export async function sendAppointmentConfirmRequestSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  petNames?: string[],
  scope?: { appointmentIds?: string[]; petIds?: string[] },
) {
  return sendCustomerSms(
    "confirm_reminder_3_day",
    appointment,
    customer.phone,
    buildAppointmentConfirmRequestSms(namedDetails(appointment, customer, petNames)),
    scope,
  );
}

export async function sendAppointmentEnRouteSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  petNames?: string[],
  scope?: { appointmentIds?: string[]; petIds?: string[] },
) {
  return sendCustomerSms(
    "en_route",
    appointment,
    customer.phone,
    buildAppointmentEnRouteSms(namedDetails(appointment, customer, petNames)),
    scope,
  );
}
