import { NextResponse } from "next/server";
import { business } from "@/lib/business";
import { createClient } from "@/lib/supabase/server";
import {
  isValidContact,
  isValidEmail,
  normalizeContact,
} from "@/lib/support-contact";

type SupportBody = {
  contact?: string;
  message?: string;
  topic?: string;
  appointmentId?: string;
  chargeId?: string;
};

function safeRef(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

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
  const isConcern = body.topic === "concern";
  const appointmentId = safeRef(body.appointmentId);
  const chargeId = safeRef(body.chargeId);

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

  let customerAccountId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    customerAccountId = user?.id ?? null;
  } catch {
    customerAccountId = null;
  }

  const fromEmail =
    process.env.SUPPORT_FROM_EMAIL?.trim() ||
    `K9 Atelier <${business.brand.email}>`;
  const toEmail = business.brand.email;
  const contactLabel = isValidEmail(contact) ? "Email" : "Phone";
  const subject = isConcern
    ? `K9 Atelier concern (${contactLabel}: ${contact})`
    : `K9 Atelier support message (${contactLabel}: ${contact})`;
  const text = [
    isConcern
      ? "New private concern from k9atelier.com"
      : "New support message from k9atelier.com",
    "",
    `${contactLabel}: ${contact}`,
    customerAccountId ? `Customer account: ${customerAccountId}` : "",
    appointmentId ? `Related appointment: ${appointmentId}` : "",
    chargeId ? `Related receipt: ${chargeId}` : "",
    `Submitted: ${new Date().toISOString()}`,
    "",
    "Message:",
    message,
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n");

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
    const resendError = await res.text();
    console.error("Resend support email failed:", res.status, resendError);
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
