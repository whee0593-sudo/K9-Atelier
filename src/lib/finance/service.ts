import { createAdminClient } from "@/lib/supabase/admin";
import { getStaffSession } from "@/lib/staff/auth";
import type { ChargeKind, ChargeLineItem } from "@/lib/charges/types";
import { paidAtToDate, periodRange } from "@/lib/finance/dates";
import {
  buildFinanceReport,
  type FinanceChargeRow,
} from "@/lib/finance/report";
import type { FinancePeriod, FinanceReport } from "@/lib/finance/types";

export async function getFinanceReport(
  period: FinancePeriod,
  anchor: string,
): Promise<
  | { report: FinanceReport }
  | { error: "unauthenticated" | "forbidden" | "conflict" | "server" }
> {
  const session = await getStaffSession();
  if ("error" in session) return { error: session.error };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor)) return { error: "conflict" };
  if (!["day", "week", "quarter", "year"].includes(period)) {
    return { error: "conflict" };
  }

  const range = periodRange(period, anchor);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("appointment_charges")
    .select(
      "id, kind, line_items, subtotal, tip_amount, total, paid_at, refunded_amount",
    )
    .eq("status", "paid")
    .gte("paid_at", `${addCalendarBuffer(range.startDate, -1)}T00:00:00.000Z`)
    .lte("paid_at", `${addCalendarBuffer(range.endDate, 1)}T23:59:59.999Z`);

  if (error) {
    console.error("getFinanceReport failed:", error.message);
    return { error: "server" };
  }

  const charges: FinanceChargeRow[] = (data ?? [])
    .filter((row) => row.paid_at)
    .map((row) => ({
      id: row.id as string,
      kind: row.kind as ChargeKind,
      lineItems: (row.line_items ?? []) as ChargeLineItem[],
      subtotal: Number(row.subtotal ?? 0),
      tipAmount: Number(row.tip_amount ?? 0),
      taxAmount: 0,
      total: Number(row.total ?? 0),
      refundedAmount: Number(
        (row as { refunded_amount?: number }).refunded_amount ?? 0,
      ),
      paidDate: paidAtToDate(row.paid_at as string),
    }));

  return { report: buildFinanceReport(period, anchor, charges) };
}

function addCalendarBuffer(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}
