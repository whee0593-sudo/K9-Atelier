"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PREVIEW_FINANCE_DATE,
  buildPreviewFinanceCharges,
} from "@/lib/finance/preview";
import { buildFinanceReport, formatFinanceMoney } from "@/lib/finance/report";
import { shiftPeriod } from "@/lib/finance/dates";
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

  const load = useCallback(
    async (nextPeriod: FinancePeriod, nextDate: string) => {
      setLoading(true);
      setError(null);
      if (preview) {
        setReport(
          buildFinanceReport(
            nextPeriod,
            nextDate,
            buildPreviewFinanceCharges(),
          ),
        );
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(
          `/api/admin/finance?period=${nextPeriod}&date=${nextDate}`,
          { credentials: "include" },
        );
        const body = (await response.json()) as FinanceReport & { error?: string };
        if (!response.ok) {
          setError(body.error ?? "Could not load finance.");
          return;
        }
        setReport(body);
      } catch {
        setError("Could not load finance.");
      } finally {
        setLoading(false);
      }
    },
    [preview],
  );

  useEffect(() => {
    if (preview) {
      void load(period, date);
      return;
    }
    if (!date) {
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      setDate(today);
      return;
    }
    void load(period, date);
  }, [date, load, period, preview]);

  const totals = report?.totals;

  return (
    <section>
      <div className="flex flex-wrap gap-2">
        {PERIODS.map((entry) => (
          <button
            key={entry.id}
            type="button"
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
          onClick={() => setDate((current) => shiftPeriod(period, current, -1))}
          className="rounded-xl border border-lavender/40 px-3 py-1.5 text-sm"
        >
          Previous
        </button>
        <p className="text-sm font-medium text-gold-dark">{report?.label ?? "—"}</p>
        <button
          type="button"
          onClick={() => setDate((current) => shiftPeriod(period, current, 1))}
          className="rounded-xl border border-lavender/40 px-3 py-1.5 text-sm"
        >
          Next
        </button>
      </div>

      <label className="mt-4 block text-sm text-text-muted">
        Jump to date
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="mt-1 block rounded-xl border border-lavender/40 bg-white px-3 py-2 text-sm text-text"
        />
      </label>

      {error ? (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {loading || !totals ? (
        <p className="mt-6 text-sm text-text-muted">Loading finance…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard label="Service" value={formatFinanceMoney(totals.service)} />
            <SummaryCard label="Tips" value={formatFinanceMoney(totals.tip)} />
            <SummaryCard
              label="Tax"
              value={formatFinanceMoney(totals.tax)}
              note="Florida grooming service is not taxed"
            />
            <SummaryCard label="Refunds" value={formatFinanceMoney(totals.refunds)} />
            <SummaryCard
              label="Net"
              value={formatFinanceMoney(totals.net)}
              note={`${totals.chargeCount} paid charge${totals.chargeCount === 1 ? "" : "s"}`}
            />
          </div>

          <h3 className="mt-10 text-lg font-medium text-gold-dark">
            {period === "day"
              ? "That day"
              : period === "week"
                ? "Each day"
                : period === "quarter"
                  ? "Each month"
                  : "Each month"}
          </h3>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-lavender/30">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-lavender-light/50 text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Period</th>
                  <th className="px-4 py-3 font-medium">Service</th>
                  <th className="px-4 py-3 font-medium">Tips</th>
                  <th className="px-4 py-3 font-medium">Tax</th>
                  <th className="px-4 py-3 font-medium">Refunds</th>
                  <th className="px-4 py-3 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {report.buckets.map((bucket) => (
                  <tr key={bucket.key} className="border-t border-lavender/20">
                    <td className="px-4 py-3 text-text">{bucket.label}</td>
                    <td className="px-4 py-3">{formatFinanceMoney(bucket.service)}</td>
                    <td className="px-4 py-3">{formatFinanceMoney(bucket.tip)}</td>
                    <td className="px-4 py-3">{formatFinanceMoney(bucket.tax)}</td>
                    <td className="px-4 py-3">{formatFinanceMoney(bucket.refunds)}</td>
                    <td className="px-4 py-3 font-medium text-gold-dark">
                      {formatFinanceMoney(bucket.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-10 text-lg font-medium text-gold-dark">
            Services sold
          </h3>
          {report.services.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-lavender/30 bg-cream p-6 text-sm text-text-muted">
              No paid services in this period.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {report.services.map((service) => (
                <li
                  key={service.id}
                  className="flex items-center justify-between rounded-2xl border border-lavender/30 bg-cream px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-gold-dark">{service.name}</p>
                    <p className="text-sm text-text-muted">
                      {service.count === 1 ? "1 time" : `${service.count} times`}
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

function SummaryCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-lavender/30 bg-cream p-4">
      <p className="text-xs uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 text-xl font-medium text-gold-dark">{value}</p>
      {note ? <p className="mt-1 text-xs text-text-muted">{note}</p> : null}
    </div>
  );
}
