import { business, formatDuration, getBrandWebsiteLabel } from "@/lib/business";
import { formatChargeMoney } from "@/lib/charges/money";
import type { AppointmentRecord } from "@/lib/appointments/types";
import type { CustomerContact } from "@/lib/email/appointment-context";
import {
  COLORS,
  buildCancelFeeCopy,
  cancelGreetingName,
  formatAppointmentDateLabel,
  formatPetNameList,
  type CancelFeeStatus,
} from "@/lib/email/cancel-confirmation";
import { formatAppointmentTimeRange } from "@/lib/appointments/time-label";
import { escapeHtml, getEmailBrand } from "@/lib/email/layout";
import { siteUrl } from "@/lib/email/resend";
import { allBookableServices } from "@/lib/services";

export type RemoveDogConfirmationInput = {
  appointment: AppointmentRecord;
  customer: CustomerContact;
  remainingAppointments?: AppointmentRecord[];
  remainingUpdated?: boolean;
  manageAppointmentId?: string | null;
  fee?: number;
  feeStatus?: CancelFeeStatus;
  cardBrand?: string | null;
  cardLast4?: string | null;
};

export type RemainingDetailRow = {
  label: string;
  value: string;
};

export function manageAppointmentUrl(appointmentId?: string | null) {
  const id = appointmentId?.trim();
  if (id) return siteUrl(`/account/appointments/${id}`);
  return siteUrl("/account/appointments");
}

export function remainingPetsCopy(
  remainingNames: string[],
  remainingUpdated: boolean,
) {
  const names = remainingNames.map((name) => name.trim()).filter(Boolean);
  if (remainingUpdated) {
    return "Your remaining appointment has been updated. Please review the revised details below.";
  }
  if (names.length === 1) {
    return `${names[0]}’s appointment remains confirmed with no other changes.`;
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}’s appointments remain confirmed with no other changes.`;
  }
  if (names.length >= 3) {
    return `${formatPetNameList(names)}’s appointments remain confirmed with no other changes.`;
  }
  return "Your remaining appointment remains confirmed with no other changes.";
}

function estimatedDurationLabel(appointment: AppointmentRecord) {
  const service = allBookableServices().find(
    (entry) => entry.id === appointment.serviceId,
  );
  if (!service) return null;
  if (service.durationNote?.trim()) return service.durationNote.trim();
  if (service.tiers?.length) {
    const tier = service.tiers[0];
    if (tier.durationMin != null || tier.durationMax != null) {
      return formatDuration(tier.durationMin ?? 0, tier.durationMax);
    }
  }
  if (service.durationMin != null) {
    return formatDuration(service.durationMin, service.durationMax);
  }
  return null;
}

export function remainingDetailRows(
  appointments: AppointmentRecord[],
): RemainingDetailRow[] {
  if (appointments.length === 0) return [];
  const rows: RemainingDetailRow[] = [];
  const petNames = appointments.map((row) => row.petName);
  const pets = formatPetNameList(petNames);
  if (pets && pets !== "your pet") {
    rows.push({ label: "Remaining pets", value: pets });
  }

  const first = appointments[0];
  if (first?.appointmentDate) {
    rows.push({
      label: "Date",
      value: formatAppointmentDateLabel(first.appointmentDate),
    });
  }
  const time = formatAppointmentTimeRange(first?.appointmentTime);
  if (time) rows.push({ label: "Time", value: time });

  const serviceRows = appointments.filter((row) => row.serviceName?.trim());
  if (serviceRows.length === 1 && serviceRows[0]?.serviceName) {
    rows.push({ label: "Service", value: serviceRows[0].serviceName });
  } else if (serviceRows.length > 1) {
    rows.push({
      label: "Services",
      value: serviceRows
        .map((row) => `${row.petName} · ${row.serviceName}`)
        .join("; "),
    });
  }

  const durationRows = appointments
    .map((row) => {
      const duration = estimatedDurationLabel(row);
      return duration ? { petName: row.petName, duration } : null;
    })
    .filter((row): row is { petName: string; duration: string } => row != null);
  if (durationRows.length === 1 && durationRows[0]) {
    rows.push({
      label: "Estimated duration",
      value: durationRows[0].duration,
    });
  } else if (durationRows.length > 1) {
    rows.push({
      label: "Estimated duration",
      value: durationRows
        .map((row) => `${row.petName} · ${row.duration}`)
        .join("; "),
    });
  }

  const totals = appointments
    .map((row) => row.estimatedTotal)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (totals.length > 0) {
    rows.push({
      label: "Updated estimated total",
      value: formatChargeMoney(totals.reduce((sum, value) => sum + value, 0)),
    });
  }

  return rows;
}

export function buildRemoveDogEmailContent(input: RemoveDogConfirmationInput) {
  const removedName = input.appointment.petName.trim() || "Your pet";
  const remaining = input.remainingAppointments ?? [];
  const remainingNames = remaining.map((row) => row.petName);
  const remainingUpdated = Boolean(input.remainingUpdated);
  const greetingName = cancelGreetingName(input.customer);
  const dateLabel = formatAppointmentDateLabel(input.appointment.appointmentDate);
  const fee = buildCancelFeeCopy(input);
  const manageUrl = manageAppointmentUrl(
    input.manageAppointmentId ?? remaining[0]?.id,
  );
  const remainingSentence = remainingPetsCopy(remainingNames, remainingUpdated);
  const details = remainingUpdated ? remainingDetailRows(remaining) : [];
  const subject = `${removedName} Has Been Removed from Your K9 ATELIER Appointment`;

  const text = [
    `Dear ${greetingName},`,
    "",
    "Your Appointment Has Been Updated",
    "",
    `${removedName} has been removed from your appointment on ${dateLabel}.`,
    "",
    remainingSentence,
    ...(details.length
      ? ["", ...details.map(({ label, value }) => `${label}: ${value}`)]
      : []),
    "",
    ...fee.paragraphs,
    "",
    "If you need to make another change, you can manage your appointment through your booking history.",
    "",
    `Manage Appointment: ${manageUrl}`,
    "",
    "Warmly,",
    "K9 ATELIER",
    "Private Mobile Pet Spa · Palm Beach",
    `${business.brand.phone} · ${getBrandWebsiteLabel()}`,
  ].join("\n");

  return {
    subject,
    greetingName,
    removedName,
    dateLabel,
    remainingSentence,
    details,
    fee,
    manageUrl,
    text,
  };
}

function emphasizeAmount(paragraph: string, amountLabel: string | null) {
  const safe = escapeHtml(paragraph);
  if (!amountLabel) return safe;
  return safe.replace(
    escapeHtml(amountLabel),
    `<span style="font-weight:600;color:${COLORS.ink};">${escapeHtml(amountLabel)}</span>`,
  );
}

export function buildRemoveDogEmailHtml(input: RemoveDogConfirmationInput) {
  const content = buildRemoveDogEmailContent(input);
  const { logoUrl } = getEmailBrand();
  const lockup = business.brand.lockup;
  const wordmark = business.brand.wordmark;
  const feeHtml = content.fee.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:${COLORS.ink};">${emphasizeAmount(paragraph, content.fee.amountLabel)}</p>`,
    )
    .join("");
  const detailsHtml =
    content.details.length > 0
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;border-top:1px solid ${COLORS.line};border-bottom:1px solid ${COLORS.line};">
          ${content.details
            .map(
              ({ label, value }) => `<tr>
            <td style="padding:10px 0;font-size:11px;line-height:1.4;letter-spacing:0.08em;text-transform:uppercase;color:${COLORS.lavender};width:42%;vertical-align:top;">${escapeHtml(label)}</td>
            <td style="padding:10px 0;font-size:16px;line-height:1.5;color:${COLORS.ink};">${escapeHtml(value)}</td>
          </tr>`,
            )
            .join("")}
        </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${escapeHtml(content.subject)}</title>
  <style>
    a.k9-remove-cta:focus { outline: 2px solid ${COLORS.gold}; outline-offset: 3px; }
    @media only screen and (max-width: 620px) {
      .k9-remove-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .k9-remove-logo { width: 52px !important; height: 52px !important; }
      .k9-remove-date { white-space: nowrap !important; }
    }
    @media only screen and (max-width: 360px) {
      .k9-remove-date { white-space: normal !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(`${content.removedName} has been removed from your appointment.`)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${COLORS.page};">
    <tr>
      <td align="center" class="k9-remove-pad" style="padding:32px 20px;">
        <!--[if mso]>
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;background-color:${COLORS.card};border:1px solid ${COLORS.line};box-shadow:0 8px 24px rgba(47,41,48,0.04);">
          <tr>
            <td align="center" class="k9-remove-pad" style="padding:32px 36px 20px;background-color:${COLORS.page};">
              <img class="k9-remove-logo" src="${escapeHtml(logoUrl)}" width="64" height="64" alt="${escapeHtml(business.brand.name)}" style="display:block;width:64px;height:64px;border-radius:50%;margin:0 auto 12px;border:0;"/>
              <div style="font-family:Georgia,'Times New Roman',Times,serif;font-size:20px;letter-spacing:0.18em;color:${COLORS.ink};">${escapeHtml(wordmark)}</div>
              <div style="margin-top:8px;font-family:Georgia,'Times New Roman',Times,serif;font-size:12px;letter-spacing:0.04em;color:${COLORS.muted};">${escapeHtml(lockup)}</div>
            </td>
          </tr>
          <tr>
            <td style="height:1px;line-height:1px;font-size:1px;background-color:${COLORS.gold};">&nbsp;</td>
          </tr>
          <tr>
            <td class="k9-remove-pad" style="padding:32px 36px 40px;font-family:Georgia,'Times New Roman',Times,serif;color:${COLORS.ink};word-break:break-word;">
              <p style="margin:0 0 22px;font-size:16px;line-height:1.6;text-align:left;">Dear ${escapeHtml(content.greetingName)},</p>
              <h1 style="margin:0 0 20px;font-family:Georgia,'Times New Roman',Times,serif;font-size:26px;line-height:1.3;font-weight:400;color:${COLORS.lavender};text-align:center;">Your Appointment Has Been Updated</h1>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;text-align:left;">${escapeHtml(content.removedName)} has been removed from your appointment on <span class="k9-remove-date" style="white-space:nowrap;">${escapeHtml(content.dateLabel)}</span>.</p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;text-align:left;">${escapeHtml(content.remainingSentence)}</p>
              ${detailsHtml}
              ${feeHtml}
              <p style="margin:0 0 28px;font-size:16px;line-height:1.6;text-align:left;">If you need to make another change, you can manage your appointment through your booking history.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td align="center" bgcolor="${COLORS.lavender}" style="background-color:${COLORS.lavender};border-radius:4px;">
                    <a class="k9-remove-cta" href="${escapeHtml(content.manageUrl)}" style="display:inline-block;min-width:220px;padding:14px 28px;font-family:Georgia,'Times New Roman',Times,serif;font-size:16px;line-height:1.25;color:#ffffff;text-decoration:none;text-align:center;">Manage Appointment</a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;font-size:16px;line-height:1.6;color:${COLORS.ink};">Warmly,</p>
              <p style="margin:8px 0 0;font-size:16px;line-height:1.5;letter-spacing:0.12em;color:${COLORS.ink};">K9 ATELIER</p>
              <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(lockup)}</p>
              <p style="margin:6px 0 0;font-size:14px;line-height:1.5;color:${COLORS.muted};">${escapeHtml(business.brand.phone)} · ${escapeHtml(getBrandWebsiteLabel())}</p>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildCustomerRemoveDogConfirmationEmail(
  input: RemoveDogConfirmationInput,
) {
  const content = buildRemoveDogEmailContent(input);
  return {
    subject: content.subject,
    text: content.text,
    html: buildRemoveDogEmailHtml(input),
  };
}
