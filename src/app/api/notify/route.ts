import { NextResponse } from "next/server";
import { business } from "@/lib/business";
import { buildCommunicationContext } from "@/lib/communications/context";
import { isCommunicationAccepted } from "@/lib/communications/result";
import { sendEmail } from "@/lib/email/resend";
import { enforceIpRateLimit } from "@/lib/rate-limit";
import { isValidEmail, normalizeContact } from "@/lib/support-contact";

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "notify");
  if (limited) return limited;

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

  const subject = `Launch list signup: ${email}`;
  const text = [
    "New launch notification signup from k9atelier.com",
    "",
    `Email: ${email}`,
  ].join("\n");

  const sent = await sendEmail({
    to: business.brand.email,
    replyTo: email,
    subject,
    text,
    communication: buildCommunicationContext({
      notificationType: "launch_signup",
      audience: "staff",
      recipient: business.brand.email,
      fingerprint: email,
    }),
  });

  if (sent.status === "skipped" && sent.skipReason === "missing_config") {
    return NextResponse.json(
      {
        error:
          "Sign-up is not available yet. Follow us on Instagram for updates.",
      },
      { status: 503 },
    );
  }

  if (!isCommunicationAccepted(sent)) {
    console.error("Resend notify signup failed:", sent.errorMessage);
    return NextResponse.json(
      { error: "We could not save your email right now. Please try again." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
