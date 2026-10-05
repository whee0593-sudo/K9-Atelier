import { getDayBounds } from "@/lib/booking-schedule";
import { parseDateValue } from "@/lib/booking-slots";
import { formatMinutesLabel } from "@/lib/appointments/closures";

export type AvailabilityBlock = {
  id: string;
  serviceDate: string;
  allDay: boolean;
  /** Local minutes from midnight. Null when allDay is true. */
  startMinutes: number | null;
  endMinutes: number | null;
  reason: string | null;
};

export type AvailabilityBlockDraft = Omit<AvailabilityBlock, "id">;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REASON_LIMIT = 160;

export function staffAvailabilityAccessStatus(
  session: { error: "unauthenticated" | "forbidden" } | { user: unknown },
): 401 | 403 | null {
  if ("error" in session) {
    return session.error === "forbidden" ? 403 : 401;
  }
  return null;
}

export function listBlockTimeOptions() {
  const { hoursStart, hoursEnd } = getDayBounds();
  const options: number[] = [];
  for (let minute = hoursStart; minute <= hoursEnd; minute += 15) {
    options.push(minute);
  }
  return options;
}

export function normalizeAvailabilityBlockInput(input: {
  serviceDate?: string;
  allDay?: boolean;
  startMinutes?: number | null;
  endMinutes?: number | null;
  reason?: string | null;
}): { ok: true; value: AvailabilityBlockDraft } | { ok: false; error: string } {
  const serviceDate = input.serviceDate?.trim() ?? "";
  if (!DATE_PATTERN.test(serviceDate)) {
    return { ok: false, error: "Date must be YYYY-MM-DD." };
  }
  const parsed = parseDateValue(serviceDate);
  if (Number.isNaN(parsed.getTime())) {
    return { ok: false, error: "Date must be YYYY-MM-DD." };
  }

  const reasonRaw = (input.reason ?? "").trim();
  if (reasonRaw.length > REASON_LIMIT) {
    return {
      ok: false,
      error: `Reason must be ${REASON_LIMIT} characters or fewer.`,
    };
  }
  const reason = reasonRaw.length > 0 ? reasonRaw : null;

  if (input.allDay) {
    return {
      ok: true,
      value: {
        serviceDate,
        allDay: true,
        startMinutes: null,
        endMinutes: null,
        reason,
      },
    };
  }

  const startMinutes = input.startMinutes;
  const endMinutes = input.endMinutes;
  const { hoursStart, hoursEnd } = getDayBounds();
  if (!Number.isInteger(startMinutes) || !Number.isInteger(endMinutes)) {
    return { ok: false, error: "Choose a start and end time." };
  }
  if (
    startMinutes! % 15 !== 0 ||
    endMinutes! % 15 !== 0 ||
    startMinutes! < hoursStart ||
    endMinutes! > hoursEnd ||
    startMinutes! >= endMinutes!
  ) {
    return {
      ok: false,
      error: "End time must be after the start time, within studio hours.",
    };
  }

  return {
    ok: true,
    value: {
      serviceDate,
      allDay: false,
      startMinutes: startMinutes!,
      endMinutes: endMinutes!,
      reason,
    },
  };
}

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
) {
  return startA < endB && startB < endA;
}

export function availabilityBlockConflictMessage(
  existing: AvailabilityBlock[],
  next: AvailabilityBlockDraft,
  ignoreId?: string,
): string | null {
  const others = existing.filter((block) => block.id !== ignoreId);
  if (next.allDay) {
    return others.some((block) => block.allDay)
      ? "This day is already unavailable."
      : null;
  }
  if (others.some((block) => block.allDay)) {
    return "This day is already unavailable.";
  }
  const overlaps = others.some((block) => {
    if (block.startMinutes == null || block.endMinutes == null) return false;
    return rangesOverlap(
      next.startMinutes!,
      next.endMinutes!,
      block.startMinutes,
      block.endMinutes,
    );
  });
  return overlaps ? "That time overlaps another blocked period." : null;
}

export function appointmentOverlapsBlocks(
  blocks: AvailabilityBlock[],
  startMinutes: number,
  durationMinutes: number,
) {
  const endMinutes = startMinutes + Math.max(durationMinutes, 1);
  return blocks.some((block) => {
    if (block.allDay) return true;
    if (block.startMinutes == null || block.endMinutes == null) return false;
    return rangesOverlap(
      startMinutes,
      endMinutes,
      block.startMinutes,
      block.endMinutes,
    );
  });
}

export function applyBlocksToSlots(
  slots: number[],
  blocks: AvailabilityBlock[],
  durationMinutes: number,
) {
  if (blocks.some((block) => block.allDay)) {
    return { available: false, slots: [] as number[] };
  }
  const open = slots.filter(
    (start) => !appointmentOverlapsBlocks(blocks, start, durationMinutes),
  );
  return { available: open.length > 0, slots: open };
}

export function groupBlocksByDate(blocks: AvailabilityBlock[]) {
  const grouped = new Map<string, AvailabilityBlock[]>();
  for (const block of blocks) {
    const current = grouped.get(block.serviceDate) ?? [];
    current.push(block);
    grouped.set(block.serviceDate, current);
  }
  for (const dayBlocks of grouped.values()) {
    dayBlocks.sort(compareBlocks);
  }
  return grouped;
}

function compareBlocks(a: AvailabilityBlock, b: AvailabilityBlock) {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return (a.startMinutes ?? 0) - (b.startMinutes ?? 0);
}

function compactClock(totalMinutes: number) {
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  if (minute === 0) return String(hour12);
  return `${hour12}:${String(minute).padStart(2, "0")}`;
}

/** Month-cell label. One partial block stays short; several become a count. */
export function availabilityBlockLabel(
  blocks: AvailabilityBlock[],
): string | null {
  if (blocks.length === 0) return null;
  if (blocks.some((block) => block.allDay)) return "Unavailable";
  if (blocks.length > 1) return `${blocks.length} blocks`;
  const block = blocks[0]!;
  if (block.startMinutes == null || block.endMinutes == null) return "Blocked";
  return `Blocked ${compactClock(block.startMinutes)}–${compactClock(block.endMinutes)}`;
}

export function formatBlockRange(block: AvailabilityBlock) {
  if (block.allDay || block.startMinutes == null || block.endMinutes == null) {
    return "Unavailable — All Day";
  }
  return `${formatMinutesLabel(block.startMinutes)} – ${formatMinutesLabel(block.endMinutes)}`;
}

export function formatMenuDate(iso: string) {
  return parseDateValue(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatFullDate(iso: string) {
  return parseDateValue(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatMonthDay(iso: string) {
  return parseDateValue(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export type DayTimelineEntry = {
  kind: "appointment" | "block";
  at: number;
  id: string;
  timeLabel: string;
  title: string;
};

export function parseLooseClock(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  const upper = value.toUpperCase();
  const hasMeridiem = upper.includes("AM") || upper.includes("PM");
  if (hasMeridiem) {
    if (hour > 12 || hour === 0) return null;
    if (upper.includes("PM") && hour < 12) hour += 12;
    if (upper.includes("AM") && hour === 12) hour = 0;
  }
  return hour * 60 + minute;
}

export function buildDayTimeline(input: {
  appointments: Array<{
    id: string;
    petName: string;
    serviceName: string;
    scheduledStart: number | null;
    appointmentTime: string;
  }>;
  blocks: AvailabilityBlock[];
}): DayTimelineEntry[] {
  const appointments: DayTimelineEntry[] = input.appointments.map(
    (appointment) => {
      const parsed =
        typeof appointment.scheduledStart === "number"
          ? appointment.scheduledStart
          : parseLooseClock(appointment.appointmentTime);
      const at = parsed ?? 24 * 60;
      return {
        kind: "appointment",
        at,
        id: appointment.id,
        timeLabel:
          typeof appointment.scheduledStart === "number"
            ? formatMinutesLabel(appointment.scheduledStart)
            : appointment.appointmentTime,
        title: `${appointment.petName} — ${appointment.serviceName}`,
      };
    },
  );
  const blocks: DayTimelineEntry[] = input.blocks.map((block) => ({
    kind: "block",
    at: block.allDay ? -1 : (block.startMinutes ?? 0),
    id: block.id,
    timeLabel: formatBlockRange(block),
    title: block.reason ? `Blocked · ${block.reason}` : "Blocked",
  }));
  return [...appointments, ...blocks].sort(
    (a, b) => a.at - b.at || a.kind.localeCompare(b.kind),
  );
}
