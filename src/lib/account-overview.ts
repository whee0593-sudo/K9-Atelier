import type { AppointmentRecord } from "@/lib/appointments/types";

export function overviewAppointments(appointments: AppointmentRecord[], now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).formatToParts(now);
  const minutes = Number(parts.find(p => p.type === "hour")?.value) * 60 + Number(parts.find(p => p.type === "minute")?.value);
  const active = appointments.filter(a => a.status !== "cancelled");
  const upcoming = active.filter(a => a.appointmentDate > date || (a.appointmentDate === date && (a.scheduledStart == null || a.scheduledStart >= minutes)));
  const ordered = [...(upcoming.length ? upcoming : active)].sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate) || (a.scheduledStart ?? 0) - (b.scheduledStart ?? 0));
  const chosen = upcoming.length ? ordered[0] : ordered[ordered.length - 1];
  if (!chosen) return { upcoming: false, appointments: [] };
  return { upcoming: upcoming.length > 0, appointments: active.filter(a => chosen.visitId ? a.visitId === chosen.visitId : a.id === chosen.id) };
}
