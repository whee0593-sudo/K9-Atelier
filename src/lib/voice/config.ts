import { normalizePhoneToE164 } from "@/lib/sms/phone";

function envValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function getTwilioVoiceFromNumber() {
  return normalizePhoneToE164(envValue("TWILIO_FROM_NUMBER"));
}

export function getStaffVoicePhone() {
  return normalizePhoneToE164(envValue("STAFF_VOICE_PHONE"));
}

export function isVoiceCallingConfigured() {
  return Boolean(
    envValue("TWILIO_ACCOUNT_SID") &&
      envValue("TWILIO_AUTH_TOKEN") &&
      getTwilioVoiceFromNumber() &&
      getStaffVoicePhone(),
  );
}
