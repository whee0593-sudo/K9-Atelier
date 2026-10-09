import { business } from "@/lib/business";
import type { AppointmentRecord } from "@/lib/appointments/types";
import type { AppointmentChangeAction } from "@/lib/appointments/change-policy";
import { buildCommunicationContext } from "@/lib/communications/context";
import {
  bookingDetailsFromAppointment,
  buildCustomerAddDogEmail,
  buildCustomerAppointmentConfirmedEmail,
  buildCustomerAppointmentDeclinedEmail,
  buildCustomerAppointmentStaffCancelledEmail,
  buildCustomerAppointmentSubmittedEmail,
  buildCustomerCancelEmail,
  buildCustomerRemoveDogEmail,
  buildCustomerRescheduleEmail,
  buildStaffNewAppointmentEmail,
} from "@/lib/email/html-templates";
import { sendEmail } from "@/lib/email/resend";
import type { CustomerContact } from "@/lib/email/appointment-context";
import { resolveStaffStatusNoticeKind } from "@/lib/appointments/staff-status-notice";

function emailContext(input: {
  notificationType: string;
  appointment: AppointmentRecord;
  recipient: string;
  audience?: "customer" | "staff";
  appointmentIds?: string[];
  petIds?: string[];
  visitId?: string | null;
  fingerprint?: string;
}) {
  return buildCommunicationContext({
    notificationType: input.notificationType,
    audience: input.audience,
    recipient: input.recipient,
    customerId: input.appointment.customerId,
    visitId: input.visitId ?? input.appointment.visitId ?? null,
    appointmentIds: input.appointmentIds ?? [input.appointment.id],
    petIds: input.petIds ?? [input.appointment.petId],
    fingerprint: input.fingerprint,
  });
}
import {
  sendAppointmentConfirmedSms,
  sendAppointmentDeclinedSms,
  sendAppointmentStaffCancelledSms,
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
    communication: emailContext({
      notificationType: "staff_new_appointment",
      appointment,
      recipient: business.brand.email,
      audience: "staff",
    }),
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
    communication: emailContext({
      notificationType:
        appointment.status === "confirmed"
          ? "appointment_confirmed"
          : "appointment_submitted",
      appointment,
      recipient: customer.email,
    }),
  });
  if (appointment.status === "confirmed") {
    await sendAppointmentConfirmedSms(appointment, customer);
  } else {
    await sendAppointmentSubmittedSms(appointment, customer);
  }
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
    communication: emailContext({
      notificationType: "appointment_confirmed",
      appointment,
      recipient: customer.email,
    }),
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
    communication: emailContext({
      notificationType: "appointment_declined",
      appointment,
      recipient: customer.email,
    }),
  });
  await sendAppointmentDeclinedSms(appointment, customer);
}

export async function notifyCustomerAppointmentStaffCancelled(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const email = buildCustomerAppointmentStaffCancelledEmail(
    appointment,
    customer,
  );

  await sendEmail({
    to: customer.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    communication: emailContext({
      notificationType: "appointment_staff_cancelled",
      appointment,
      recipient: customer.email,
    }),
  });
  await sendAppointmentStaffCancelledSms(appointment, customer);
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
    appointmentIds?: string[];
    petIds?: string[];
    visitId?: string | null;
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

  const related = [
    appointment,
    ...(options?.remainingAppointments ?? []),
  ];
  await sendEmail({
    to: customer.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    communication: emailContext({
      notificationType: `appointment_${action}`,
      appointment,
      recipient: customer.email,
      appointmentIds: options?.appointmentIds ?? related.map((row) => row.id),
      petIds: options?.petIds ?? related.map((row) => row.petId),
      visitId: options?.visitId,
      fingerprint:
        action === "reschedule"
          ? `${appointment.appointmentDate}|${appointment.appointmentTime}`
          : undefined,
    }),
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
  previousStatus?: AppointmentRecord["status"],
) {
  const kind = resolveStaffStatusNoticeKind(status, previousStatus);

  if (kind === "confirmed") {
    await notifyCustomerAppointmentConfirmed(appointment, customer);
    return;
  }

  if (kind === "staff_cancelled") {
    await notifyCustomerAppointmentStaffCancelled(appointment, customer);
    return;
  }

  await notifyCustomerAppointmentDeclined(appointment, customer);
}

export { bookingDetailsFromAppointment };
