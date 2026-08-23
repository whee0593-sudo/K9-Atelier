import type { ChargeLineItem } from "@/lib/charges/types";

export function formatChargeMoney(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function sumLineItems(items: ChargeLineItem[]) {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function dollarsToCents(amount: number) {
  return Math.round(amount * 100);
}
