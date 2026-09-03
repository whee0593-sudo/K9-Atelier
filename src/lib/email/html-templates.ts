import { business, formatDuration, formatPrice } from "@/lib/business";
import { formatChargeMoney } from "@/lib/charges/money";
import {
  buildCustomerCancelConfirmationEmail,
  type CancelFeeStatus,
} from "@/lib/email/cancel-confirmation";
import { buildCustomerRemoveDogConfirmationEmail } from "@/lib/email/remove-dog-confirmation";
import {
  buildCancelFeeFailedEmail,
  type CancelPaymentFailureKind,
} from "@/lib/email/cancel-fee-failed";
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
  type BookingConfirmationDetails,
} from "@/lib/notifications";
import { siteUrl } from "@/lib/email/resend";
import { allBookableServices } from "@/lib/services";

type CustomerContact = {
  email: string;
  name?: string | null;
  firstName?: string | null;
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
    isNewClient: false,
  };
}

export function buildStaffNewAppointmentEmail(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const pendingReview = appointment.status === "pending_confirmation";
  const subject = pendingReview
    ? "Vaccination Review Required"
    : "New Appointment Confirmed";
  const introLine = pendingReview
    ? "A new appointment is awaiting vaccination review."
    : "A new appointment has been confirmed.";
  const ctaLabel = pendingReview ? "REVIEW APPOINTMENT" : "VIEW APPOINTMENT";

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

  if (pendingReview) {
    rows.push({
      label: "Vaccination",
      value: "Pending staff review",
      valueColor: "#B08D57",
    });
  }

  const introHtml = `<p style="margin:0 0 16px; font-size:15px;">${introLine}</p>`;

  const text = [
    introLine,
    "",
    `Customer: ${customerLabel}`,
    "",
    appointmentPlainDetails(appointment),
    "",
    `${pendingReview ? "Review" : "View"} appointment: ${siteUrl("/admin/appointments")}`,
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
  const subject = "Vaccination Record Received";
  const greetingName = customer.name ?? "Client";
  const introParagraph =
    "We have received your dog’s vaccination record. Your selected appointment is pending review, and we will notify you once it has been confirmed.";
  const estimateDisclaimer =
    "An estimate, subject to coat condition and temperament on the day.";
  const closingParagraph =
    "Thank you for your patience while we complete this review.";

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
  _appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const subject = "Regarding Your Appointment";
  const greetingName = customer.name ?? "Client";
  const openingParagraph =
    "Unfortunately, we’re unable to confirm your selected appointment.";
  const guidanceParagraph =
    "You may select another available date through our booking page, or contact us if you would like assistance.";

  const text = [
    `Dear ${greetingName},`,
    "",
    openingParagraph,
    "",
    guidanceParagraph,
    "",
    `Book an appointment: ${siteUrl("/book")}`,
  ].join("\n");

  return buildCustomerSimpleLetterEmail(
    {
      subject,
      greetingName,
      bodyParagraphs: [openingParagraph, guidanceParagraph],
      cta: {
        href: siteUrl("/book"),
        label: "BOOK AN APPOINTMENT",
      },
    },
    text,
  );
}

export function buildCustomerAppointmentStaffCancelledEmail(
  appointment: AppointmentRecord,
  customer: CustomerContact,
) {
  const subject = "An Update Regarding Your Appointment";
  const greetingName = customer.name ?? "Client";
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  const openingParagraph =
    "We’re sorry, but we’re unable to accommodate your appointment as scheduled.";
  const cancelledParagraph = `Your confirmed appointment for ${appointment.petName} on ${dateLabel} at ${appointment.appointmentTime} has been cancelled.`;
  const guidanceParagraph =
    "You may book another available date at your convenience. If you would prefer assistance, please contact us.";
  const closingParagraph = "Thank you for your understanding.";

  const text = [
    `Dear ${greetingName},`,
    "",
    openingParagraph,
    "",
    cancelledParagraph,
    "",
    guidanceParagraph,
    "",
    closingParagraph,
    "",
    `Book an appointment: ${siteUrl("/book")}`,
  ].join("\n");

  return buildCustomerSimpleLetterEmail(
    {
      subject,
      greetingName,
      bodyParagraphs: [
        openingParagraph,
        cancelledParagraph,
        guidanceParagraph,
        closingParagraph,
      ],
      cta: {
        href: siteUrl("/book"),
        label: "BOOK AN APPOINTMENT",
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

  return buildCustomerConfirmedEmail(
    {
      subject,
      greetingName,
      petName: appointment.petName,
      detailRows: confirmedAppointmentDetailRows(appointment),
      estimateNote: estimateDisclaimer,
      paymentNote:
        "You are not charged when you book. Payment is settled after your appointment. Late cancellations and no-shows may be charged to the card you selected, according to our cancellation policy.",
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

function joinPetNames(names: string[]) {
  if (names.length === 0) return "your pet";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function policyFeeSentence(fee: number) {
  if (fee <= 0) return null;
  return `A policy fee of ${formatChargeMoney(fee)} was charged to the card on file.`;
}

function changeDetailRows(
  appointment: AppointmentRecord,
  petNames: string[],
  serviceLabels: string[] = [],
): CustomerLetterDetailRow[] {
  const rows = customerAppointmentDetailRows(appointment);
  if (petNames.length < 2) return rows;
  return rows.map((row) => {
    if (row.label === "Pet") return { ...row, value: joinPetNames(petNames) };
    if (row.label === "Service" && serviceLabels.length > 1) {
      return { ...row, value: serviceLabels.join("; ") };
    }
    return row;
  });
}

export type AppointmentChangeEmailInput = {
  appointment: AppointmentRecord;
  customer: CustomerContact;
  petNames?: string[];
  serviceLabels?: string[];
  remainingAppointments?: AppointmentRecord[];
  remainingUpdated?: boolean;
  manageAppointmentId?: string | null;
  fee?: number;
  feeStatus?: CancelFeeStatus;
  cardBrand?: string | null;
  cardLast4?: string | null;
  paymentFailureKind?: CancelPaymentFailureKind | null;
  willAutoRetry?: boolean;
  paymentUpdateUrl?: string | null;
};

export function buildCustomerRescheduleEmail({
  appointment,
  customer,
  petNames,
  serviceLabels,
  fee = 0,
}: AppointmentChangeEmailInput) {
  const names = petNames?.length ? petNames : [appointment.petName];
  const pets = joinPetNames(names);
  const subject = `Your K9 Atelier appointment has been rescheduled`;
  const greetingName = customer.name ?? "Client";
  const introParagraph = `We've updated ${pets}'s appointment to the new date and time below.`;
  const estimateNote =
    policyFeeSentence(fee) ??
    "No policy fee was charged for this change.";
  const closingParagraph =
    "If you need to make another change, you can manage the visit from your booking history.";
  const detailRows = changeDetailRows(appointment, names, serviceLabels);

  const text = [
    `Dear ${greetingName},`,
    "",
    introParagraph,
    "",
    ...detailRows.map(({ label, value }) => `${label}: ${value}`),
    "",
    estimateNote,
    "",
    closingParagraph,
    "",
    `View bookings: ${siteUrl("/account/appointments")}`,
  ].join("\n");

  return buildCustomerLetterEmail(
    {
      subject,
      greetingName,
      introParagraph,
      detailRows,
      estimateNote,
      closingParagraph,
      cta: {
        href: siteUrl("/account/appointments"),
        label: "VIEW BOOKINGS",
      },
    },
    text,
  );
}

export function buildCustomerCancelEmail({
  appointment,
  customer,
  petNames,
  fee = 0,
  feeStatus,
  cardBrand,
  cardLast4,
  paymentFailureKind,
  willAutoRetry,
  paymentUpdateUrl,
}: AppointmentChangeEmailInput) {
  const contact = {
    email: customer.email,
    name: customer.name ?? null,
    firstName: customer.firstName,
  };
  if (feeStatus === "failed") {
    return buildCancelFeeFailedEmail({
      appointment,
      customer: contact,
      petNames,
      fee,
      feeStatus,
      paymentFailureKind,
      willAutoRetry,
      paymentUpdateUrl,
    });
  }
  return buildCustomerCancelConfirmationEmail({
    appointment,
    customer: contact,
    petNames,
    fee,
    feeStatus,
    cardBrand,
    cardLast4,
  });
}

export function buildCustomerRemoveDogEmail({
  appointment,
  customer,
  remainingAppointments,
  remainingUpdated,
  manageAppointmentId,
  fee = 0,
  feeStatus,
  cardBrand,
  cardLast4,
}: AppointmentChangeEmailInput) {
  return buildCustomerRemoveDogConfirmationEmail({
    appointment,
    customer: {
      email: customer.email,
      name: customer.name ?? null,
      firstName: customer.firstName,
    },
    remainingAppointments,
    remainingUpdated,
    manageAppointmentId,
    fee,
    feeStatus,
    cardBrand,
    cardLast4,
  });
}

export function buildCustomerAddDogEmail({
  appointment,
  customer,
}: AppointmentChangeEmailInput) {
  const dateLabel = formatAppointmentDateLabel(appointment.appointmentDate);
  const subject = `We received your request to add ${appointment.petName}`;
  const greetingName = customer.name ?? "Client";
  const introParagraph = `We've received your request to add ${appointment.petName} to the visit on ${dateLabel}.`;
  const estimateNote =
    "Adding another pet is subject to availability and is not confirmed automatically.";
  const closingParagraph =
    "We'll review the day's schedule and email you once the change has been confirmed.";
  const detailRows = customerAppointmentDetailRows(appointment);

  const text = [
    `Dear ${greetingName},`,
    "",
    introParagraph,
    "",
    ...detailRows.map(({ label, value }) => `${label}: ${value}`),
    "",
    estimateNote,
    "",
    closingParagraph,
    "",
    `View bookings: ${siteUrl("/account/appointments")}`,
  ].join("\n");

  return buildCustomerLetterEmail(
    {
      subject,
      greetingName,
      introParagraph,
      detailRows,
      estimateNote,
      closingParagraph,
      cta: {
        href: siteUrl("/account/appointments"),
        label: "VIEW BOOKINGS",
      },
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
