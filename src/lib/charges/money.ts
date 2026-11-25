import type { ChargeLineItem } from "@/lib/charges/types";

export function formatChargeMoney(amount: number, wholeDollars = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    ...(wholeDollars && { maximumFractionDigits: 0, minimumFractionDigits: 0 }),
  }).format(amount);
}

export function formatChargeLineMoney(item: Pick<ChargeLineItem, "amount" | "catalogId">) {
  const isHandStripping = item.catalogId?.split("::")[0] === "hand-stripping";
  return formatChargeMoney(item.amount, isHandStripping && Number.isInteger(item.amount));
}

export function sumLineItems(items: ChargeLineItem[]) {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function dollarsToCents(amount: number) {
  return Math.round(amount * 100);
}
