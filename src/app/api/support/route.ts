import { NextResponse } from "next/server";
import { business } from "@/lib/business";
import { enforceIpRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  isValidContact,
  isValidEmail,
  normalizeContact,
} from "@/lib/support-contact";
import { parseSupportPhotos } from "@/lib/support-photos";

type SupportFields = {
  contact: string;
  message: string;
  topic: string;
  subject: string;
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

function readText(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

async function readSupportFields(request: Request): Promise<{
  fields: SupportFields;
  photos: Awaited<ReturnType<typeof parseSupportPhotos>>["photos"];
  error?: string;
}> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const parsedPhotos = await parseSupportPhotos(form.getAll("photos"));
    if (parsedPhotos.error) {
      return { fields: emptyFields(), photos: [], error: parsedPhotos.error };
    }
    return {
      fields: {
        contact: readText(form.get("contact")),
        message: readText(form.get("message")),
        topic: readText(form.get("topic")),
        subject: readText(form.get("subject")),
        appointmentId: readText(form.get("appointmentId")) || undefined,
        chargeId: readText(form.get("chargeId")) || undefined,
      },
      photos: parsedPhotos.photos,
    };
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return { fields: emptyFields(), photos: [], error: "Invalid request." };
  }
  return {
    fields: {
      contact: typeof body.contact === "string" ? body.contact : "",
      message: typeof body.message === "string" ? body.message : "",
      topic: typeof body.topic === "string" ? body.topic : "",
      subject: typeof body.subject === "string" ? body.subject : "",
      appointmentId:
        typeof body.appointmentId === "string" ? body.appointmentId : undefined,
      chargeId: typeof body.chargeId === "string" ? body.chargeId : undefined,
    },
    photos: [],
  };
}

function emptyFields(): SupportFields {
  return { contact: "", message: "", topic: "", subject: "" };
}

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "support");
  if (limited) return limited;

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

  const parsed = await readSupportFields(request);
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const contact = normalizeContact(parsed.fields.contact);
  const message = parsed.fields.message.trim();
  const guestSubject = parsed.fields.subject.trim();
  const isConcern = parsed.fields.topic === "concern";
  const appointmentId = safeRef(parsed.fields.appointmentId);
  const chargeId = safeRef(parsed.fields.chargeId);

  if (!isValidContact(contact)) {
    return NextResponse.json(
      { error: "Please enter a valid email address or phone number." },
      { status: 400 },
    );
  }

  if (!isConcern && !guestSubject) {
    return NextResponse.json(
      { error: "Please enter a subject." },
      { status: 400 },
    );
  }

  if (guestSubject.length > 120) {
    return NextResponse.json(
      { error: "Subject is too long. Please keep it under 120 characters." },
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
    : `K9 Atelier: ${guestSubject} (${contactLabel}: ${contact})`;
  const text = [
    isConcern
      ? "New private concern from k9atelier.com"
      : "New message from k9atelier.com/contact",
    "",
    `${contactLabel}: ${contact}`,
    guestSubject ? `Subject: ${guestSubject}` : "",
    customerAccountId ? `Customer account: ${customerAccountId}` : "",
    appointmentId ? `Related appointment: ${appointmentId}` : "",
    chargeId ? `Related receipt: ${chargeId}` : "",
    parsed.photos.length
      ? `Photos attached: ${parsed.photos.length}`
      : "",
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

  if (parsed.photos.length > 0) {
    payload.attachments = parsed.photos.map((photo) => ({
      filename: photo.filename,
      content: photo.content,
      content_type: photo.contentType,
    }));
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
