import { fetchAppointmentAdminRecord } from "@/lib/email/appointment-context";
import { createAuthenticatedSupabaseClient } from "@/lib/pets/auth";
import { normalizePhoneToE164 } from "@/lib/sms/phone";
import { validateAppointmentId } from "@/lib/appointments/validation";
import {
  getStaffVoicePhone,
  getTwilioVoiceFromNumber,
  isVoiceCallingConfigured,
} from "@/lib/voice/config";
import { buildVoiceBridgeUrl } from "@/lib/voice/bridge";

export async function startStaffOutboundCall(input: {
  appointmentId?: string;
  customerId?: string;
}): Promise<
  | { ok: true }
  | {
      error:
        | "unauthenticated"
        | "forbidden"
        | "not_found"
        | "conflict"
        | "misconfigured"
        | "server";
    }
> {
  const { getStaffSession } = await import("@/lib/staff/auth");
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };

  if (!isVoiceCallingConfigured()) return { error: "misconfigured" };

  const staffPhone = getStaffVoicePhone();
  const fromNumber = getTwilioVoiceFromNumber();
  if (!staffPhone || !fromNumber) return { error: "misconfigured" };

  const customerPhone = await resolveCustomerPhone(input);
  if (customerPhone === "invalid") return { error: "not_found" };
  if (!customerPhone) return { error: "conflict" };
  if (customerPhone === staffPhone) return { error: "conflict" };

  const bridgeUrl = buildVoiceBridgeUrl(customerPhone);
  if (!bridgeUrl) return { error: "conflict" };

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const params = new URLSearchParams();
  params.set("To", staffPhone);
  params.set("From", fromNumber);
  params.set("Url", bridgeUrl);
  params.set("Method", "POST");

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Twilio outbound call failed:", response.status, errorText);
    return { error: "server" };
  }

  return { ok: true };
}

async function resolveCustomerPhone(input: {
  appointmentId?: string;
  customerId?: string;
}): Promise<string | null | "invalid"> {
  if (input.appointmentId) {
    let appointmentId: string;
    try {
      appointmentId = validateAppointmentId(input.appointmentId);
    } catch {
      return "invalid";
    }
    const appointment = await fetchAppointmentAdminRecord(appointmentId);
    if (!appointment) return "invalid";
    return appointment.customerPhone
      ? normalizePhoneToE164(appointment.customerPhone)
      : null;
  }

  if (input.customerId) {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        input.customerId,
      )
    ) {
      return "invalid";
    }
    const supabase = await createAuthenticatedSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("phone")
      .eq("id", input.customerId)
      .maybeSingle();
    if (error) {
      console.error("startStaffOutboundCall profile lookup failed:", error.message);
      return "invalid";
    }
    return data?.phone ? normalizePhoneToE164(data.phone) : null;
  }

  return "invalid";
}
