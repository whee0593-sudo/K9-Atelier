import { NextResponse } from "next/server";
import { business } from "@/lib/business";
import {
  isValidContact,
  isValidEmail,
  normalizeContact,
} from "@/lib/support-contact";

type SupportBody = {
  contact?: string;
  message?: string;
};

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Support email is not configured yet. Please email us directly at penny@k9atelier.com.",
      },
      { status: 503 },
    );
  }

  let body: SupportBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const contact = normalizeContact(body.contact ?? "");
  const message = body.message?.trim() ?? "";

  if (!isValidContact(contact)) {
    return NextResponse.json(
      { error: "Please enter a valid email address or phone number." },
      { status: 400 },
    );
  }

  if (!message) {
    return NextResponse.json(
      { error: "Please enter your message." },
      { status: 400 },
    );
  }

  if (message.length > 5000) {
    return NextResponse.json(
      { error: "Message is too long. Please keep it under 5,000 characters." },
      { status: 400 },
    );
  }

  const fromEmail =
    process.env.SUPPORT_FROM_EMAIL?.trim() ||
    "K9 Atelier <onboarding@resend.dev>";
  const toEmail = business.brand.email;
  const contactLabel = isValidEmail(contact) ? "Email" : "Phone";
  const subject = `K9 Atelier support message (${contactLabel}: ${contact})`;
  const text = [
    "New support message from k9atelier.com",
    "",
    `${contactLabel}: ${contact}`,
    "",
    "Message:",
    message,
  ].join("\n");

  const payload: Record<string, unknown> = {
    from: fromEmail,
    to: [toEmail],
    subject,
    text,
  };

  if (isValidEmail(contact)) {
    payload.reply_to = contact;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    return NextResponse.json(
      {
        error:
          "We could not send your message right now. Please try again or email us at penny@k9atelier.com.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
