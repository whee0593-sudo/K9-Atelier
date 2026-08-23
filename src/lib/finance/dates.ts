import { business } from "@/lib/business";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";
import type { FinancePeriod } from "@/lib/finance/types";

const TIMEZONE = business.booking.timezone;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function financeToday() {
  return todayInBusinessTimezone();
}

export function paidAtToDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function addCalendarDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function mondayIndex(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 6 : weekday - 1;
}

export function longDateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function monthLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function shortDateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function periodRange(period: FinancePeriod, anchor: string) {
  if (period === "day") {
    return {
      startDate: anchor,
      endDate: anchor,
      label: longDateLabel(anchor),
    };
  }

  if (period === "week") {
    const startDate = addCalendarDays(anchor, -mondayIndex(anchor));
    const endDate = addCalendarDays(startDate, 6);
    return {
      startDate,
      endDate,
      label: `${shortDateLabel(startDate)} – ${shortDateLabel(endDate)}`,
    };
  }

  const [yearText, monthText] = anchor.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  if (period === "quarter") {
    const quarter = Math.floor((month - 1) / 3);
    const startMonth = quarter * 3 + 1;
    const endMonth = startMonth + 2;
    const startDate = `${year}-${pad(startMonth)}-01`;
    const endDate = `${year}-${pad(endMonth)}-${pad(new Date(year, endMonth, 0).getDate())}`;
    return {
      startDate,
      endDate,
      label: `Q${quarter + 1} ${year}`,
    };
  }

  return {
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    label: String(year),
  };
}

export function shiftPeriod(period: FinancePeriod, anchor: string, delta: number) {
  if (period === "day") return addCalendarDays(anchor, delta);
  if (period === "week") return addCalendarDays(anchor, delta * 7);

  const [yearText, monthText, dayText] = anchor.split("-").map(Number);
  if (period === "quarter") {
    const next = new Date(yearText, monthText - 1 + delta * 3, 1);
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(Math.min(dayText, last))}`;
  }

  return `${yearText + delta}-${pad(monthText)}-${pad(dayText)}`;
}

export function bucketKeys(period: FinancePeriod, startDate: string, endDate: string) {
  if (period === "day") {
    return [{ key: startDate, label: longDateLabel(startDate) }];
  }

  if (period === "week") {
    const keys = [];
    for (let i = 0; i < 7; i += 1) {
      const date = addCalendarDays(startDate, i);
      keys.push({ key: date, label: shortDateLabel(date) });
    }
    return keys;
  }

  if (period === "quarter") {
    const keys = [];
    const start = new Date(`${startDate}T12:00:00`);
    for (let i = 0; i < 3; i += 1) {
      const month = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = `${month.getFullYear()}-${pad(month.getMonth() + 1)}`;
      keys.push({
        key,
        label: month.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      });
    }
    return keys;
  }

  const year = startDate.slice(0, 4);
  return Array.from({ length: 12 }, (_, index) => {
    const key = `${year}-${pad(index + 1)}`;
    return {
      key,
      label: new Date(`${key}-01T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
      }),
    };
  }).filter((bucket) => bucket.key + "-01" <= endDate);
}

export function bucketKeyForDate(period: FinancePeriod, date: string) {
  if (period === "year" || period === "quarter") return date.slice(0, 7);
  return date;
}
