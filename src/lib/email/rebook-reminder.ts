import { business } from "@/lib/business";
import { COLORS } from "@/lib/email/cancel-confirmation";
import { escapeHtml, emailLogoImg } from "@/lib/email/layout";
import { siteUrl } from "@/lib/email/resend";

const APOSTROPHE = "\u2019";
const EN_DASH = "\u2013";

export type RebookReminderEmailInput = {
  firstName?: string | null;
  petName?: string | null;
};

export function rebookReminderNames(input: RebookReminderEmailInput) {
  const petName = input.petName?.trim() || "your dog";
  const firstName = input.firstName?.trim() || "there";
  return { petName, firstName };
}

export function buildRebookReminderCopy(input: RebookReminderEmailInput) {
  const { petName, firstName } = rebookReminderNames(input);
  const subject = `Time for ${petName}${APOSTROPHE}s next spa visit?`;
  const paragraphs = [
    `It${APOSTROPHE}s been a few weeks since ${petName}${APOSTROPHE}s last visit, so this is a little reminder that it may be time to plan the next appointment.`,
    `For the best coat and skin condition, I generally recommend a bath every 7${EN_DASH}15 days and grooming every 3${EN_DASH}4 weeks, depending on coat type, length, and lifestyle. A consistent schedule helps keep the coat clean, comfortable, and easier to maintain between visits.`,
    `If you${APOSTROPHE}d like to keep ${petName} on a regular grooming schedule, I recommend booking the next visit in advance so you can secure your preferred appointment window.`,
  ];
  const closing = `I look forward to welcoming ${petName} back to the spa.`;
  const bookUrl = siteUrl("/book");
  const text = [
    `Hi ${firstName},`,
    "",
    ...paragraphs.flatMap((paragraph) => [paragraph, ""]),
    `BOOK NEXT APPOINTMENT: ${bookUrl}`,
    "",
    closing,
    "",
    "Warmly,",
    "Penny",
    business.brand.name,
    "Private Mobile Pet Spa",
    "Palm Beach",
  ].join("\n");

  return {
    subject,
    firstName,
    petName,
    paragraphs,
    closing,
    bookUrl,
    text,
  };
}

export function buildRebookReminderEmailHtml(input: RebookReminderEmailInput) {
  const content = buildRebookReminderCopy(input);
  const paragraphsHtml = content.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;font-weight:400;color:${COLORS.ink};text-align:left;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${escapeHtml(content.subject)}</title>
  <style>
    a.k9-rebook-cta:focus { outline: 2px solid ${COLORS.gold}; outline-offset: 3px; }
    @media only screen and (max-width: 620px) {
      .k9-rebook-pad { padding-left: 20px !important; padding-right: 20px !important; }
      .k9-rebook-logo { width: 200px !important; height: 102px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(content.paragraphs[0] ?? "")}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:${COLORS.page};">
    <tr>
      <td align="center" class="k9-rebook-pad" style="padding:32px 20px;">
        <!--[if mso]>
        <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:580px;background-color:${COLORS.card};border:1px solid ${COLORS.line};box-shadow:0 8px 24px rgba(47,41,48,0.04);">
          <tr>
            <td align="center" class="k9-rebook-pad" style="padding:32px 36px 20px;background-color:${COLORS.page};">
              ${emailLogoImg({ className: "k9-rebook-logo" })}
            </td>
          </tr>
          <tr>
            <td style="height:1px;line-height:1px;font-size:1px;background-color:${COLORS.gold};">&nbsp;</td>
          </tr>
          <tr>
            <td class="k9-rebook-pad" style="padding:32px 36px 40px;font-family:Georgia,'Times New Roman',Times,serif;font-weight:400;color:${COLORS.ink};word-break:break-word;">
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;font-weight:400;text-align:left;">Hi ${escapeHtml(content.firstName)},</p>
              ${paragraphsHtml}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:12px auto 28px;">
                <tr>
                  <td align="center" bgcolor="${COLORS.lavender}" style="background-color:${COLORS.lavender};border-radius:4px;">
                    <a class="k9-rebook-cta" href="${escapeHtml(content.bookUrl)}" style="display:inline-block;min-width:220px;padding:14px 28px;font-family:Georgia,'Times New Roman',Times,serif;font-size:16px;line-height:1.25;font-weight:400;color:#ffffff;text-decoration:none;text-align:center;">BOOK NEXT APPOINTMENT</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 28px;font-size:16px;line-height:1.6;font-weight:400;text-align:left;">${escapeHtml(content.closing)}</p>
              <p style="margin:0;font-size:16px;line-height:1.6;font-weight:400;color:${COLORS.ink};">Warmly,</p>
              <p style="margin:8px 0 0;font-size:16px;line-height:1.5;font-weight:400;color:${COLORS.ink};">Penny</p>
              <p style="margin:6px 0 0;font-size:16px;line-height:1.5;font-weight:400;color:${COLORS.ink};">${escapeHtml(business.brand.name)}</p>
              <p style="margin:6px 0 0;font-size:14px;line-height:1.5;font-weight:400;color:${COLORS.muted};">Private Mobile Pet Spa</p>
              <p style="margin:6px 0 0;font-size:14px;line-height:1.5;font-weight:400;color:${COLORS.muted};">Palm Beach</p>
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

export function buildRebookReminderEmail(input: RebookReminderEmailInput) {
  const content = buildRebookReminderCopy(input);
  return {
    subject: content.subject,
    text: content.text,
    html: buildRebookReminderEmailHtml(input),
  };
}
