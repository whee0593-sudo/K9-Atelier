import type { AppointmentRecord } from "@/lib/appointments/types";
import type { CustomerContact } from "@/lib/email/appointment-context";
import { bookingDetailsFromAppointment } from "@/lib/email/html-templates";
import {
  buildAppointmentConfirmRequestSms,
  buildAppointmentDeclinedSms,
  buildAppointmentEnRouteSms,
  buildAppointmentReminderSms,
  buildAppointmentSubmittedSms,
  buildBookingConfirmationSms,
  type BookingConfirmationDetails,
} from "@/lib/notifications";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
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
  };
}

async function sendCustomerSms(
  phone: string | null | undefined,
  body: string,
): Promise<boolean> {
  const to = phone ? normalizePhoneToE164(phone) : null;
  if (!to) {
    console.warn("SMS skipped: missing or invalid customer phone");
    return false;
  }

  try {
    return await sendSms({ to, body });
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
  return sendCustomerSms(customer.phone, body);
}

export async function sendAppointmentConfirmedSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  return sendCustomerSms(
    customer.phone,
    buildBookingConfirmationSms(detailsForSms(appointment, customer)),
  );
}

export async function sendAppointmentDeclinedSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  return sendCustomerSms(
    customer.phone,
    buildAppointmentDeclinedSms(detailsForSms(appointment, customer)),
  );
}

export async function sendAppointmentReminderSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  return sendCustomerSms(
    customer.phone,
    buildAppointmentReminderSms(detailsForSms(appointment, customer)),
  );
}

export async function sendAppointmentConfirmRequestSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  return sendCustomerSms(
    customer.phone,
    buildAppointmentConfirmRequestSms(detailsForSms(appointment, customer)),
  );
}

export async function sendAppointmentEnRouteSms(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  return sendCustomerSms(
    customer.phone,
    buildAppointmentEnRouteSms(detailsForSms(appointment, customer)),
  );
}
