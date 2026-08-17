import { business } from "@/lib/business";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  bookingDetailsFromAppointment,
  buildCustomerAppointmentConfirmedEmail,
  buildCustomerAppointmentDeclinedEmail,
  buildCustomerAppointmentSubmittedEmail,
  buildStaffNewAppointmentEmail,
} from "@/lib/email/html-templates";
import { sendEmail } from "@/lib/email/resend";
import type { CustomerContact } from "@/lib/email/appointment-context";
import {
  sendAppointmentConfirmedSms,
  sendAppointmentDeclinedSms,
  sendAppointmentSubmittedSms,
} from "@/lib/sms/appointment-sms";

export async function notifyStaffNewAppointment(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const email = buildStaffNewAppointmentEmail(appointment, customer);

  await sendEmail({
    to: business.brand.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    replyTo: customer.email,
  });
}

export async function notifyCustomerAppointmentSubmitted(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const email =
    appointment.status === "confirmed"
      ? buildCustomerAppointmentConfirmedEmail(appointment, customer)
      : buildCustomerAppointmentSubmittedEmail(appointment, customer);

  await sendEmail({
    to: customer.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  await sendAppointmentSubmittedSms(appointment, customer);
}

export async function notifyCustomerAppointmentConfirmed(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const email = buildCustomerAppointmentConfirmedEmail(appointment, customer);

  await sendEmail({
    to: customer.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  await sendAppointmentConfirmedSms(appointment, customer);
}

export async function notifyCustomerAppointmentDeclined(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const email = buildCustomerAppointmentDeclinedEmail(appointment, customer);

  await sendEmail({
    to: customer.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
  await sendAppointmentDeclinedSms(appointment, customer);
}

export async function sendAppointmentCreatedEmails(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  await notifyStaffNewAppointment(appointment, customer);
  await notifyCustomerAppointmentSubmitted(appointment, customer);
}

export async function sendAppointmentStatusEmails(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  status: "confirmed" | "cancelled",
) {
  if (status === "confirmed") {
    await notifyCustomerAppointmentConfirmed(appointment, customer);
    return;
  }

  await notifyCustomerAppointmentDeclined(appointment, customer);
}

export { bookingDetailsFromAppointment };
