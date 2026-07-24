import businessData from "../../content/business.json";

export type Business = typeof businessData;

export const business: Business = businessData;

export function formatPrice(amount: number) {
  return `$${amount}`;
}

export function formatDuration(min: number, max?: number) {
  if (max && max !== min) return `${min}–${max} min`;
  return `${min} min`;
}
