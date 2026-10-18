export const NO_SHOW_WAIT_MS = 15 * 60 * 1000;
export const NO_SHOW_TIME_ZONE = "America/New_York";

export const NO_SHOW_CONTACT_CHANNELS = [
  "phone",
  "text_message",
  "email",
  "in_person",
  "other",
] as const;

export type NoShowContactChannel = (typeof NO_SHOW_CONTACT_CHANNELS)[number];

export function noShowConfirmDecision(input: {
  arrivedAt: string;
  contactAttemptedAt: string;
  customerReplied: boolean;
  handoffArranged: boolean;
  now?: Date;
}) {
  const arrived = Date.parse(input.arrivedAt);
  const contact = Date.parse(input.contactAttemptedAt);
  if (!Number.isFinite(arrived) || !Number.isFinite(contact)) {
    return { ok: false as const, reason: "invalid_time" as const };
  }
  if (contact < arrived) {
    return { ok: false as const, reason: "contact_before_arrival" as const };
  }
  if (input.customerReplied) {
    return { ok: false as const, reason: "customer_replied" as const };
  }
  if (input.handoffArranged) {
    return { ok: false as const, reason: "handoff_arranged" as const };
  }
  const now = input.now ?? new Date();
  if (now.getTime() - contact < NO_SHOW_WAIT_MS) {
    return { ok: false as const, reason: "wait_incomplete" as const };
  }
  return { ok: true as const };
}

function businessParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NO_SHOW_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = read("hour") === "24" ? "00" : read("hour");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour,
    minute: read("minute"),
  };
}

/** Show a stored instant on the Eastern clock used by the visit. */
export function noShowInstantToBusinessInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = businessParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Read an Eastern wall-clock entry as a UTC instant. */
export function noShowBusinessInputToInstant(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const desired = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
  let utc = desired;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = businessParts(new Date(utc));
    const shown = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    const next = utc + (desired - shown);
    if (next === utc) break;
    utc = next;
  }
  return new Date(utc).toISOString();
}
