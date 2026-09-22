import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AdminAppointmentRecord, AppointmentRecord } from "../src/lib/appointments/types.ts";
import { buildChargeReceiptCardHtml } from "../src/lib/charges/receipt-email.ts";
import type { AppointmentChargeRecord } from "../src/lib/charges/types.ts";
import { buildCustomerCancelConfirmationEmail } from "../src/lib/email/cancel-confirmation.ts";
import { buildCancelFeeFailedEmail } from "../src/lib/email/cancel-fee-failed.ts";
import {
  buildCustomerAddDogEmail,
  buildCustomerAppointmentConfirmedEmail,
  buildCustomerAppointmentDeclinedEmail,
  buildCustomerAppointmentSubmittedEmail,
  buildCustomerRescheduleEmail,
  buildStaffNewAppointmentEmail,
  buildVaccinationRejectedEmail,
  buildVaccinationVerifiedEmail,
} from "../src/lib/email/html-templates.ts";
import { getEmailBrand } from "../src/lib/email/layout.ts";
import { buildNextDayFollowUpEmail } from "../src/lib/followup/copy.ts";
import { buildCustomerRemoveDogConfirmationEmail } from "../src/lib/email/remove-dog-confirmation.ts";

const sampleAppointment: AppointmentRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  customerId: "00000000-0000-4000-8000-000000000002",
  petId: "00000000-0000-4000-8000-000000000003",
  petName: "Lychee",
  petBreed: "Maltese",
  serviceId: "signature-bath-style",
  serviceName: "Signature Bath & Style",
  addOnIds: [],
  addOnOptions: {},
  addressStreet: "123 Example Avenue",
  addressCity: "Palm Beach Gardens",
  addressState: "FL",
  addressZip: "33418",
  travelDistanceMiles: 8.2,
  travelFee: 0,
  appointmentDate: "2026-08-18",
  appointmentTime: "10:00 AM",
  timezone: "America/New_York",
  estimatedTotal: 185,
  newClientDeposit: 50,
  vaccinationStatusAtBooking: "needs_review",
  status: "pending_confirmation",
  confirmedAt: null,
  customerConfirmedAt: null,
  createdAt: "2026-08-12T12:00:00.000Z",
};

const confirmedAppointment: AppointmentRecord = {
  ...sampleAppointment,
  vaccinationStatusAtBooking: "current",
  status: "confirmed",
  confirmedAt: "2026-08-12T12:00:00.000Z",
};

const customer = {
  email: "sarah@example.com",
  name: "Sarah",
};

const previews = [
  {
    title: "Penny — Appointment request (vaccination pending)",
    ...buildStaffNewAppointmentEmail(sampleAppointment, customer),
  },
  {
    title: "Penny — Auto-confirmed appointment",
    ...buildStaffNewAppointmentEmail(confirmedAppointment, customer),
  },
  {
    title: "Customer — Request received (pending)",
    ...buildCustomerAppointmentSubmittedEmail(sampleAppointment, customer),
  },
  {
    title: "Customer — Appointment confirmed",
    ...buildCustomerAppointmentConfirmedEmail(confirmedAppointment, customer),
  },
  {
    title: "Customer — Appointment declined",
    ...buildCustomerAppointmentDeclinedEmail(sampleAppointment, customer),
  },
  {
    title: "Customer — Vaccination approved",
    ...buildVaccinationVerifiedEmail({
      petName: "Lychee",
      customerEmail: customer.email,
      customerName: customer.name,
      expirationDate: "2027-03-15",
    }),
  },
  {
    title: "Customer — Vaccination needs re-upload",
    ...buildVaccinationRejectedEmail({
      petName: "Lychee",
      customerEmail: customer.email,
      customerName: customer.name,
    }),
  },
  {
    title: "Customer — Appointment rescheduled",
    ...buildCustomerRescheduleEmail({
      appointment: confirmedAppointment,
      customer,
    }),
  },
  {
    title: "Customer — Add-a-dog request received",
    ...buildCustomerAddDogEmail({
      appointment: confirmedAppointment,
      customer,
    }),
  },
  {
    title: "Customer — Appointment canceled",
    ...buildCustomerCancelConfirmationEmail({
      appointment: { ...sampleAppointment, status: "cancelled" },
      customer,
      fee: 0,
    }),
  },
  {
    title: "Customer — Cancellation fee needs attention",
    ...buildCancelFeeFailedEmail({
      appointment: { ...sampleAppointment, status: "cancelled" },
      customer,
      fee: 70,
    }),
  },
  {
    title: "Customer — Dog removed from appointment",
    ...buildCustomerRemoveDogConfirmationEmail({
      appointment: { ...confirmedAppointment, petName: "Lychee" },
      customer,
      remainingAppointments: [{ ...confirmedAppointment, id: "apt-otto", petName: "Otto" }],
      fee: 0,
    }),
  },
  {
    title: "Customer — Next-day follow-up",
    ...buildNextDayFollowUpEmail({
      firstName: "Sarah",
      petName: "Lychee",
    }),
  },
  {
    title: "Customer — Visit receipt",
    subject: "Your K9 Atelier receipt",
    html: buildChargeReceiptCardHtml(
      {
        ...confirmedAppointment,
        customerEmail: customer.email,
        customerName: customer.name,
        customerFirstName: "Sarah",
        customerLastName: null,
        customerPhone: null,
        reminderSmsSentAt: null,
        enRouteSmsSentAt: null,
        serviceStartedAt: "2026-08-18T14:05:00.000Z",
        serviceEndedAt: "2026-08-18T15:40:00.000Z",
      } as AdminAppointmentRecord,
      {
        id: "chg-1",
        appointmentId: confirmedAppointment.id,
        kind: "service",
        status: "paid",
        lineItems: [
          {
            id: "1",
            label: "Signature Bath & Style",
            amount: 185,
          },
        ],
        subtotal: 185,
        tipAmount: 20,
        total: 205,
        receiptChannel: "email",
        paidAt: "2026-08-18T15:45:00.000Z",
        refundedAmount: 0,
      } as AppointmentChargeRecord,
    ),
  },
];

function previewHtml(html: string) {
  const { logoUrl } = getEmailBrand();
  return html.replaceAll(logoUrl, "/email-logo.png");
}

const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>K9 Atelier Email Previews</title>
  <style>
    body { margin: 0; background: #ece7df; font-family: Georgia, serif; color: #4d4348; }
    header { padding: 32px 24px 16px; text-align: center; }
    header h1 { margin: 0 0 8px; font-size: 28px; color: #9b7648; }
    header p { margin: 0; font-size: 14px; color: #7a6a71; }
    nav { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding: 0 16px 24px; }
    nav a { color: #9b7648; font-size: 13px; text-decoration: none; padding: 8px 12px; background: #fff; border-radius: 999px; border: 1px solid #d8d0dd; }
    section { max-width: 680px; margin: 0 auto 48px; background: #fff; border: 1px solid #d8d0dd; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 30px rgba(77,67,72,0.08); }
    .meta { padding: 20px 24px; background: #efeaf6; border-bottom: 1px solid #d8d0dd; }
    .meta h2 { margin: 0 0 8px; font-size: 18px; color: #9b7648; }
    .meta div { font-size: 13px; color: #7a6a71; line-height: 1.6; }
    .frame { border: none; width: 100%; min-height: 900px; background: #fbf7ef; }
  </style>
</head>
<body>
  <header>
    <h1>K9 Atelier Email Previews</h1>
    <p>Sample data: Sarah · Lychee · Signature Bath &amp; Style · Aug 18, 2026</p>
  </header>
  <nav>
    ${previews
      .map(
        (_, index) =>
          `<a href="#preview-${index}">${previews[index].title}</a>`,
      )
      .join("")}
  </nav>
  ${previews
    .map(
      (preview, index) => `<section id="preview-${index}">
    <div class="meta">
      <h2>${preview.title}</h2>
      <div><strong>Subject:</strong> ${preview.subject.replace(/</g, "&lt;")}</div>
    </div>
    <iframe class="frame" title="${preview.title.replace(/"/g, "&quot;")}" srcdoc="${previewHtml(preview.html).replace(/"/g, "&quot;").replace(/#/g, "&#35;")}"></iframe>
  </section>`,
    )
    .join("\n")}
</body>
</html>`;

const outDir = join(process.cwd(), "public");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "email-previews.html");
writeFileSync(outPath, page, "utf8");
console.log(`Wrote ${outPath}`);
console.log("Open http://localhost:3000/email-previews.html while dev server is running.");
