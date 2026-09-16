import { hourlyRateForCatalogId } from "@/lib/charges/hourly";
import { formatChargeMoney } from "@/lib/charges/money";
import type { CatalogChargeItem, ChargeLineItem } from "@/lib/charges/types";

function roundedCents(amount: number) {
  return Math.round(amount * 100);
}

export function normalizeListAmount(amount: unknown): number | undefined {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || value > 5000) return undefined;
  return Math.round(value * 100) / 100;
}

export function listAmountForCatalog(
  catalogId: string | undefined,
  amount: number | null | undefined,
): number | undefined {
  if (hourlyRateForCatalogId(catalogId) != null) return undefined;
  return normalizeListAmount(amount);
}

export function catalogLinePatch(catalog: CatalogChargeItem) {
  return {
    label: catalog.name,
    amount: catalog.suggestedAmount ?? 0,
    catalogId: catalog.id,
    listAmount: listAmountForCatalog(catalog.id, catalog.suggestedAmount),
  };
}

export function listedAmountIfChanged(
  item: Pick<ChargeLineItem, "amount" | "listAmount">,
): number | null {
  const listed = normalizeListAmount(item.listAmount);
  if (listed == null) return null;
  if (roundedCents(listed) === roundedCents(item.amount)) return null;
  return listed;
}

export function formatLineItemMoney(
  item: Pick<ChargeLineItem, "amount" | "listAmount">,
) {
  const listed = listedAmountIfChanged(item);
  if (listed == null) return formatChargeMoney(item.amount);
  return `${formatChargeMoney(listed)} → ${formatChargeMoney(item.amount)}`;
}

export function withCatalogListAmount(
  items: ChargeLineItem[],
  catalog: CatalogChargeItem[],
): ChargeLineItem[] {
  return items.map((item) => {
    if (normalizeListAmount(item.listAmount) != null) return item;
    const suggested = catalog.find(
      (entry) => entry.id === item.catalogId,
    )?.suggestedAmount;
    const listAmount = listAmountForCatalog(
      item.catalogId,
      suggested ?? item.amount,
    );
    return listAmount == null ? item : { ...item, listAmount };
  });
}
