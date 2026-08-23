import { allBookableServices } from "@/lib/services";

const BUSINESS_TIME_ZONE = "America/New_York";

export function hourlyRateForCatalogId(catalogId?: string) {
  if (!catalogId) return null;
  const serviceId = catalogId.split("::")[0];
  const service = allBookableServices().find((entry) => entry.id === serviceId);
  if (service?.pricingType === "hourly" && service.hourlyRate) {
    return service.hourlyRate;
  }
  return null;
}

export function hourlyAmountFromTimes(
  startedAt: string,
  endedAt: string | null,
  rate: number,
  now = Date.now(),
) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  return Math.round(((end - start) / 3_600_000) * rate * 100) / 100;
}

export function formatVisitClock(iso: string, timeZone = BUSINESS_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatVisitDuration(
  startedAt: string,
  endedAt: string | null,
  now = Date.now(),
) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now;
  const minutes = Math.max(0, Math.floor((end - start) / 60_000));
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  if (hours === 0) return `${remain} min`;
  if (remain === 0) return hours === 1 ? "1 hr" : `${hours} hr`;
  return `${hours} hr ${remain} min`;
}

export function formatVisitTimeRange(
  startedAt: string | null,
  endedAt: string | null,
  timeZone = BUSINESS_TIME_ZONE,
) {
  if (!startedAt) return "Not started";
  const start = formatVisitClock(startedAt, timeZone);
  if (!endedAt) return `from ${start} to —`;
  return `from ${start} to ${formatVisitClock(endedAt, timeZone)}`;
}

export function formatStaffVisitTiming(
  startedAt: string | null,
  endedAt: string | null,
  timeZone = BUSINESS_TIME_ZONE,
) {
  if (!startedAt) return "Check-in not recorded";
  const start = formatVisitClock(startedAt, timeZone);
  if (!endedAt) return `Check-in ${start} · still in progress`;
  return `Check-in ${start} · Check-out ${formatVisitClock(endedAt, timeZone)}`;
}
