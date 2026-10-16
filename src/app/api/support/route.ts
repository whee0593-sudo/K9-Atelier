import { NextResponse } from "next/server";
import { business } from "@/lib/business";
import { enforceIpRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import {
  inquiryTypeFromQuery,
  inquiryTypeLabel,
  resolveSupportChannels,
} from "@/lib/support-contact";
import { buildSupportNotification } from "@/lib/support-mail";
import { parseSupportPhotos } from "@/lib/support-photos";

type SupportFields = {
  contact: string;
  email: string;
  phone: string;
  message: string;
  topic: string;
  subject: string;
  inquiryType: string;
  groomingPreferences: string;
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
        email: readText(form.get("email")),
        phone: readText(form.get("phone")),
        message: readText(form.get("message")),
        topic: readText(form.get("topic")),
        subject: readText(form.get("subject")),
        inquiryType: readText(form.get("inquiryType")),
        groomingPreferences: readText(form.get("groomingPreferences")),
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
      email: typeof body.email === "string" ? body.email : "",
      phone: typeof body.phone === "string" ? body.phone : "",
      message: typeof body.message === "string" ? body.message : "",
      topic: typeof body.topic === "string" ? body.topic : "",
      subject: typeof body.subject === "string" ? body.subject : "",
      inquiryType: typeof body.inquiryType === "string" ? body.inquiryType : "",
      groomingPreferences:
        typeof body.groomingPreferences === "string"
          ? body.groomingPreferences
          : "",
      appointmentId:
        typeof body.appointmentId === "string" ? body.appointmentId : undefined,
      chargeId: typeof body.chargeId === "string" ? body.chargeId : undefined,
    },
    photos: [],
  };
}

function emptyFields(): SupportFields {
  return {
    contact: "",
    email: "",
    phone: "",
    message: "",
    topic: "",
    subject: "",
    inquiryType: "",
    groomingPreferences: "",
  };
}

export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "support");
  if (limited) return limited;

  const parsed = await readSupportFields(request);
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const channels = resolveSupportChannels({
    email: parsed.fields.email,
    phone: parsed.fields.phone,
    contact: parsed.fields.contact,
  });
  if (!channels.ok) {
    return NextResponse.json({ error: channels.error }, { status: 400 });
  }

  const message = parsed.fields.message.trim();
  const inquiryType = inquiryTypeFromQuery(parsed.fields.inquiryType);
  const inquiryLabel = inquiryTypeLabel(inquiryType);
  const groomingPreferences = parsed.fields.groomingPreferences.trim();
  const guestSubject =
    parsed.fields.subject.trim() ||
    (inquiryType === "grooming-consultation" ? inquiryLabel : "");
  const isConcern = parsed.fields.topic === "concern";
  const appointmentId = safeRef(parsed.fields.appointmentId);
  const chargeId = safeRef(parsed.fields.chargeId);

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

  if (groomingPreferences.length > 2000) {
    return NextResponse.json(
      {
        error:
          "Grooming preferences are too long. Please keep them under 2,000 characters.",
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Support email is not configured yet. Please try again later.",
      },
      { status: 503 },
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
  const notification = buildSupportNotification({
    email: channels.email,
    phone: channels.phone,
    inquiryLabel,
    guestSubject,
    groomingPreferences,
    isConcern,
    customerAccountId,
    appointmentId,
    chargeId,
    photoCount: parsed.photos.length,
    message,
    submittedAt: new Date().toISOString(),
  });

  const payload: Record<string, unknown> = {
    from: fromEmail,
    to: [toEmail],
    subject: notification.subject,
    text: notification.text,
  };

  if (notification.replyTo) {
    payload.reply_to = notification.replyTo;
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
          "We could not send your message right now. Please try again in a few minutes.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
