const CLOCK = /(\d{1,2}):(\d{2})\s*(AM|PM)?/gi;

type Clock = {
  hour12: number;
  minute: number;
  period: "AM" | "PM";
};

function toPeriod(value: string): "AM" | "PM" {
  return value.toUpperCase() === "AM" ? "AM" : "PM";
}

function toMinutes(clock: Clock) {
  const hour = clock.hour12 % 12;
  return (clock.period === "PM" ? 12 * 60 : 0) + hour * 60 + clock.minute;
}

function oppositePeriod(period: "AM" | "PM"): "AM" | "PM" {
  return period === "AM" ? "PM" : "AM";
}

function formatClock(clock: Clock) {
  return `${clock.hour12}:${String(clock.minute).padStart(2, "0")} ${clock.period}`;
}

function parseClockParts(value: string) {
  const matches = [...value.matchAll(CLOCK)].map((match) => ({
    hour12: Number(match[1]),
    minute: Number(match[2]),
    period: match[3] ? toPeriod(match[3]) : null,
  }));
  return matches.filter(
    (part) =>
      Number.isFinite(part.hour12) &&
      part.hour12 >= 1 &&
      part.hour12 <= 12 &&
      Number.isFinite(part.minute) &&
      part.minute >= 0 &&
      part.minute <= 59,
  );
}

function parseTwentyFourHour(value: string): Clock | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour24) || hour24 < 0 || hour24 > 23) return null;
  if (!Number.isFinite(minute) || minute < 0 || minute > 59) return null;
  return {
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute,
    period: hour24 < 12 ? "AM" : "PM",
  };
}

function inferStartPeriod(
  startHour: number,
  startMinute: number,
  end: Clock,
): "AM" | "PM" {
  const same: Clock = {
    hour12: startHour,
    minute: startMinute,
    period: end.period,
  };
  const crossed: Clock = {
    hour12: startHour,
    minute: startMinute,
    period: oppositePeriod(end.period),
  };
  const sameDuration = toMinutes(end) - toMinutes(same);
  const crossedDuration =
    (toMinutes(end) - toMinutes(crossed) + 24 * 60) % (24 * 60) || 24 * 60;
  if (sameDuration > 0 && sameDuration <= 8 * 60) return end.period;
  if (crossedDuration > 0 && crossedDuration <= 8 * 60) {
    return oppositePeriod(end.period);
  }
  return sameDuration > 0 ? end.period : oppositePeriod(end.period);
}

export function formatAppointmentTimeRange(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const twentyFour = parseTwentyFourHour(trimmed);
  if (twentyFour) return formatClock(twentyFour);

  const parts = parseClockParts(trimmed);
  if (parts.length === 0) return trimmed;
  if (parts.length === 1 && parts[0]) {
    if (!parts[0].period) return trimmed;
    return formatClock({
      hour12: parts[0].hour12,
      minute: parts[0].minute,
      period: parts[0].period,
    });
  }

  const startPart = parts[0];
  const endPart = parts[1];
  if (!startPart || !endPart) return trimmed;

  const endPeriod = endPart.period ?? startPart.period;
  if (!endPeriod) return trimmed;
  const startPeriod =
    startPart.period ??
    inferStartPeriod(startPart.hour12, startPart.minute, {
      hour12: endPart.hour12,
      minute: endPart.minute,
      period: endPeriod,
    });

  return `${formatClock({
    hour12: startPart.hour12,
    minute: startPart.minute,
    period: startPeriod,
  })}–${formatClock({
    hour12: endPart.hour12,
    minute: endPart.minute,
    period: endPeriod,
  })}`;
}

export function hasAppointmentTime(value: string | null | undefined) {
  return Boolean(formatAppointmentTimeRange(value));
}
