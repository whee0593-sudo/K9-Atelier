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
          <div style="margin-top:4px;font-size:12px;color:${c.textMuted};letter-spacing:0.08em;">Private Pet Grooming Salon</div>
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
