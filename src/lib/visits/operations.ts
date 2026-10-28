import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import { groupByVisit } from "./notification-scope";

/** A stop is one explicit visit, never merely the same owner or date. */
export function operationalVisits(rows: AdminAppointmentRecord[]) {
  return groupByVisit(rows.filter(row => row.status !== "cancelled")).map(pets => {
    const ordered = [...pets].sort((a,b) => (a.scheduledStart ?? 1440) - (b.scheduledStart ?? 1440));
    const first = ordered[0]!;
    const starts = ordered.map(p => p.serviceStartedAt).filter((v): v is string => Boolean(v)).sort();
    const ends = ordered.map(p => p.serviceEndedAt).filter((v): v is string => Boolean(v)).sort();
    return { pets: ordered, appointment: {
      ...first,
      serviceStartedAt: first.visitStartedAt ?? starts[0] ?? null,
      serviceEndedAt: first.visitEndedAt ?? (ends.length === ordered.length ? ends[ends.length-1] : null),
      enRouteSmsSentAt: ordered.find(p => p.enRouteSmsSentAt)?.enRouteSmsSentAt ?? null,
    } };
  });
}
