import type { AppointmentRecord } from "@/lib/appointments/types";
import { buildCommunicationContext } from "@/lib/communications/context";
import { isCommunicationAccepted } from "@/lib/communications/result";
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

function smsContext(
  notificationType: string,
  appointment: AppointmentRecord,
  phone: string,
) {
  return buildCommunicationContext({
    notificationType,
    recipient: normalizePhoneToE164(phone) ?? phone,
    customerId: appointment.customerId,
    visitId: appointment.visitId ?? null,
    appointmentIds: [appointment.id],
    petIds: [appointment.petId],
  });
}

async function sendCustomerSms(
  notificationType: string,
  appointment: AppointmentRecord,
  phone: string | null | undefined,
  body: string,
): Promise<boolean> {
  try {
    const result = await sendSms({
      to: phone ?? "",
      body,
      communication: smsContext(notificationType, appointment, phone ?? ""),
    });
    return isCommunicationAccepted(result);
  } catch (error) {
    console.error("SMS send failed:", error);
    return false;
  }
}

export async function sendAppointmentSubmittedSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const details = detailsForSms(appointment, customer);
  const body =
    appointment.status === "confirmed"
      ? buildBookingConfirmationSms(details)
      : buildAppointmentSubmittedSms(details);
  return sendCustomerSms(
    appointment.status === "confirmed"
      ? "appointment_confirmed"
      : "appointment_submitted",
    appointment,
    customer.phone,
    body,
  );
}

export async function sendAppointmentConfirmedSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  return sendCustomerSms(
    "appointment_confirmed",
    appointment,
    customer.phone,
    buildBookingConfirmationSms(detailsForSms(appointment, customer)),
  );
}

export async function sendAppointmentDeclinedSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  return sendCustomerSms(
    "appointment_declined",
    appointment,
    customer.phone,
    buildAppointmentDeclinedSms(detailsForSms(appointment, customer)),
  );
}

export async function sendAppointmentStaffCancelledSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  return sendCustomerSms(
    "appointment_staff_cancelled",
    appointment,
    customer.phone,
    buildAppointmentStaffCancelledSms(detailsForSms(appointment, customer)),
  );
}

export async function sendAppointmentReminderSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  return sendCustomerSms(
    "appointment_reminder",
    appointment,
    customer.phone,
    buildAppointmentReminderSms(detailsForSms(appointment, customer)),
  );
}

export async function sendAppointmentConfirmRequestSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  return sendCustomerSms(
    "reminder_3day",
    appointment,
    customer.phone,
    buildAppointmentConfirmRequestSms(detailsForSms(appointment, customer)),
  );
}

export async function sendAppointmentEnRouteSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  return sendCustomerSms(
    "en_route",
    appointment,
    customer.phone,
    buildAppointmentEnRouteSms(detailsForSms(appointment, customer)),
  );
}
