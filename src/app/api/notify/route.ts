import { NextResponse } from "next/server";
import { business } from "@/lib/business";
import { isValidEmail, normalizeContact } from "@/lib/support-contact";

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Sign-up is not available yet. Follow us on Instagram for updates.",
      },
      { status: 503 },
    );
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = normalizeContact(body.email ?? "");
  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const fromEmail =
    process.env.SUPPORT_FROM_EMAIL?.trim() ||
    `K9 Atelier <${business.brand.email}>`;
  const subject = `Launch list signup: ${email}`;
  const text = [
    "New launch notification signup from k9atelier.com",
    "",
    `Email: ${email}`,
  ].join("\n");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [business.brand.email],
      reply_to: email,
      subject,
      text,
    }),
  });

  if (!res.ok) {
    const resendError = await res.text();
    console.error("Resend notify signup failed:", res.status, resendError);
    return NextResponse.json(
      { error: "We could not save your email right now. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
