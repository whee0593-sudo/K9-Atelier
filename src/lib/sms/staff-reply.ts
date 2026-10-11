import { lookupCustomerByPhone } from "@/lib/sms/customer-by-phone";
import {
  formatPetAndOwnerFullLabel,
  inboundReplyTextForStaff,
} from "@/lib/sms/inbox-copy";
import { recordCustomerSms } from "@/lib/sms/inbox";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import {
  buildStaffReplyFailedSms,
  buildStaffReplySentSms,
  splitStaffReply,
} from "@/lib/sms/staff-reply-copy";
import { readStaffReplyTarget } from "@/lib/sms/staff-reply-target";
import {
  buildCommunicationContext,
  communicationFingerprint,
  communicationHourBucket,
} from "@/lib/communications/context";
import { isCommunicationAccepted } from "@/lib/communications/result";
import { sendSms } from "@/lib/sms/twilio";
import { getStaffVoicePhone } from "@/lib/voice/config";

export async function handleStaffPhoneReply(input: {
  from: string;
  to?: string;
  body: string;
  mediaUrls?: string[];
}): Promise<"sent" | "failed"> {
  const staffPhone = getStaffVoicePhone();
  if (!staffPhone) return "failed";

  const mediaUrls = (input.mediaUrls ?? []).filter(Boolean).slice(0, 10);
  const parsed = splitStaffReply(input.body);
  const targetPhone =
    parsed.phone ?? (await readStaffReplyTarget())?.phone ?? null;
  const message = parsed.message;
  if (!targetPhone || (!message && mediaUrls.length === 0)) {
    await sendSms({
      to: staffPhone,
      body: buildStaffReplyFailedSms(),
      communication: buildCommunicationContext({
        notificationType: "staff_reply_failed",
        audience: "staff",
        recipient: staffPhone,
        fingerprint: communicationFingerprint(
          `${communicationHourBucket()}|${staffPhone}|missing-target`,
        ),
      }),
    });
    return "failed";
  }

  const to = normalizePhoneToE164(targetPhone);
  if (!to) {
    await sendSms({
      to: staffPhone,
      body: buildStaffReplyFailedSms(),
      communication: buildCommunicationContext({
        notificationType: "staff_reply_failed",
        audience: "staff",
        recipient: staffPhone,
        fingerprint: communicationFingerprint(
          `${communicationHourBucket()}|${staffPhone}|invalid-target`,
        ),
      }),
    });
    return "failed";
  }

  const customer = await lookupCustomerByPhone(to);
  const outboundBody =
    message ||
    inboundReplyTextForStaff({ body: "", mediaCount: mediaUrls.length });
  const sent = await sendSms({
    to,
    body: outboundBody,
    mediaUrls,
    communication: buildCommunicationContext({
      notificationType: "staff_reply",
      recipient: to,
      customerId: customer?.customerId ?? null,
      fingerprint: communicationFingerprint(outboundBody),
    }),
  });
  if (!isCommunicationAccepted(sent)) {
    await sendSms({
      to: staffPhone,
      body: buildStaffReplyFailedSms(),
      communication: buildCommunicationContext({
        notificationType: "staff_reply_failed",
        audience: "staff",
        recipient: staffPhone,
        customerId: customer?.customerId ?? null,
        fingerprint: communicationFingerprint(
          `${communicationHourBucket()}|${to}|${outboundBody}|failed`,
        ),
      }),
    });
    return "failed";
  }

  await recordCustomerSms({
    direction: "outbound",
    phone: to,
    body: inboundReplyTextForStaff({
      body: message,
      mediaCount: mediaUrls.length,
    }),
    customer,
    customerName: customer?.name ?? "Unknown",
    mediaUrls,
  });

  const label = formatPetAndOwnerFullLabel({
    ownerName: customer?.name ?? to,
    petNames: customer?.petNames ?? [],
  });
  await sendSms({
    to: staffPhone,
    body: buildStaffReplySentSms(`${label} ${to}`),
    communication: buildCommunicationContext({
      notificationType: "staff_reply_sent",
      audience: "staff",
      recipient: staffPhone,
      customerId: customer?.customerId ?? null,
      fingerprint: communicationFingerprint(`${to}|${outboundBody}`),
    }),
  });
  return "sent";
}
