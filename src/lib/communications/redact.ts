/**
 * Remove payment cards and provider credentials before a snapshot is stored
 * or handed to Resend / Twilio.
 * Customer confirm links are intentionally left in place. Those URLs are
 * reachable only through the staff-only communication_logs table.
 */
const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]+\b/g, "[redacted]"],
  [/\bwhsec_[A-Za-z0-9]+\b/g, "[redacted]"],
  [/\bre_[A-Za-z0-9_]{8,}\b/g, "[redacted]"],
  [/\bBearer\s+[A-Za-z0-9._\-+/=]+\b/gi, "Bearer [redacted]"],
  [/\b(?:AC)[a-f0-9]{32}\b/g, "[redacted]"],
];

function luhnValid(digits: string) {
  let sum = 0;
  let alternate = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

function redactCardNumbers(value: string) {
  return value.replace(/\d[\d -]{11,22}\d/g, (match) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return match;
    if (!luhnValid(digits)) return match;
    return "[redacted-card]";
  });
}

export function redactCommunicationSecrets(value: string) {
  let next = value;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    next = next.replace(pattern, replacement);
  }
  return redactCardNumbers(next);
}

export function redactOptional(value: string | null | undefined) {
  if (value == null) return null;
  return redactCommunicationSecrets(value);
}
