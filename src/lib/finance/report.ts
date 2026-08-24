import { formatChargeMoney } from "@/lib/charges/money";
import type { ChargeKind, ChargeLineItem } from "@/lib/charges/types";
import { getCatalogItemDisplayLabel } from "@/lib/service-display";
import {
  bucketKeyForDate,
  bucketKeys,
  financeToday,
  periodRange,
} from "@/lib/finance/dates";
import type {
  FinancePeriod,
  FinanceReport,
  FinanceServiceRow,
  FinanceTotals,
} from "@/lib/finance/types";

export type FinanceChargeRow = {
  id: string;
  kind: ChargeKind;
  lineItems: ChargeLineItem[];
  subtotal: number;
  tipAmount: number;
  taxAmount: number;
  total: number;
  refundedAmount: number;
  paidDate: string;
};

function money(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function emptyTotals(): FinanceTotals {
  return {
    service: 0,
    tip: 0,
    tax: 0,
    refunds: 0,
    net: 0,
    chargeCount: 0,
  };
}

function addTotals(target: FinanceTotals, charge: FinanceChargeRow) {
  target.service = money(target.service + charge.subtotal);
  target.tip = money(target.tip + charge.tipAmount);
  target.tax = money(target.tax + charge.taxAmount);
  target.refunds = money(target.refunds + charge.refundedAmount);
  target.net = money(target.net + charge.total - charge.refundedAmount);
  target.chargeCount += 1;
}

function serviceIdentity(item: ChargeLineItem) {
  if (item.catalogId === "no-show" || /no-show/i.test(item.label)) {
    return { id: "no-show", name: "No-show fee" };
  }
  if (item.catalogId === "travel-fee") {
    return { id: "travel-fee", name: "Travel fee" };
  }
  return {
    id: item.catalogId ?? item.label.toLowerCase().replace(/\s+/g, "-"),
    name: getCatalogItemDisplayLabel(item.catalogId, item.label),
  };
}

export function buildFinanceReport(
  period: FinancePeriod,
  anchor: string,
  charges: FinanceChargeRow[],
): FinanceReport {
  const range = periodRange(period, anchor);
  const inRange = charges.filter(
    (charge) =>
      charge.paidDate >= range.startDate && charge.paidDate <= range.endDate,
  );

  const totals = emptyTotals();
  const buckets = bucketKeys(period, range.startDate, range.endDate).map(
    (bucket) => ({ ...bucket, ...emptyTotals() }),
  );
  const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  const services = new Map<string, FinanceServiceRow>();

  for (const charge of inRange) {
    addTotals(totals, charge);
    const bucket = bucketByKey.get(bucketKeyForDate(period, charge.paidDate));
    if (bucket) addTotals(bucket, charge);

    for (const item of charge.lineItems) {
      const identity = serviceIdentity(item);
      const current = services.get(identity.id) ?? {
        id: identity.id,
        name: identity.name,
        count: 0,
        revenue: 0,
      };
      current.count += 1;
      current.revenue = money(current.revenue + item.amount);
      services.set(identity.id, current);
    }
  }

  return {
    period,
    startDate: range.startDate,
    endDate: range.endDate,
    label: range.label,
    today: financeToday(),
    totals,
    buckets,
    services: [...services.values()].sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return right.revenue - left.revenue;
    }),
  };
}

export function formatFinanceMoney(amount: number) {
  return formatChargeMoney(amount);
}
