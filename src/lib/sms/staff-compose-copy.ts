export const STAFF_SMS_MAX_CHARS = 1200;
const SMS_OPT_OUT = "Reply STOP to opt out.";

export type StaffSmsRecipient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  canText: boolean;
};

export function buildStaffCustomerSms(message: string) {
  const trimmed = message.trim();
  const withPrefix = /^k9 atelier\b/i.test(trimmed)
    ? trimmed
    : `K9 ATELIER: ${trimmed}`;
  if (/reply stop/i.test(withPrefix)) return withPrefix;
  return `${withPrefix}\n\n${SMS_OPT_OUT}`;
}
