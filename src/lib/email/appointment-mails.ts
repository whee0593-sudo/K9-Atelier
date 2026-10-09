import { business } from "@/lib/business";
import type { AppointmentRecord } from "@/lib/appointments/types";
import type { AppointmentChangeAction } from "@/lib/appointments/change-policy";
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
import {
  sendAppointmentConfirmedSms,
  sendAppointmentDeclinedSms,
  sendAppointmentStaffCancelledSms,
  sendAppointmentSubmittedSms,
} from "@/lib/sms/appointment-sms";
import { runVisitNotification } from "@/lib/visits/notification-ledger";
import {
  planStaffStatusNotice,
  rescheduleNotificationEvent,
  type VisitNoticePet,
} from "@/lib/visits/notification-scope";

export type VisitCustomerCopy = {
  petNames?: string[];
  serviceNames?: string[];
};

function copyFromPets(pets: VisitNoticePet[]): VisitCustomerCopy {
  return {
    petNames: pets.map((pet) => pet.petName),
    serviceNames: pets.map((pet) => `${pet.petName} · ${pet.serviceName}`),
  };
}

async function deliverEmailAndSms(
  email: { subject: string; text: string; html: string },
  customer: CustomerContact,
  sendText: () => Promise<boolean>,
) {
  let emailed = false;
  let texted = false;
  try {
    emailed = await sendEmail({
      to: customer.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } catch (error) {
    console.error("visit customer email failed:", error);
  }
  try {
    texted = await sendText();
  } catch (error) {
    console.error("visit customer SMS failed:", error);
  }
  return emailed || texted;
}

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
  copy?: VisitCustomerCopy,
) {
  const email =
    appointment.status === "confirmed"
      ? buildCustomerAppointmentConfirmedEmail(appointment, customer, copy)
      : buildCustomerAppointmentSubmittedEmail(appointment, customer);

  await runVisitNotification({
    visitId: appointment.visitId,
    event: "booking_confirmation",
    send: () =>
      deliverEmailAndSms(email, customer, () =>
        appointment.status === "confirmed"
          ? sendAppointmentConfirmedSms(appointment, customer, copy?.petNames)
          : sendAppointmentSubmittedSms(appointment, customer),
      ),
  });
}

export async function notifyCustomerAppointmentConfirmed(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  copy?: VisitCustomerCopy,
) {
  const email = buildCustomerAppointmentConfirmedEmail(appointment, customer, copy);

  await runVisitNotification({
    visitId: appointment.visitId,
    event: "staff_confirmed",
    send: () =>
      deliverEmailAndSms(email, customer, () =>
        sendAppointmentConfirmedSms(appointment, customer, copy?.petNames),
      ),
  });
}

export async function notifyCustomerAppointmentDeclined(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  eventKey = "staff_declined",
) {
  const email = buildCustomerAppointmentDeclinedEmail(appointment, customer);

  await runVisitNotification({
    visitId: appointment.visitId,
    event: eventKey,
    send: () =>
      deliverEmailAndSms(email, customer, () =>
        sendAppointmentDeclinedSms(appointment, customer),
      ),
  });
}

export async function notifyCustomerAppointmentStaffCancelled(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  copy?: VisitCustomerCopy,
  eventKey = "staff_cancelled",
) {
  const email = buildCustomerAppointmentStaffCancelledEmail(
    appointment,
    customer,
    copy?.petNames,
  );

  await runVisitNotification({
    visitId: appointment.visitId,
    event: eventKey,
    send: () =>
      deliverEmailAndSms(email, customer, () =>
        sendAppointmentStaffCancelledSms(appointment, customer),
      ),
  });
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

  const send = async () => {
    try {
      return await sendEmail({
        to: customer.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    } catch (error) {
      console.error("appointment change email failed:", error);
      return false;
    }
  };

  if (action === "reschedule") {
    await runVisitNotification({
      visitId: appointment.visitId,
      event: rescheduleNotificationEvent(
        appointment.appointmentDate,
        appointment.appointmentTime,
      ),
      send,
    });
    return;
  }

  await send();
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
  siblings?: VisitNoticePet[],
) {
  const kind = resolveStaffStatusNoticeKind(status, previousStatus);
  const plan = planStaffStatusNotice({
    kind,
    appointmentId: appointment.id,
    petName: appointment.petName,
    serviceName: appointment.serviceName,
    siblings,
  });
  if (!plan.send) return;
  const copy = copyFromPets(plan.pets);

  if (plan.event === "staff_confirmed") {
    await notifyCustomerAppointmentConfirmed(appointment, customer, copy);
    return;
  }

  if (plan.event === "staff_cancelled") {
    await notifyCustomerAppointmentStaffCancelled(
      appointment,
      customer,
      copy,
      plan.eventKey,
    );
    return;
  }

  await notifyCustomerAppointmentDeclined(appointment, customer, plan.eventKey);
}

export { bookingDetailsFromAppointment };
