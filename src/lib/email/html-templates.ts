import { business, formatDuration, formatPrice } from "@/lib/business";
import type { AppointmentRecord } from "@/lib/appointments/types";
import {
  buildCustomerConfirmedEmail,
  buildCustomerLetterEmail,
  buildCustomerSimpleLetterEmail,
  buildCustomerVaccinationApprovedEmail,
  buildStaffNotificationEmail,
  type CustomerLetterDetailRow,
  type StaffNotificationRow,
} from "@/lib/email/layout";
import {
  buildBookingConfirmationEmail,
  newClientDeposit,
  type BookingConfirmationDetails,
} from "@/lib/notifications";
import { siteUrl } from "@/lib/email/resend";
import { allBookableServices } from "@/lib/services";

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

function appointmentDurationLabel(appointment: AppointmentRecord) {
  const service = allBookableServices().find(
    (entry) => entry.id === appointment.serviceId,
  );
  if (!service) return "—";
  if (service.durationNote) return service.durationNote;
  if (service.tiers?.length) {
    const tier = service.tiers[0];
    return formatDuration(tier.durationMin ?? 0, tier.durationMax);
  }
  if (service.durationMin != null) {
    return formatDuration(service.durationMin, service.durationMax);
  }
  return "—";
}

function confirmedAppointmentDetailRows(
  appointment: AppointmentRecord,
): CustomerLetterDetailRow[] {
  return [
    {
      label: "Date",
      value: formatAppointmentDateLabel(appointment.appointmentDate),
    },
    { label: "Time", value: appointment.appointmentTime },
    { label: "Service", value: appointment.serviceName },
    { label: "Location", value: formatAppointmentAddress(appointment) },
    {
      label: "Estimated duration",
      value: appointmentDurationLabel(appointment),
    },
    {
      label: "Estimated total",
      value:
        appointment.estimatedTotal != null
          ? formatPrice(appointment.estimatedTotal)
          : "—",
    },
  ];
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
    durationLabel: appointmentDurationLabel(appointment),
    isNewClient: (appointment.newClientDeposit ?? 0) > 0,
  };
}

export function buildStaffNewAppointmentEmail(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const pending = appointment.status === "pending_confirmation";
  const needsVaccinationReview =
    appointment.vaccinationStatusAtBooking === "needs_review";
  const subject = pending
    ? `[K9 Atelier] Appointment request — ${appointment.petName}`
    : `[K9 Atelier] New confirmed appointment — ${appointment.petName}`;

  const customerLabel = customer.name
    ? `${customer.name} (${customer.email})`
    : customer.email;
  const petLabel = `${appointment.petName}${
    appointment.petBreed ? ` (${appointment.petBreed})` : ""
  }`;
  const travelLabel = `${appointment.travelDistanceMiles} mi · ${
    appointment.travelFee === 0
      ? "Complimentary"
      : formatPrice(appointment.travelFee)
  }`;
  const totalLabel =
    appointment.estimatedTotal != null
      ? formatPrice(appointment.estimatedTotal)
      : "—";

  const rows: StaffNotificationRow[] = [
    { label: "Customer", value: customerLabel },
    { label: "Pet", value: petLabel },
    { label: "Service", value: appointment.serviceName },
    {
      label: "Date & Time",
      value: `${formatAppointmentDateLabel(appointment.appointmentDate)} · ${appointment.appointmentTime}`,
    },
    { label: "Address", value: formatAppointmentAddress(appointment) },
    { label: "Travel", value: travelLabel },
    { label: "Estimated Total", value: totalLabel },
  ];

  if (needsVaccinationReview) {
    rows.push({
      label: "Vaccination",
      value: "Pending staff review",
      valueColor: "#B08D57",
    });
  }

  const introHtml =
    pending && needsVaccinationReview
      ? `<p style="margin:0 0 16px; font-size:15px;"><strong>Action needed:</strong> A new appointment request is waiting for staff review — vaccination not yet on file.</p>`
      : pending
        ? `<p style="margin:0 0 16px; font-size:15px;"><strong>Action needed:</strong> A new appointment request is waiting for staff review.</p>`
        : `<p style="margin:0 0 16px; font-size:15px;">A new appointment was booked and <strong style="color:#B08D57;">confirmed automatically</strong> (vaccination already on file).</p>`;

  const ctaLabel = pending ? "REVIEW IN ADMIN" : "VIEW IN ADMIN";

  const text = [
    pending
      ? needsVaccinationReview
        ? "Action needed: A new appointment request is waiting for staff review — vaccination not yet on file."
        : "Action needed: A new appointment request is waiting for staff review."
      : "A new appointment was booked and confirmed automatically (vaccination already on file).",
    "",
    `Customer: ${customerLabel}`,
    "",
    appointmentPlainDetails(appointment),
    "",
    `${pending ? "Review" : "View"} in admin: ${siteUrl("/admin/appointments")}`,
  ].join("\n");

  return buildStaffNotificationEmail(
    {
      subject,
      introHtml,
      rows,
      cta: {
        href: siteUrl("/admin/appointments"),
        label: ctaLabel,
      },
    },
    text,
  );
}

function customerAppointmentDetailRows(
  appointment: AppointmentRecord,
): CustomerLetterDetailRow[] {
  const petValue = appointment.petBreed
    ? `${appointment.petName}, ${appointment.petBreed}`
    : appointment.petName;
  const travelLabel = `${appointment.travelDistanceMiles} mi · ${
    appointment.travelFee === 0
      ? "Complimentary"
      : formatPrice(appointment.travelFee)
  }`;

  return [
    { label: "Pet", value: petValue },
    { label: "Service", value: appointment.serviceName },
    {
      label: "Date",
      value: formatAppointmentDateLabel(appointment.appointmentDate),
    },
    { label: "Time", value: appointment.appointmentTime },
    { label: "Address", value: formatAppointmentAddress(appointment) },
    { label: "Travel", value: travelLabel },
    {
      label: "Estimated total",
      value:
        appointment.estimatedTotal != null
          ? formatPrice(appointment.estimatedTotal)
          : "—",
    },
  ];
}

export function buildCustomerAppointmentSubmittedEmail(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const subject = `We received ${appointment.petName}'s appointment request`;
  const greetingName = customer.name ?? "Client";
  const introParagraph = `We have received your request for ${appointment.petName}'s appointment.`;
  const estimateDisclaimer =
    "An estimate, subject to coat condition and temperament on the day.";
  const closingParagraph =
    "Your appointment will be confirmed shortly. We will be in touch.";

  const text = [
    `Dear ${greetingName},`,
    "",
    introParagraph,
    "",
    ...customerAppointmentDetailRows(appointment).map(
      ({ label, value }) => `${label}: ${value}`,
    ),
    "",
    estimateDisclaimer,
    "",
    closingParagraph,
    "",
    `View bookings: ${siteUrl("/account/bookings")}`,
  ].join("\n");

  return buildCustomerLetterEmail(
    {
      subject,
      greetingName,
      introParagraph,
      detailRows: customerAppointmentDetailRows(appointment),
      estimateNote: estimateDisclaimer,
      closingParagraph,
      cta: {
        href: siteUrl("/account/bookings"),
        label: "VIEW BOOKINGS",
      },
    },
    text,
  );
}

export function buildCustomerAppointmentDeclinedEmail(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const subject = `Update on ${appointment.petName}'s appointment request`;
  const greetingName = customer.name ?? "Client";
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  const declineParagraph = `Thank you for your interest in K9 Atelier. We are unable to confirm ${appointment.petName}'s appointment request for ${dateLabel} at ${appointment.appointmentTime}.`;
  const followUpParagraph =
    "Please reply to this email should you wish to arrange another time.";

  const text = [
    `Dear ${greetingName},`,
    "",
    declineParagraph,
    "",
    followUpParagraph,
    "",
    `Book again: ${siteUrl("/book")}`,
  ].join("\n");

  return buildCustomerSimpleLetterEmail(
    {
      subject,
      greetingName,
      bodyParagraphs: [declineParagraph, followUpParagraph],
      cta: {
        href: siteUrl("/book"),
        label: "BOOK AGAIN",
      },
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
  const greetingName = customer.name ?? "Client";
  const estimateDisclaimer =
    "This estimate is based on your dog's typical size and coat. Final pricing may vary depending on coat condition, matting, and temperament, and will always be confirmed with you before we begin.";
  const depositAmount =
    details.isNewClient !== false
      ? formatPrice(appointment.newClientDeposit ?? newClientDeposit)
      : null;

  return buildCustomerConfirmedEmail(
    {
      subject,
      greetingName,
      petName: appointment.petName,
      detailRows: confirmedAppointmentDetailRows(appointment),
      estimateNote: estimateDisclaimer,
      depositAmount,
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
  const greetingName = context.customerName ?? "Client";
  const closingParagraph = `Appointments for ${context.petName} may now be booked or confirmed.`;

  const text = [
    `Dear ${greetingName},`,
    "",
    `${context.petName}'s vaccination record has been reviewed and approved.`,
    "",
    `Expiration on file: ${expiration ?? "—"}`,
    "",
    closingParagraph,
    "",
    `Book an appointment: ${siteUrl("/book")}`,
    `Your account: ${siteUrl("/account/pets")}`,
  ].join("\n");

  return buildCustomerVaccinationApprovedEmail(
    {
      subject,
      greetingName,
      petName: context.petName,
      expirationLabel: expiration ?? "—",
      closingParagraph,
      bookUrl: siteUrl("/book"),
      accountUrl: siteUrl("/account/pets"),
    },
    text,
  );
}

export function buildVaccinationRejectedEmail(context: VaccinationMailContext) {
  const subject = `Update on ${context.petName}'s vaccination record`;
  const greetingName = context.customerName ?? "Client";
  const reviewParagraph = `Upon review, ${context.petName}'s vaccination record requires an updated upload before an appointment can be confirmed.`;
  const followUpParagraph =
    "Please reply to this email should you have any questions.";

  const text = [
    `Dear ${greetingName},`,
    "",
    reviewParagraph,
    "",
    followUpParagraph,
    "",
    `Upload record: ${siteUrl("/account/pets")}`,
  ].join("\n");

  return buildCustomerSimpleLetterEmail(
    {
      subject,
      greetingName,
      bodyParagraphs: [reviewParagraph, followUpParagraph],
      cta: {
        href: siteUrl("/account/pets"),
        label: "UPLOAD RECORD",
      },
    },
    text,
  );
}
