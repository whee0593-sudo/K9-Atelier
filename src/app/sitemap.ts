import type { MetadataRoute } from "next";
import { LONG_COAT_CARE_PATH } from "@/lib/long-coat-care-page";
import {
  SERVICE_CATEGORY_PATHS,
  SERVICES_PATH,
  absoluteSiteUrl,
} from "@/lib/service-page";

const PUBLIC_PATHS = [
  "/",
  SERVICES_PATH,
  ...SERVICE_CATEGORY_PATHS,
  LONG_COAT_CARE_PATH,
  "/gallery",
  "/reviews",
  "/about",
  "/faq",
  "/contact",
  "/service-area",
  "/shop",
  "/referrals",
  "/privacy",
  "/terms",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  // These pages are static and have no stored page-specific modification date.
  // Omit lastModified so the sitemap does not stamp every URL with generation time.
  return PUBLIC_PATHS.map((path) => ({
    url: absoluteSiteUrl(path),
    changeFrequency: path.startsWith(SERVICES_PATH) ? "weekly" : "monthly",
    priority:
      path === "/"
        ? 1
        : path === SERVICES_PATH
          ? 0.9
          : SERVICE_CATEGORY_PATHS.includes(path) || path === LONG_COAT_CARE_PATH
            ? 0.8
            : 0.6,
  }));
}
