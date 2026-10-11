import { buildCommunicationContext } from "@/lib/communications/context";
import {
  buildVaccinationRejectedEmail,
  buildVaccinationVerifiedEmail,
} from "@/lib/email/html-templates";
import { sendEmail } from "@/lib/email/resend";

type VaccinationMailContext = {
  petName: string;
  customerEmail: string;
  customerName?: string | null;
  expirationDate?: string | null;
  customerId?: string | null;
  petId?: string | null;
  recordId?: string | null;
};

export async function notifyCustomerVaccinationVerified(
  context: VaccinationMailContext,
) {
  const email = buildVaccinationVerifiedEmail(context);

  await sendEmail({
    to: context.customerEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
    communication: buildCommunicationContext({
      notificationType: "vaccination_verified",
      recipient: context.customerEmail,
      customerId: context.customerId,
      petIds: context.petId ? [context.petId] : [],
      fingerprint: context.recordId ?? undefined,
    }),
  });
}

export async function notifyCustomerVaccinationRejected(
  context: VaccinationMailContext,
) {
  const email = buildVaccinationRejectedEmail(context);

  await sendEmail({
    to: context.customerEmail,
    subject: email.subject,
    text: email.text,
    html: email.html,
    communication: buildCommunicationContext({
      notificationType: "vaccination_rejected",
      recipient: context.customerEmail,
      customerId: context.customerId,
      petIds: context.petId ? [context.petId] : [],
      fingerprint: context.recordId ?? undefined,
    }),
  });
}

export async function sendVaccinationReviewEmails(
  context: VaccinationMailContext,
  status: "verified" | "rejected",
) {
  if (status === "verified") {
    await notifyCustomerVaccinationVerified(context);
    return;
  }

  await notifyCustomerVaccinationRejected(context);
}
