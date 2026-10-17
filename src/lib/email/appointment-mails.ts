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
} from "@/lib/email/html-templates";
import { sendEmailDelivery } from "@/lib/email/resend";
import type { CustomerContact } from "@/lib/email/appointment-context";
import { resolveStaffStatusNoticeKind } from "@/lib/appointments/staff-status-notice";
import {
  sendAppointmentConfirmedSms,
  sendAppointmentDeclinedSms,
  sendAppointmentStaffCancelledSms,
  sendAppointmentSubmittedSms,
} from "@/lib/sms/appointment-sms";
import { loadVisitNoticePets } from "@/lib/visits/notification-context";
import { runVisitNotification } from "@/lib/visits/notification-ledger";
import {
  customerChangeNoticePlan,
  planStaffStatusNotice,
  type VisitNoticePet,
} from "@/lib/visits/notification-scope";
import { formatVisitPetNames } from "@/lib/visits/pet-names";
import {
  combineProviderDeliveries,
  type ProviderDelivery,
} from "@/lib/visits/provider-delivery";

export type VisitCustomerCopy = {
  petNames?: string[];
  serviceNames?: string[];
};

function withVisitPetName(
  appointment: AppointmentRecord,
  petNames?: string[],
) {
  if (!petNames?.length) return appointment;
  return {
    ...appointment,
    petName: formatVisitPetNames(petNames, appointment.petName),
  };
}

function copyFromPets(pets: VisitNoticePet[]): VisitCustomerCopy {
  return {
    petNames: pets.map((pet) => pet.petName),
    serviceNames: pets.map((pet) => `${pet.petName} · ${pet.serviceName}`),
  };
}

function emailContext(
  notificationType: string,
  appointment: AppointmentRecord,
  recipient: string,
  fingerprint?: string,
) {
  return buildCommunicationContext({
    notificationType,
    recipient,
    customerId: appointment.customerId,
    visitId: appointment.visitId ?? null,
    appointmentIds: [appointment.id],
    petIds: [appointment.petId],
    dedupe: appointment.visitId ? "visit" : "appointment",
    fingerprint,
    allowSendWithoutSnapshot: notificationType === "booking_confirmation",
  });
}

async function deliverEmailAndSms(
  notificationType: string,
  appointment: AppointmentRecord,
  email: { subject: string; text: string; html: string },
  customer: CustomerContact,
  sendText: () => Promise<ProviderDelivery>,
  fingerprint?: string,
): Promise<ProviderDelivery> {
  const emailed = await sendEmailDelivery({
    to: customer.email,
    subject: email.subject,
    text: email.text,
    html: email.html,
    communication: emailContext(
      notificationType,
      appointment,
      customer.email,
      fingerprint,
    ),
  });
  let texted: ProviderDelivery = "rejected";
  try {
    texted = await sendText();
  } catch (error) {
    console.error("visit customer SMS failed:", error);
    texted = "uncertain";
  }
  return combineProviderDeliveries([emailed, texted]);
}

export async function notifyCustomerAppointmentSubmitted(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  copy?: VisitCustomerCopy,
) {
  const shown = withVisitPetName(appointment, copy?.petNames);
  const email =
    appointment.status === "confirmed"
      ? buildCustomerAppointmentConfirmedEmail(shown, customer)
      : buildCustomerAppointmentSubmittedEmail(shown, customer);

  await runVisitNotification({
    visitId: appointment.visitId,
    event: "booking_confirmation",
    send: () =>
      deliverEmailAndSms(
        "booking_confirmation",
        appointment,
        email,
        customer,
        () =>
          appointment.status === "confirmed"
            ? sendAppointmentConfirmedSms(appointment, customer, copy?.petNames)
            : sendAppointmentSubmittedSms(appointment, customer, copy?.petNames),
      ),
  });
}

export async function notifyCustomerAppointmentConfirmed(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  copy?: VisitCustomerCopy,
) {
  const email = buildCustomerAppointmentConfirmedEmail(
    withVisitPetName(appointment, copy?.petNames),
    customer,
  );

  await runVisitNotification({
    visitId: appointment.visitId,
    event: "staff_confirmed",
    send: () =>
      deliverEmailAndSms(
        "staff_confirmed",
        appointment,
        email,
        customer,
        () => sendAppointmentConfirmedSms(appointment, customer, copy?.petNames),
      ),
  });
}

export async function notifyCustomerAppointmentDeclined(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  eventKey = "staff_declined",
  petName?: string,
) {
  const email = buildCustomerAppointmentDeclinedEmail(appointment, customer);
  await runVisitNotification({
    visitId: appointment.visitId,
    event: eventKey,
    send: () =>
      deliverEmailAndSms(
        "staff_declined",
        appointment,
        email,
        customer,
        () => sendAppointmentDeclinedSms(appointment, customer, petName),
        eventKey,
      ),
  });
}

export async function notifyCustomerAppointmentStaffCancelled(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  copy?: VisitCustomerCopy,
  eventKey = "staff_cancelled",
  petName?: string,
) {
  const email = buildCustomerAppointmentStaffCancelledEmail(
    withVisitPetName(appointment, copy?.petNames ?? (petName ? [petName] : undefined)),
    customer,
  );
  await runVisitNotification({
    visitId: appointment.visitId,
    event: eventKey,
    send: () =>
      deliverEmailAndSms(
        "staff_cancelled",
        appointment,
        email,
        customer,
        () => sendAppointmentStaffCancelledSms(appointment, customer, petName),
        eventKey,
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
    previousDate?: string | null;
    previousTime?: string | null;
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

  const plan = customerChangeNoticePlan({
    action,
    date: appointment.appointmentDate,
    timeLabel: appointment.appointmentTime,
    previousDate: options?.previousDate,
    previousTime: options?.previousTime,
  });
  const notificationType = plan.claim ? plan.event : `customer_${action}`;
  const send = () =>
    sendEmailDelivery({
      to: customer.email,
      subject: email.subject,
      text: email.text,
      html: email.html,
      communication: emailContext(
        notificationType,
        appointment,
        customer.email,
        plan.claim ? plan.event : appointment.id,
      ),
    });

  if (plan.claim) {
    await runVisitNotification({
      visitId: appointment.visitId,
      event: plan.event,
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
  await notifyCustomerAppointmentSubmitted(appointment, customer);
}

export async function sendAppointmentStatusEmails(
  appointment: AppointmentRecord,
  customer: CustomerContact,
  status: "confirmed" | "cancelled",
  previousStatus?: AppointmentRecord["status"],
  siblings?: VisitNoticePet[] | null,
) {
  const kind = resolveStaffStatusNoticeKind(status, previousStatus);
  const loaded =
    siblings === undefined && appointment.visitId
      ? await loadVisitNoticePets(appointment.visitId)
      : siblings;
  const plan = planStaffStatusNotice({
    kind,
    appointmentId: appointment.id,
    petName: appointment.petName,
    serviceName: appointment.serviceName,
    siblings: loaded,
  });
  if (!plan.send) return;
  const copy = copyFromPets(plan.pets);

  if (plan.event === "staff_confirmed") {
    await notifyCustomerAppointmentConfirmed(appointment, customer, copy);
    return;
  }

  const petName = plan.scope === "pet" ? plan.pets[0]?.petName : undefined;
  if (plan.event === "staff_cancelled") {
    await notifyCustomerAppointmentStaffCancelled(
      appointment,
      customer,
      copy,
      plan.eventKey,
      petName,
    );
    return;
  }

  await notifyCustomerAppointmentDeclined(
    appointment,
    customer,
    plan.eventKey,
    petName,
  );
}

export { bookingDetailsFromAppointment };
