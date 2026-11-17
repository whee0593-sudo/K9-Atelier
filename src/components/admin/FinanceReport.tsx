"use client";

import { useEffect, useState } from "react";
import {
  PREVIEW_FINANCE_DATE,
  buildPreviewFinanceCharges,
} from "@/lib/finance/preview";
import { buildFinanceReport, formatFinanceMoney } from "@/lib/finance/report";
import { financeToday, periodRange, shiftPeriod } from "@/lib/finance/dates";
import type { FinancePeriod, FinanceReport } from "@/lib/finance/types";

const PERIODS: { id: FinancePeriod; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
];

export function FinanceReport({ preview = false }: { preview?: boolean }) {
  const [period, setPeriod] = useState<FinancePeriod>(preview ? "quarter" : "week");
  const [date, setDate] = useState(preview ? PREVIEW_FINANCE_DATE : "");
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!date) {
      setDate(financeToday());
      return;
    }

    if (preview) {
      setReport(buildFinanceReport(period, date, buildPreviewFinanceCharges()));
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const response = await fetch(
          `/api/admin/finance?period=${period}&date=${date}`,
          { credentials: "include", signal: controller.signal },
        );
        const body = (await response.json()) as FinanceReport & { error?: string };
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setError(body.error ?? "Could not load finance.");
          return;
        }
        setReport(body);
      } catch {
        if (!controller.signal.aborted) setError("Could not load finance.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [date, period, preview]);

  const range = date ? periodRange(period, date) : null;
  const currentReport =
    report && report.period === period && report.startDate === range?.startDate
      ? report
      : null;
  const totals = currentReport?.totals;

  return (
    <section>
      <div className="rounded-2xl border border-lavender/30 bg-cream p-4 sm:p-5">
        <div role="group" aria-label="Report period" className="flex flex-wrap gap-2">
          {PERIODS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={period === entry.id}
              onClick={() => setPeriod(entry.id)}
              className={`rounded-xl px-4 py-2 text-sm ${
                period === entry.id
                  ? "bg-deep-lavender text-ivory"
                  : "border border-lavender/40 text-text"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            disabled={!date}
            onClick={() => setDate((current) => shiftPeriod(period, current, -1))}
            className="rounded-xl border border-lavender/40 px-3 py-1.5 text-sm"
          >
            Previous {period}
          </button>
          <p className="text-sm font-medium text-gold-dark">{range && (period === "week" ? `${range.label} (${range.endDate.slice(0, 4)})` : range.label)}</p>
          <button
            type="button"
            disabled={!date}
            onClick={() => setDate((current) => shiftPeriod(period, current, 1))}
            className="rounded-xl border border-lavender/40 px-3 py-1.5 text-sm"
          >
            Next {period}
          </button>
        </div>

        <label className="mt-4 block text-sm text-text-muted">
          Choose a date in the reporting period
          <input
            type="date"
            value={date}
            onChange={(event) => {
              if (event.target.value) setDate(event.target.value);
            }}
            className="mt-1 block rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm text-text"
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {error ? null : loading || !currentReport || !totals ? (
        <p role="status" className="mt-6 text-sm text-text-muted">Loading finance…</p>
      ) : (
        <>
          <div className="mt-6 grid overflow-hidden rounded-2xl border border-lavender/30 bg-cream md:grid-cols-2">
            <div className="bg-deep-lavender p-6 text-ivory">
              <h3 className="text-sm font-medium">Collected after refunds</h3>
              <p className="mt-2 text-4xl font-semibold tabular-nums">
                {formatFinanceMoney(totals.net)}
              </p>
              <p className="mt-3 text-sm">
                {totals.chargeCount} paid {totals.chargeCount === 1 ? "charge" : "charges"}
              </p>
            </div>
            <dl className="space-y-2 p-6 text-sm">
              <BreakdownRow label="Services & fees" amount={totals.service} />
              <BreakdownRow label="+ Tips" amount={totals.tip} />
              <BreakdownRow label="+ Tax" amount={totals.tax} />
              <BreakdownRow label="− Refunds" amount={totals.refunds} />
            </dl>
          </div>

          {period !== "day" && totals.chargeCount > 0 && (
            <details className="mt-6 rounded-2xl border border-lavender/30 bg-cream">
              <summary className="cursor-pointer px-5 py-4 font-medium text-gold-dark">
                Collections by {period === "week" ? "day" : "month"}
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm tabular-nums">
                  <thead className="bg-lavender-light/50 text-text-muted">
                    <tr>
                      <th scope="col" className="px-5 py-3">Date</th>
                      <th scope="col" className="px-5 py-3 text-right">Paid charges</th>
                      <th scope="col" className="px-5 py-3 text-right">After refunds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentReport.buckets.map((bucket) => (
                      <tr key={bucket.key} className="border-t border-lavender/20">
                        <th scope="row" className="px-5 py-3 font-normal">{bucket.label}</th>
                        <td className="px-5 py-3 text-right">{bucket.chargeCount}</td>
                        <td className="px-5 py-3 text-right">{formatFinanceMoney(bucket.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <h3 className="mt-10 text-lg font-medium text-gold-dark">
            Sales by item
          </h3>
          <p className="mt-1 text-sm text-text-muted">Item amounts before tips, tax, and refunds.</p>
          {currentReport.services.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-lavender/30 bg-cream p-6 text-sm text-text-muted">
              No paid items in this period.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {[...currentReport.services].sort((a, b) => b.revenue - a.revenue).map((service) => (
                <li
                  key={service.id}
                  className="flex items-center justify-between rounded-2xl border border-lavender/30 bg-cream px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-gold-dark">{service.name}</p>
                    <p className="text-sm text-text-muted">
                      {service.count === 1 ? "1 line item" : `${service.count} line items`}
                    </p>
                  </div>
                  <p className="text-sm text-text">
                    {formatFinanceMoney(service.revenue)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function BreakdownRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-medium tabular-nums text-text">{formatFinanceMoney(amount)}</dd>
    </div>
  );
}
