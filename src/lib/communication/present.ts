import { business } from "@/lib/business";
import { digitsOnly } from "@/lib/sms/phone";

const TIME_ZONE = business.booking.timezone || "America/New_York";

export const UNKNOWN_CALLER_LABEL = "Unknown Caller";

export type CommunicationFilter = "all" | "messages" | "calls" | "unread";

export type InboxPreviewInput = {
  message: {
    at: string;
    direction: "inbound" | "outbound";
    body: string;
  } | null;
  call: {
    at: string;
    direction: "inbound" | "outbound";
    status: string;
    answered: boolean | null;
  } | null;
  missedUnhandled: boolean;
};

export type InboxRow = {
  id: string;
  phoneDisplay: string;
  title: string;
  petNames: string;
  preview: string;
  timeLabel: string;
  activityAt: string;
  unread: boolean;
  missed: boolean;
  unknown: boolean;
  hasMessage: boolean;
  hasCall: boolean;
  customerId: string | null;
};

const LIVE_ORDER = ["queued", "initiated", "ringing", "connecting", "in-progress"];
const TERMINAL_CALL_STATUSES = new Set([
  "completed",
  "busy",
  "no-answer",
  "failed",
  "canceled",
]);
const MISSED_CALL_STATUSES = new Set(["busy", "no-answer", "failed", "canceled"]);

export function parseCommunicationFilter(value: string | undefined): CommunicationFilter {
  if (value === "messages" || value === "calls" || value === "unread") return value;
  return "all";
}

export function formatDisplayPhone(value: string) {
  const digits = digitsOnly(value);
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length !== 10) return value.trim();
  return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
}

export function communicationMessageBody(body: string, mediaCount = 0) {
  const text = body.replace(/\s+/g, " ").trim();
  if (text) return text;
  if (mediaCount === 1) return "Photo";
  if (mediaCount > 1) return `${mediaCount} photos`;
  return "";
}

export function messageListPreview(body: string) {
  const clean = communicationMessageBody(body);
  if (!clean) return "Message";
  const clipped = clean.length > 84 ? `${clean.slice(0, 81)}…` : clean;
  return `“${clipped}”`;
}

export function isMissedCallStatus(status: string) {
  return MISSED_CALL_STATUSES.has(status.trim().toLowerCase());
}

export function isTerminalCallStatus(status: string) {
  return TERMINAL_CALL_STATUSES.has(status.trim().toLowerCase());
}

export function mergeCallStatus(current: string, incoming: string) {
  const next = incoming === "answered" ? "in-progress" : incoming.trim().toLowerCase();
  const cur = current === "answered" ? "in-progress" : current.trim().toLowerCase();
  if (!next) return cur || "ringing";
  if (TERMINAL_CALL_STATUSES.has(cur) && !TERMINAL_CALL_STATUSES.has(next)) return cur;
  if (TERMINAL_CALL_STATUSES.has(next)) return next;
  const currentIndex = LIVE_ORDER.indexOf(cur);
  const nextIndex = LIVE_ORDER.indexOf(next);
  if (currentIndex === -1) return next;
  if (nextIndex === -1) return cur;
  return nextIndex >= currentIndex ? next : cur;
}

export function statusFromParentCallback(callStatus: string) {
  const status = callStatus.trim().toLowerCase();
  if (status === "in-progress" || status === "answered") return "connecting";
  return status || "ringing";
}

export function statusFromCustomerLeg(callStatus: string) {
  const status = callStatus.trim().toLowerCase();
  if (status === "in-progress" || status === "answered") return "in-progress";
  if (status === "queued" || status === "initiated" || status === "ringing") {
    return "connecting";
  }
  return status || "connecting";
}

export function answeredFromStatus(status: string, previous: boolean | null) {
  if (status === "in-progress") return true;
  if (isMissedCallStatus(status)) return false;
  if (status === "completed") return previous === true ? true : previous;
  return previous;
}

export function liveCallLabel(status: string) {
  switch (status.trim().toLowerCase()) {
    case "queued":
    case "initiated":
    case "ringing":
      return "Calling…";
    case "connecting":
      return "Connecting…";
    case "in-progress":
    case "answered":
      return "Connected";
    default:
      return null;
  }
}

export function endedCallLabel() {
  return "Call ended";
}

export function callBannerLabel(input: {
  status: string;
  endedAt?: string | null;
  now?: number;
}) {
  const live = liveCallLabel(input.status);
  if (live) return live;
  if (!input.endedAt || !isTerminalCallStatus(input.status)) return null;
  const ended = Date.parse(input.endedAt);
  const now = input.now ?? Date.now();
  if (!Number.isFinite(ended) || now - ended > 20_000) return null;
  return endedCallLabel();
}

export function parseDurationSeconds(value: string | number | null | undefined) {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

export function formatCallDuration(seconds: number | null | undefined) {
  if (seconds == null || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  if (minutes === 0) return `${remain} sec`;
  if (remain === 0) return `${minutes} min`;
  return `${minutes} min ${remain} sec`;
}

export function communicationBadgeCount(input: {
  unreadConversations: number;
  unhandledMissedCalls: number;
}) {
  return (
    Math.max(0, input.unreadConversations) +
    Math.max(0, input.unhandledMissedCalls)
  );
}

export function matchesInboxFilter(row: InboxRow, filter: CommunicationFilter) {
  if (filter === "messages") return row.hasMessage;
  if (filter === "calls") return row.hasCall;
  if (filter === "unread") return row.unread || row.missed;
  return true;
}

function etDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDayKey(key: string, days: number) {
  const [year, month, day] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function formatEtTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatActivityAge(iso: string, now = Date.now()) {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const diff = Math.max(0, now - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr`;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
  }).format(new Date(then));
}

export function formatMissedCallWhen(iso: string, now = new Date()) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = formatEtTime(date);
  const day = etDayKey(date);
  const today = etDayKey(now);
  if (day === today) return `Today · ${time}`;
  if (day === shiftDayKey(today, -1)) return `Yesterday · ${time}`;
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
  }).format(date);
  return `${label} · ${time}`;
}

export function callerTitle(input: {
  firstName?: string | null;
  name?: string | null;
}) {
  const first = input.firstName?.trim();
  if (first) return first;
  const name = input.name?.trim();
  if (name) return name.split(/\s+/)[0];
  return UNKNOWN_CALLER_LABEL;
}

export function chooseInboxPreview(input: InboxPreviewInput) {
  const callMissed = Boolean(
    input.call &&
      (input.call.answered === false || isMissedCallStatus(input.call.status)) &&
      input.call.direction === "inbound",
  );
  if (input.missedUnhandled && callMissed && input.call) {
    const inboundAfterCall =
      input.message?.direction === "inbound" &&
      Date.parse(input.message.at) > Date.parse(input.call.at);
    if (!inboundAfterCall) {
      return {
        kind: "call" as const,
        preview: "Missed Call",
        at: input.call.at,
      };
    }
  }

  const messageAt = input.message ? Date.parse(input.message.at) : 0;
  const callAt = input.call ? Date.parse(input.call.at) : 0;
  if (input.call && callAt >= messageAt) {
    return {
      kind: "call" as const,
      preview: callPreview(input.call),
      at: input.call.at,
    };
  }
  if (input.message) {
    return {
      kind: "message" as const,
      preview: messageListPreview(input.message.body),
      at: input.message.at,
    };
  }
  return { kind: "message" as const, preview: "New conversation", at: "" };
}

function callPreview(call: NonNullable<InboxPreviewInput["call"]>) {
  if (call.direction === "outbound") {
    return liveCallLabel(call.status) ?? "Outbound call";
  }
  if (call.answered === false || isMissedCallStatus(call.status)) return "Missed Call";
  if (liveCallLabel(call.status)) return "Incoming call";
  return "Incoming call";
}

export function threadCallLabel(input: {
  direction: "inbound" | "outbound";
  status: string;
  answered: boolean | null;
}) {
  const live = liveCallLabel(input.status);
  if (input.direction === "outbound" && live) return live;
  if (input.direction === "inbound" && (input.answered === false || isMissedCallStatus(input.status))) {
    return "Missed Call";
  }
  if (input.direction === "outbound") return "Outbound call";
  return "Incoming call";
}
