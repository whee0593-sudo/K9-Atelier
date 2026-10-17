import { business } from "@/lib/business";

export function siteUrl(path: string) {
  const base = business.brand.website?.replace(/\/$/, "") ?? "https://k9atelier.com";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
