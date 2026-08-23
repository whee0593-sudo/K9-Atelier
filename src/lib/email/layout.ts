import { business } from "@/lib/business";

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function getEmailBrand() {
  const c = business.colors;
  const logoUrl = business.brand.website
    ? `${business.brand.website}${business.brand.logo}`
    : business.brand.logo;

  return {
    c,
    logoUrl,
    brandName: business.brand.name,
    email: business.brand.email,
    website: business.brand.website ?? "https://k9atelier.com",
  };
}

export function emailFooterText() {
  const parts = [business.brand.phone ?? business.brand.email];
  if (business.brand.website) parts.push(business.brand.website);
  return parts.join(" | ");
}

type DetailRow = [label: string, value: string];

export function emailDetailTable(rows: DetailRow[]) {
  const { c } = getEmailBrand();
  return rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 0;color:${c.textMuted};width:150px;vertical-align:top;font-size:14px;">${escapeHtml(label)}</td><td style="padding:6px 0;color:${c.text};font-weight:600;font-size:14px;line-height:1.5;">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
}

type NoticeVariant = "info" | "success" | "warning";

export function emailNoticeBox(message: string, variant: NoticeVariant = "info") {
  const { c } = getEmailBrand();
  const styles = {
    info: {
      bg: c.lavenderLight,
      border: c.lavender,
      text: c.text,
    },
    success: {
      bg: "#f4faf5",
      border: "#b8d8be",
      text: c.text,
    },
    warning: {
      bg: "#fdf5f5",
      border: "#e8c4c4",
      text: "#7a3b3b",
    },
  }[variant];

  return `<div style="margin:24px 0;padding:16px 20px;background:${styles.bg};border:1px solid ${styles.border};border-radius:12px;">
    <p style="margin:0;color:${styles.text};font-size:14px;line-height:1.6;">${message}</p>
  </div>`;
}

export function emailSectionTitle(title: string) {
  const { c } = getEmailBrand();
  return `<h3 style="margin:24px 0 8px;color:${c.goldDark};font-size:16px;">${escapeHtml(title)}</h3>`;
}

export function emailParagraph(text: string) {
  const { c } = getEmailBrand();
  return `<p style="margin:0 0 16px;color:${c.text};font-size:14px;line-height:1.6;">${text}</p>`;
}

export function emailButton(href: string, label: string) {
  const { c } = getEmailBrand();
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
    <tr><td style="border-radius:8px;background:${c.goldDark};">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.08em;text-decoration:none;text-transform:uppercase;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

export type BrandedEmailContent = {
  subject: string;
  headline: string;
  greetingName?: string;
  introHtml: string;
  bodyHtml?: string;
  cta?: { href: string; label: string };
};

export function buildBrandedEmailHtml(content: BrandedEmailContent) {
  const { c, logoUrl, brandName } = getEmailBrand();
  const greetingName = escapeHtml(content.greetingName ?? "there");
  const footerLine = escapeHtml(emailFooterText());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${c.cream};font-family:Georgia,'Times New Roman',Times,serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.cream};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${c.lavender};border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(77,67,72,0.08);">
        <tr><td style="padding:32px 32px 24px;text-align:center;background:linear-gradient(180deg, ${c.lavenderLight} 0%, #ffffff 100%);">
          <img src="${logoUrl}" alt="${escapeHtml(brandName)}" width="72" height="72" style="border-radius:50%;display:inline-block;border:2px solid ${c.gold};"/>
          <div style="margin-top:12px;font-size:12px;font-weight:600;color:${c.goldDark};letter-spacing:0.24em;text-transform:uppercase;">${escapeHtml(brandName)}</div>
          <div style="margin-top:4px;font-size:12px;color:${c.textMuted};letter-spacing:0.08em;">${escapeHtml(business.brand.tagline)}</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 18px;color:${c.goldDark};font-size:26px;line-height:1.3;font-weight:600;">${escapeHtml(content.headline)}</h1>
          <p style="margin:0 0 16px;color:${c.text};font-size:15px;line-height:1.6;">Hi ${greetingName},</p>
          ${content.introHtml}
          ${content.bodyHtml ?? ""}
          ${content.cta ? emailButton(content.cta.href, content.cta.label) : ""}
          <p style="margin:28px 0 0;color:${c.text};font-size:14px;line-height:1.6;">Warmly,<br/>${escapeHtml(brandName)}</p>
        </td></tr>
        <tr><td style="padding:22px 32px;background:${c.lavenderLight};text-align:center;color:${c.textMuted};font-size:12px;line-height:1.6;">
          <div style="font-weight:600;color:${c.goldDark};letter-spacing:0.06em;">${escapeHtml(brandName)}</div>
          <div style="margin-top:6px;">${footerLine}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildBrandedEmail(content: BrandedEmailContent, plainText: string) {
  return {
    subject: content.subject,
    text: plainText,
    html: buildBrandedEmailHtml(content),
  };
}

const STAFF_EMAIL = {
  cream: "#FAF6EF",
  border: "#E8E0D3",
  gold: "#B08D57",
  ink: "#3A3226",
  muted: "#8A8073",
} as const;

export type CustomerLetterDetailRow = {
  label: string;
  value: string;
};

export type CustomerLetterEmailContent = {
  subject: string;
  greetingName: string;
  introParagraph: string;
  detailRows: CustomerLetterDetailRow[];
  estimateNote: string;
  closingParagraph: string;
  cta: { href: string; label: string };
};

function customerLetterDetailRow(label: string, value: string) {
  return `<tr>
    <td style="padding:5px 0;color:${STAFF_EMAIL.muted};">${escapeHtml(label)}</td>
    <td style="padding:5px 0;text-align:right;color:${STAFF_EMAIL.ink};">${escapeHtml(value)}</td>
  </tr>`;
}

export function buildCustomerLetterEmailHtml(content: CustomerLetterEmailContent) {
  const { logoUrl } = getEmailBrand();
  const detailsHtml = content.detailRows
    .map(({ label, value }) => customerLetterDetailRow(label, value))
    .join("");
  const footerLine = [
    business.brand.name,
    business.brand.phone,
    business.brand.email,
    "k9atelier.com",
  ]
    .filter(Boolean)
    .join(" · ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${STAFF_EMAIL.cream};">
  <div style="background-color:${STAFF_EMAIL.cream}; padding:40px 20px; font-family: Georgia, 'Times New Roman', serif;">
    <div style="max-width:480px; margin:0 auto; background-color:#ffffff; border:1px solid ${STAFF_EMAIL.border};">
      <div style="background-color:${STAFF_EMAIL.cream}; padding:32px 32px 20px; text-align:center; border-bottom:1px solid ${STAFF_EMAIL.gold};">
        <img src="${logoUrl}" width="64" height="64" style="border-radius:50%; display:block; margin:0 auto 12px;" alt="${escapeHtml(business.brand.name)}" />
        <div style="font-size:20px; letter-spacing:4px; color:${STAFF_EMAIL.ink}; font-family:Georgia,'Times New Roman',serif;">K9 ATELIER</div>
      </div>
      <div style="padding:28px 32px; color:${STAFF_EMAIL.ink}; font-size:14px; line-height:1.8; background:#ffffff;">
        <p style="margin:0 0 14px;">Dear ${escapeHtml(content.greetingName)},</p>
        <p style="margin:0 0 14px;">${escapeHtml(content.introParagraph)}</p>
        <div style="padding:14px 0; font-size:13px; margin:18px 0; border-top:1px solid ${STAFF_EMAIL.border}; border-bottom:1px solid ${STAFF_EMAIL.border};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
            ${detailsHtml}
          </table>
        </div>
        <p style="margin:0 0 14px; font-size:12px; color:${STAFF_EMAIL.muted};">${escapeHtml(content.estimateNote)}</p>
        <p style="margin:0 0 22px;">${escapeHtml(content.closingParagraph)}</p>
        <div style="text-align:center;">
          <a href="${escapeHtml(content.cta.href)}" style="display:inline-block; border:1px solid ${STAFF_EMAIL.gold}; color:${STAFF_EMAIL.gold}; padding:10px 28px; text-decoration:none; font-size:11px; letter-spacing:2px;">${escapeHtml(content.cta.label)}</a>
        </div>
      </div>
      <div style="background-color:${STAFF_EMAIL.cream}; padding:22px 32px; text-align:center; font-size:11px; color:${STAFF_EMAIL.muted}; letter-spacing:0.5px; font-family:Georgia,'Times New Roman',serif;">
        ${escapeHtml(footerLine)}
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildCustomerLetterEmail(
  content: CustomerLetterEmailContent,
  plainText: string,
) {
  return {
    subject: content.subject,
    text: plainText,
    html: buildCustomerLetterEmailHtml(content),
  };
}

export type CustomerSimpleLetterEmailContent = {
  subject: string;
  greetingName: string;
  bodyParagraphs: string[];
  cta: { href: string; label: string };
};

export function buildCustomerSimpleLetterEmailHtml(
  content: CustomerSimpleLetterEmailContent,
) {
  const bodyParagraphsHtml = content.bodyParagraphs
    .map((paragraph, index) => {
      const marginBottom =
        index === content.bodyParagraphs.length - 1 ? "22px" : "14px";
      return `<p style="margin:0 0 ${marginBottom};">${escapeHtml(paragraph)}</p>`;
    })
    .join("");

  return `${customerLetterHeader(content.subject)}
      <div style="padding:28px 32px; color:${STAFF_EMAIL.ink}; font-size:14px; line-height:1.8; background:#ffffff;">
        <p style="margin:0 0 14px;">Dear ${escapeHtml(content.greetingName)},</p>
        ${bodyParagraphsHtml}
        <div style="text-align:center;">
          <a href="${escapeHtml(content.cta.href)}" style="display:inline-block; border:1px solid ${STAFF_EMAIL.gold}; color:${STAFF_EMAIL.gold}; padding:10px 28px; text-decoration:none; font-size:11px; letter-spacing:2px;">${escapeHtml(content.cta.label)}</a>
        </div>
      </div>
      ${customerLetterFooter()}`;
}

export function buildCustomerSimpleLetterEmail(
  content: CustomerSimpleLetterEmailContent,
  plainText: string,
) {
  return {
    subject: content.subject,
    text: plainText,
    html: buildCustomerSimpleLetterEmailHtml(content),
  };
}

export type CustomerVaccinationApprovedEmailContent = {
  subject: string;
  greetingName: string;
  petName: string;
  expirationLabel: string;
  closingParagraph: string;
  bookUrl: string;
  accountUrl: string;
};

export function buildCustomerVaccinationApprovedEmailHtml(
  content: CustomerVaccinationApprovedEmailContent,
) {
  const petName = escapeHtml(content.petName);

  return `${customerLetterHeader(content.subject)}
      <div style="padding:28px 32px; color:${STAFF_EMAIL.ink}; font-size:14px; line-height:1.8; background:#ffffff;">
        <p style="margin:0 0 4px; font-size:15px; letter-spacing:0.5px; color:${STAFF_EMAIL.gold};">Vaccination approved</p>
        <p style="margin:0 0 14px;">Dear ${escapeHtml(content.greetingName)}, ${petName}&apos;s vaccination record has been reviewed and approved.</p>
        <div style="padding:14px 0; font-size:13px; margin:18px 0; border-top:1px solid ${STAFF_EMAIL.border}; border-bottom:1px solid ${STAFF_EMAIL.border};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
            ${customerLetterDetailRow("Expiration on file", content.expirationLabel)}
          </table>
        </div>
        <p style="margin:0 0 22px;">${escapeHtml(content.closingParagraph)}</p>
        <div style="text-align:center;">
          <a href="${escapeHtml(content.bookUrl)}" style="display:inline-block; border:1px solid ${STAFF_EMAIL.gold}; color:${STAFF_EMAIL.gold}; padding:10px 28px; text-decoration:none; font-size:11px; letter-spacing:2px;">BOOK AN APPOINTMENT</a>
        </div>
        <p style="margin:18px 0 0; text-align:center; font-size:12px;"><a href="${escapeHtml(content.accountUrl)}" style="color:${STAFF_EMAIL.muted};">View your account</a></p>
      </div>
      ${customerLetterFooter()}`;
}

export function buildCustomerVaccinationApprovedEmail(
  content: CustomerVaccinationApprovedEmailContent,
  plainText: string,
) {
  return {
    subject: content.subject,
    text: plainText,
    html: buildCustomerVaccinationApprovedEmailHtml(content),
  };
}

export type CustomerConfirmedEmailContent = {
  subject: string;
  greetingName: string;
  petName: string;
  detailRows: CustomerLetterDetailRow[];
  estimateNote: string;
  paymentNote?: string | null;
};

function customerLetterHeader(subject: string) {
  const { logoUrl } = getEmailBrand();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${STAFF_EMAIL.cream};">
  <div style="background-color:${STAFF_EMAIL.cream}; padding:40px 20px; font-family: Georgia, 'Times New Roman', serif;">
    <div style="max-width:480px; margin:0 auto; background-color:#ffffff; border:1px solid ${STAFF_EMAIL.border};">
      <div style="background-color:${STAFF_EMAIL.cream}; padding:32px 32px 20px; text-align:center; border-bottom:1px solid ${STAFF_EMAIL.gold};">
        <img src="${logoUrl}" width="64" height="64" style="border-radius:50%; display:block; margin:0 auto 12px;" alt="${escapeHtml(business.brand.name)}" />
        <div style="font-size:20px; letter-spacing:4px; color:${STAFF_EMAIL.ink}; font-family:Georgia,'Times New Roman',serif;">K9 ATELIER</div>
      </div>`;
}

function customerLetterFooter() {
  const footerLine = [
    business.brand.name,
    business.brand.phone,
    business.brand.email,
    "k9atelier.com",
  ]
    .filter(Boolean)
    .join(" · ");
  return `<div style="background-color:${STAFF_EMAIL.cream}; padding:22px 32px; text-align:center; font-size:11px; color:${STAFF_EMAIL.muted}; letter-spacing:0.5px; font-family:Georgia,'Times New Roman',serif;">
        ${escapeHtml(footerLine)}
      </div>
    </div>
  </div>
</body>
</html>`;
}

function customerConfirmedSection(title: string, bodyHtml: string) {
  return `<div style="margin:18px 0; padding-top:16px; border-top:1px solid ${STAFF_EMAIL.border};">
        <p style="margin:0 0 4px; color:${STAFF_EMAIL.ink}; font-size:13px; letter-spacing:0.5px;">${escapeHtml(title)}</p>
        ${bodyHtml}
      </div>`;
}

export function buildCustomerConfirmedEmailHtml(content: CustomerConfirmedEmailContent) {
  const detailsHtml = content.detailRows
    .map(({ label, value }) => customerLetterDetailRow(label, value))
    .join("");
  const petName = escapeHtml(content.petName);
  const paymentSection = content.paymentNote
    ? customerConfirmedSection(
        "Payment",
        `<p style="margin:0; font-size:13px; color:#5A5347;">${escapeHtml(content.paymentNote)}</p>`,
      )
    : "";

  return `${customerLetterHeader(content.subject)}
      <div style="padding:28px 32px; color:${STAFF_EMAIL.ink}; font-size:14px; line-height:1.8; background:#ffffff;">
        <p style="margin:0 0 4px; font-size:15px; letter-spacing:0.5px; color:${STAFF_EMAIL.gold};">Appointment confirmed</p>
        <p style="margin:0 0 14px;">Dear ${escapeHtml(content.greetingName)}, we look forward to caring for ${petName}.</p>
        <div style="padding:14px 0; font-size:13px; margin:18px 0; border-top:1px solid ${STAFF_EMAIL.border}; border-bottom:1px solid ${STAFF_EMAIL.border};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; font-size:13px;">
            ${detailsHtml}
          </table>
        </div>
        <p style="margin:0 0 18px; font-size:12px; color:${STAFF_EMAIL.muted};">${escapeHtml(content.estimateNote)}</p>
        ${paymentSection}
        ${customerConfirmedSection(
          "What to expect",
          `<p style="margin:0; font-size:13px; color:#5A5347;">Our mobile grooming studio will arrive within your scheduled window. A brief health and coat check takes place before we begin, and we will keep you informed throughout.</p>`,
        )}
        ${customerConfirmedSection(
          "In preparation",
          `<ul style="margin:0; padding-left:18px; font-size:13px; color:#5A5347;">
          <li style="margin-bottom:6px;">A bathroom break for ${petName} shortly before our arrival is appreciated</li>
          <li style="margin-bottom:6px;">A nearby parking spot for our grooming van is greatly appreciated</li>
          <li>Please let us know in advance of any allergies, sensitivities, or behavioral notes</li>
        </ul>`,
        )}
        ${customerConfirmedSection(
          "Need to reschedule?",
          `<p style="margin:0; font-size:13px; color:#5A5347;">We kindly ask for at least 48 hours&apos; notice for any changes. Please reply to this email or reach us at ${escapeHtml(business.brand.phone ?? business.brand.email)}.</p>`,
        )}
        <p style="margin:22px 0 0;">Warmly,</p>
        <p style="margin:2px 0 0;">${escapeHtml(business.brand.name)}</p>
      </div>
      ${customerLetterFooter()}`;
}

export function buildCustomerConfirmedEmail(
  content: CustomerConfirmedEmailContent,
  plainText: string,
) {
  return {
    subject: content.subject,
    text: plainText,
    html: buildCustomerConfirmedEmailHtml(content),
  };
}

export type StaffNotificationRow = {
  label: string;
  value: string;
  valueColor?: string;
};

export type StaffNotificationEmailContent = {
  subject: string;
  introHtml: string;
  rows: StaffNotificationRow[];
  cta: { href: string; label: string };
};

export function buildStaffNotificationEmailHtml(content: StaffNotificationEmailContent) {
  const rowsHtml = content.rows
    .map(
      ({ label, value, valueColor }) =>
        `<tr><td style="padding:6px 0; color:${STAFF_EMAIL.muted}; width:140px;">${escapeHtml(label)}</td><td style="padding:6px 0;${valueColor ? ` color:${valueColor};` : ""}">${escapeHtml(value)}</td></tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${STAFF_EMAIL.cream};">
  <div style="background-color:${STAFF_EMAIL.cream}; padding:32px 20px; font-family: Georgia, 'Times New Roman', serif;">
    <div style="max-width:520px; margin:0 auto; background-color:#ffffff; border:1px solid ${STAFF_EMAIL.border};">
      <div style="background-color:${STAFF_EMAIL.cream}; padding:20px 32px; border-bottom:2px solid ${STAFF_EMAIL.gold};">
        <span style="font-size:18px; letter-spacing:2px; color:${STAFF_EMAIL.ink};">K9 ATELIER</span>
        <span style="float:right; font-size:12px; color:${STAFF_EMAIL.muted}; padding-top:4px;">Staff Notification</span>
      </div>
      <div style="padding:28px 32px; color:${STAFF_EMAIL.ink}; font-size:14px; line-height:1.7;">
        ${content.introHtml}
        <table style="width:100%; border-collapse:collapse; font-size:14px;">
          ${rowsHtml}
        </table>
        <div style="text-align:center; margin-top:24px;">
          <a href="${escapeHtml(content.cta.href)}" style="display:inline-block; background-color:${STAFF_EMAIL.gold}; color:#ffffff; padding:12px 26px; text-decoration:none; font-size:13px; letter-spacing:1px;">${escapeHtml(content.cta.label)}</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildStaffNotificationEmail(
  content: StaffNotificationEmailContent,
  plainText: string,
) {
  return {
    subject: content.subject,
    text: plainText,
    html: buildStaffNotificationEmailHtml(content),
  };
}
