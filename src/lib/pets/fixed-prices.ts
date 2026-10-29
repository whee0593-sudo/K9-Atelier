import { allBookableServices } from "@/lib/services";
import { canonicalServiceId } from "@/lib/service-catalog";

export type PetServicePriceRow = { service_id: string; amount: number | string | null };
export type FixedServicePrices = Record<string, number>;
export function fixedPriceServices() {
  return allBookableServices().filter(service => service.bookableAsPrimary && service.pricingType !== "hourly" && service.pricingType !== "free" && service.id !== "creative-accent-coloring");
}
export function validFixedAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 5000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}
export function fixedPriceForService(prices: FixedServicePrices | undefined, serviceId: string): number | null {
  const id = canonicalServiceId(serviceId);
  const amount = prices && Object.prototype.hasOwnProperty.call(prices, id) ? prices[id] : undefined;
  return validFixedAmount(amount) && fixedPriceServices().some(service => service.id === id) ? amount : null;
}
export function mapFixedServicePrices(rows?: PetServicePriceRow[] | null): FixedServicePrices {
  const result: FixedServicePrices = {};
  for (const row of rows ?? []) {
    if (row.amount == null) continue;
    const amount = Number(row.amount);
    const id = canonicalServiceId(row.service_id);
    if (validFixedAmount(amount) && fixedPriceServices().some(service => service.id === id)) result[id] = amount;
  }
  return result;
}
export function parseFixedServicePrice(input: unknown): { serviceId: string; amount: number | null } | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  if (typeof row.serviceId !== "string") return null;
  const id = canonicalServiceId(row.serviceId);
  if (!fixedPriceServices().some(service => service.id === id)) return null;
  return row.amount === null || validFixedAmount(row.amount) ? { serviceId: id, amount: row.amount as number | null } : null;
}
