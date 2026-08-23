import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/staff/auth";
import { getRoutingConfig } from "@/lib/booking-schedule";
import { todayInBusinessTimezone } from "@/lib/sms/schedule";

export type AdminCalendarDay = {
  date: string;
  appointmentCount: number;
  isPast: boolean;
  isFull: boolean;
  isToday: boolean;
};

function lastDayOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export async function listAdminCalendarMonth(
  month: string,
): Promise<
  | { month: string; today: string; maxPerDay: number; days: AdminCalendarDay[] }
  | { error: "unauthenticated" | "forbidden" | "conflict" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "conflict" };

  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) {
    return { error: "conflict" };
  }

  const fromDate = `${month}-01`;
  const toDate = `${month}-${String(lastDayOfMonth(year, monthIndex)).padStart(2, "0")}`;
  const today = todayInBusinessTimezone();
  const maxPerDay = getRoutingConfig().maxAppointmentsPerDay;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointments")
    .select("appointment_date")
    .gte("appointment_date", fromDate)
    .lte("appointment_date", toDate)
    .neq("status", "cancelled");

  if (error) {
    console.error("listAdminCalendarMonth failed:", error.message);
    return { error: "server" };
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const date = row.appointment_date as string;
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }

  const days: AdminCalendarDay[] = [];
  const last = lastDayOfMonth(year, monthIndex);
  for (let day = 1; day <= last; day += 1) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const appointmentCount = counts.get(date) ?? 0;
    days.push({
      date,
      appointmentCount,
      isPast: date < today,
      isFull: appointmentCount >= maxPerDay,
      isToday: date === today,
    });
  }

  return { month, today, maxPerDay, days };
}
