import { NextResponse } from "next/server";
import { mapStaffServiceError, staffJsonError } from "@/lib/staff/api-errors";
import { financeToday } from "@/lib/finance/dates";
import { getFinanceReport } from "@/lib/finance/service";
import type { FinancePeriod } from "@/lib/finance/types";

const PERIODS = new Set<FinancePeriod>(["day", "week", "quarter", "year"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const period = (params.get("period") ?? "week") as FinancePeriod;
  const date = params.get("date") ?? financeToday();

  if (!PERIODS.has(period)) {
    return staffJsonError("Choose day, week, quarter, or year.", 400);
  }

  const result = await getFinanceReport(period, date);
  if ("error" in result) {
    if (result.error === "conflict") {
      return staffJsonError("Choose a date as YYYY-MM-DD.", 400);
    }
    return mapStaffServiceError(result.error);
  }

  return NextResponse.json(result.report);
}
