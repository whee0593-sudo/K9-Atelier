import { business } from "@/lib/business";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

function getFromEmail() {
  return (
    process.env.SUPPORT_FROM_EMAIL?.trim() ||
    `K9 Atelier <${business.brand.email}>`
  );
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendEmail(input: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.warn("sendEmail skipped: RESEND_API_KEY is not configured");
    return false;
  }

  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const payload: Record<string, unknown> = {
    from: getFromEmail(),
    to: recipients,
    subject: input.subject,
    text: input.text,
  };

  if (input.html) {
    payload.html = input.html;
  }

  if (input.replyTo) {
    payload.reply_to = input.replyTo;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Resend email failed:", response.status, errorText);
    return false;
  }

  return true;
}

export function siteUrl(path: string) {
  const base = business.brand.website?.replace(/\/$/, "") ?? "https://k9atelier.com";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
