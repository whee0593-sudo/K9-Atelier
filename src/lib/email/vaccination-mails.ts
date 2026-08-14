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
