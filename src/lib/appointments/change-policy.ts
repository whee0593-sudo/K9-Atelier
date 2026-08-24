export type AppointmentChangeAction =
  | "reschedule"
  | "cancel"
  | "add_dog"
  | "remove_dog";

export type ChangeNoticeBand = "complimentary" | "late" | "same_day";

const TIMEZONE = "America/New_York";

function nyParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function daysBetween(fromDate: string, toDate: string) {
  const from = Date.parse(`${fromDate}T12:00:00Z`);
  const to = Date.parse(`${toDate}T12:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export function hoursUntilAppointment(
  appointmentDate: string,
  scheduledStart: number | null,
  now = new Date(),
) {
  const nowNy = nyParts(now);
  const startMinutes = scheduledStart ?? 9 * 60;
  const dayDiff = daysBetween(nowNy.date, appointmentDate);
  return (dayDiff * 24 * 60 + startMinutes - nowNy.minutes) / 60;
}

export function changeNoticeBand(
  appointmentDate: string,
  scheduledStart: number | null,
  now = new Date(),
): ChangeNoticeBand {
  const today = nyParts(now).date;
  if (appointmentDate === today) return "same_day";
  if (hoursUntilAppointment(appointmentDate, scheduledStart, now) >= 48) {
    return "complimentary";
  }
  return "late";
}

export function changeFeePercent(
  action: AppointmentChangeAction,
  band: ChangeNoticeBand,
) {
  if (action === "add_dog") return 0;
  if (band === "complimentary") return 0;
  if (band === "late") return 0.5;
  return 1;
}

export function roundChangeFee(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function changeFeeAmount(
  action: AppointmentChangeAction,
  estimatedTotal: number,
  band: ChangeNoticeBand,
) {
  return roundChangeFee(estimatedTotal * changeFeePercent(action, band));
}

export function changeFeeWarning(fee: number) {
  const dollars = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(fee);
  return `This change will incur a ${dollars} fee. Tapping Confirm will charge your card.`;
}
