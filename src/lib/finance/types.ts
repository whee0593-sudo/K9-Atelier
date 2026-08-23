export type FinancePeriod = "day" | "week" | "quarter" | "year";

export type FinanceTotals = {
  service: number;
  tip: number;
  tax: number;
  refunds: number;
  net: number;
  chargeCount: number;
};

export type FinanceBucket = FinanceTotals & {
  key: string;
  label: string;
};

export type FinanceServiceRow = {
  id: string;
  name: string;
  count: number;
  revenue: number;
};

export type FinanceReport = {
  period: FinancePeriod;
  startDate: string;
  endDate: string;
  label: string;
  today: string;
  totals: FinanceTotals;
  buckets: FinanceBucket[];
  services: FinanceServiceRow[];
};
