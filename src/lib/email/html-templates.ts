import { business, formatPrice } from "@/lib/business";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  buildBrandedEmail,
  emailDetailTable,
  emailNoticeBox,
  emailParagraph,
  emailSectionTitle,
  escapeHtml,
  getEmailBrand,
} from "@/lib/email/layout";
import {
  buildBookingConfirmationEmail,
  estimateNote,
  newClientDeposit,
  type BookingConfirmationDetails,
} from "@/lib/notifications";
import { siteUrl } from "@/lib/email/resend";

type CustomerContact = {
  email: string;
  name?: string | null;
};

export function formatAppointmentDateLabel(date: string) {
  const parsed = new Date(date.includes("T") ? date : `${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatAppointmentAddress(appointment: AppointmentRecord) {
  return `${appointment.addressStreet}, ${appointment.addressCity}, ${appointment.addressState} ${appointment.addressZip}`;
}

export function appointmentDetailRows(
  appointment: AppointmentRecord,
): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    [
      "Pet",
      `${appointment.petName}${appointment.petBreed ? ` (${appointment.petBreed})` : ""}`,
    ],
    ["Service", appointment.serviceName],
    ["Date", formatAppointmentDateLabel(appointment.appointmentDate)],
    ["Time", appointment.appointmentTime],
    ["Address", formatAppointmentAddress(appointment)],
    [
      "Travel",
      `${appointment.travelDistanceMiles} mi · ${
        appointment.travelFee === 0
          ? "Complimentary"
          : formatPrice(appointment.travelFee)
      }`,
    ],
  ];

  if (appointment.estimatedTotal != null) {
    rows.push(["Estimated Total", `From ${formatPrice(appointment.estimatedTotal)}`]);
  }

  if (appointment.vaccinationStatusAtBooking === "needs_review") {
    rows.push(["Vaccination", "Pending staff review at time of booking"]);
  }

  return rows;
}

export function appointmentPlainDetails(appointment: AppointmentRecord) {
  return appointmentDetailRows(appointment)
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

export function bookingDetailsFromAppointment(
  appointment: AppointmentRecord,
  customer: CustomerContact,
): BookingConfirmationDetails {
  return {
    customerName: customer.name ?? undefined,
    petName: appointment.petName,
    serviceName: appointment.serviceName,
    dateLabel: formatAppointmentDateLabel(appointment.appointmentDate),
    timeLabel: appointment.appointmentTime,
    addressLabel: formatAppointmentAddress(appointment),
    priceLabel:
      appointment.estimatedTotal != null
        ? formatPrice(appointment.estimatedTotal)
        : undefined,
    isNewClient: true,
  };
}

function detailsTableHtml(appointment: AppointmentRecord) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">${emailDetailTable(appointmentDetailRows(appointment))}</table>`;
}

export function buildStaffNewAppointmentEmail(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const pending = appointment.status === "pending_confirmation";
  const subject = pending
    ? `[K9 Atelier] Appointment request — ${appointment.petName}`
    : `[K9 Atelier] New confirmed appointment — ${appointment.petName}`;

  const text = [
    pending
      ? "A new appointment request is waiting for staff review."
      : "A new appointment was booked and confirmed automatically.",
    "",
    `Customer: ${customer.name ?? customer.email}`,
    `Customer email: ${customer.email}`,
    "",
    appointmentPlainDetails(appointment),
    "",
    `Review in admin: ${siteUrl("/admin/appointments")}`,
  ].join("\n");

  const intro = emailParagraph(
    "Please review the appointment details below.",
  );

  const bodyHtml = [
    pending
      ? emailNoticeBox(
          "This request is waiting for staff confirmation in the admin dashboard.",
          "info",
        )
      : emailNoticeBox("This appointment was confirmed automatically.", "success"),
    emailParagraph(
      `<strong>Customer:</strong> ${escapeHtml(customer.name ?? customer.email)}<br/><strong>Email:</strong> ${escapeHtml(customer.email)}`,
    ),
    emailSectionTitle("Appointment Details"),
    detailsTableHtml(appointment),
  ].join("");

  return buildBrandedEmail(
    {
      subject,
      headline: pending ? "New Appointment Request" : "New Confirmed Appointment",
      greetingName: "Penny",
      introHtml: intro,
      bodyHtml,
      cta: { href: siteUrl("/admin/appointments"), label: "Review in Admin" },
    },
    text,
  );
}

export function buildCustomerAppointmentSubmittedEmail(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const subject = `We received ${appointment.petName}'s appointment request`;
  const greeting = customer.name ? `Hi ${customer.name},` : "Hi there,";
  const text = [
    greeting,
    "",
    `Thank you — we received ${appointment.petName}'s appointment request.`,
    "",
    appointmentPlainDetails(appointment),
    "",
    "Your request is pending staff confirmation. We will email you once your appointment is confirmed.",
    "",
    `View your account: ${siteUrl("/account/bookings")}`,
  ].join("\n");

  const intro = emailParagraph(
    `Thank you — we received <strong>${escapeHtml(appointment.petName)}</strong>&apos;s appointment request.`,
  );

  const bodyHtml = [
    emailNoticeBox(
      "Your request is pending staff confirmation. We will email you once your appointment is confirmed.",
      "info",
    ),
    emailSectionTitle("Request Details"),
    detailsTableHtml(appointment),
  ].join("");

  return buildBrandedEmail(
    {
      subject,
      headline: "Request Received",
      greetingName: customer.name ?? undefined,
      introHtml: intro,
      bodyHtml,
      cta: { href: siteUrl("/account/bookings"), label: "View Appointment" },
    },
    text,
  );
}

export function buildCustomerAppointmentDeclinedEmail(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const subject = `Update on ${appointment.petName}'s appointment request`;
  const greeting = customer.name ? `Hi ${customer.name},` : "Hi there,";
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  const text = [
    greeting,
    "",
    `Thank you for your interest in K9 Atelier. We are unable to confirm ${appointment.petName}'s appointment request for ${dateLabel} at ${appointment.appointmentTime}.`,
    "",
    "If you would like to choose another time or have questions, please reply to this email or contact us directly.",
    "",
    `Book again: ${siteUrl("/book")}`,
  ].join("\n");

  const intro = emailParagraph(
    `Thank you for your interest in K9 Atelier. We are unable to confirm ${escapeHtml(appointment.petName)}&apos;s appointment request for ${escapeHtml(dateLabel)} at ${escapeHtml(appointment.appointmentTime)}.`,
  );

  const bodyHtml = emailNoticeBox(
    "If you would like to choose another time or have questions, please reply to this email and we will help.",
    "warning",
  );

  return buildBrandedEmail(
    {
      subject,
      headline: "Appointment Update",
      greetingName: customer.name ?? undefined,
      introHtml: intro,
      bodyHtml,
      cta: { href: siteUrl("/book"), label: "Book Again" },
    },
    text,
  );
}

export function buildCustomerAppointmentConfirmedEmail(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const details = bookingDetailsFromAppointment(appointment, customer);
  const { subject, body: text } = buildBookingConfirmationEmail(details);
  const { c } = getEmailBrand();
  const petName = escapeHtml(details.petName);

  const detailRows: Array<[string, string]> = [
    ["Date", details.dateLabel],
    ["Time", details.timeLabel],
    ["Service", details.serviceName],
  ];
  if (details.addressLabel) detailRows.push(["Location", details.addressLabel]);
  if (details.priceLabel) detailRows.push(["Estimated Total", details.priceLabel]);

  const bodyHtml = [
    emailParagraph(
      `Welcome to K9 Atelier! We&apos;re so glad you&apos;ve chosen us, and we&apos;re looking forward to caring for ${petName} soon.`,
    ),
    emailSectionTitle("Appointment Details"),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${emailDetailTable(detailRows)}</table>`,
    details.priceLabel
      ? emailParagraph(
          `<span style="color:${c.textMuted};font-size:12px;font-style:italic;">${escapeHtml(estimateNote)}</span>`,
        )
      : "",
    `<div style="margin:24px 0;padding:16px 20px;background:${c.lavenderLight};border:1px solid ${c.gold};border-radius:12px;">
      <h3 style="margin:0 0 8px;color:${c.goldDark};font-size:16px;">New Client Deposit</h3>
      <p style="margin:0;color:${c.text};font-size:14px;line-height:1.6;">As a new client, a $${newClientDeposit} deposit will be collected to confirm your first appointment and applied toward your service total.</p>
    </div>`,
    emailSectionTitle("What to Expect"),
    emailParagraph(
      "Our mobile grooming studio will arrive within your scheduled window. A quick health and coat check will take place before we begin, and we&apos;ll keep you updated throughout the appointment.",
    ),
    emailSectionTitle("How to Prepare"),
    `<ul style="margin:0 0 16px;padding-left:20px;color:${c.text};font-size:14px;line-height:1.7;">
      <li>Please ensure ${petName} has had a bathroom break shortly before our arrival</li>
      <li>A parking spot near your home for our grooming van is greatly appreciated</li>
      <li>Please let us know in advance about any allergies, sensitivities, medical conditions, or behavioral notes for ${petName}</li>
    </ul>`,
    emailParagraph(
      `We can&apos;t wait to meet ${petName} and welcome you both to the K9 Atelier family!`,
    ),
  ].join("");

  return buildBrandedEmail(
    {
      subject,
      headline: "Your Appointment Is Confirmed",
      greetingName: customer.name ?? undefined,
      introHtml: emailParagraph(
        "Your private grooming appointment is confirmed. Here are the details:",
      ),
      bodyHtml,
      cta: { href: siteUrl("/account/bookings"), label: "View Appointment" },
    },
    text,
  );
}

type VaccinationMailContext = {
  petName: string;
  customerEmail: string;
  customerName?: string | null;
  expirationDate?: string | null;
};

function formatExpirationDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function buildVaccinationVerifiedEmail(context: VaccinationMailContext) {
  const subject = `${context.petName}'s vaccination record is approved`;
  const expiration = formatExpirationDate(context.expirationDate);
  const greeting = context.customerName ? `Hi ${context.customerName},` : "Hi there,";
  const text = [
    greeting,
    "",
    `Good news — ${context.petName}'s vaccination record has been approved.`,
    expiration ? `Expiration on file: ${expiration}` : null,
    "",
    "You can now book or continue any pending appointment requests for this pet.",
    "",
    `Book an appointment: ${siteUrl("/book")}`,
    `Your account: ${siteUrl("/account/pets")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const intro = emailParagraph(
    `Good news — <strong>${escapeHtml(context.petName)}</strong>&apos;s vaccination record has been approved.`,
  );

  const bodyHtml = [
    expiration
      ? emailNoticeBox(`Expiration on file: ${escapeHtml(expiration)}`, "success")
      : emailNoticeBox(
          "Your vaccination record is now on file and ready for booking.",
          "success",
        ),
    emailParagraph(
      "You can now book or continue any pending appointment requests for this pet.",
    ),
  ].join("");

  return buildBrandedEmail(
    {
      subject,
      headline: "Vaccination Approved",
      greetingName: context.customerName ?? undefined,
      introHtml: intro,
      bodyHtml,
      cta: { href: siteUrl("/book"), label: "Book Appointment" },
    },
    text,
  );
}

export function buildVaccinationRejectedEmail(context: VaccinationMailContext) {
  const subject = `Update on ${context.petName}'s vaccination record`;
  const greeting = context.customerName ? `Hi ${context.customerName},` : "Hi there,";
  const text = [
    greeting,
    "",
    `We reviewed ${context.petName}'s vaccination upload and need a new record before we can confirm grooming appointments.`,
    "",
    "Please upload a clear, current vaccination record in your account. If you have questions, reply to this email and we will help.",
    "",
    `Upload again: ${siteUrl("/account/pets")}`,
  ].join("\n");

  const intro = emailParagraph(
    `We reviewed <strong>${escapeHtml(context.petName)}</strong>&apos;s vaccination upload and need a new record before we can confirm grooming appointments.`,
  );

  const bodyHtml = emailNoticeBox(
    "Please upload a clear, current vaccination record in your account. If you have questions, reply to this email and we will help.",
    "warning",
  );

  return buildBrandedEmail(
    {
      subject,
      headline: "Vaccination Record Needed",
      greetingName: context.customerName ?? undefined,
      introHtml: intro,
      bodyHtml,
      cta: { href: siteUrl("/account/pets"), label: "Upload Record" },
    },
    text,
  );
}
