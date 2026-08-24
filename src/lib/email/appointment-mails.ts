import { business } from "@/lib/business";
import type { AppointmentRecord } from "@/lib/appointments/types";
import type { AppointmentChangeAction } from "@/lib/appointments/change-policy";
import {
  bookingDetailsFromAppointment,
  buildCustomerAddDogEmail,
  buildCustomerAppointmentConfirmedEmail,
  buildCustomerAppointmentDeclinedEmail,
  buildCustomerAppointmentSubmittedEmail,
  buildCustomerCancelEmail,
  buildCustomerRemoveDogEmail,
  buildCustomerRescheduleEmail,
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

export async function notifyCustomerAppointmentChange(
  action: AppointmentChangeAction,
  appointment: AppointmentRecord,
  customer: CustomerContact,
  options?: {
    petNames?: string[];
    serviceLabels?: string[];
    remainingAppointments?: AppointmentRecord[];
    remainingUpdated?: boolean;
    manageAppointmentId?: string | null;
    fee?: number;
    feeStatus?: "none" | "paid" | "processing" | "failed";
    cardBrand?: string | null;
    cardLast4?: string | null;
    paymentFailureKind?: "declined" | "expired" | "unavailable" | null;
    willAutoRetry?: boolean;
    paymentUpdateUrl?: string | null;
  },
) {
  const email =
    action === "reschedule"
      ? buildCustomerRescheduleEmail({
          appointment,
          customer,
          petNames: options?.petNames,
          serviceLabels: options?.serviceLabels,
          fee: options?.fee,
        })
      : action === "cancel"
        ? buildCustomerCancelEmail({
            appointment,
            customer,
            petNames: options?.petNames,
            fee: options?.fee,
            feeStatus: options?.feeStatus,
            cardBrand: options?.cardBrand,
            cardLast4: options?.cardLast4,
            paymentFailureKind: options?.paymentFailureKind,
            willAutoRetry: options?.willAutoRetry,
            paymentUpdateUrl: options?.paymentUpdateUrl,
          })
        : action === "remove_dog"
          ? buildCustomerRemoveDogEmail({
              appointment,
              customer,
              remainingAppointments: options?.remainingAppointments,
              remainingUpdated: options?.remainingUpdated,
              manageAppointmentId: options?.manageAppointmentId,
              fee: options?.fee,
              feeStatus: options?.feeStatus,
              cardBrand: options?.cardBrand,
              cardLast4: options?.cardLast4,
            })
          : buildCustomerAddDogEmail({ appointment, customer });

  await sendEmail({
    to: customer.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
  });
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
