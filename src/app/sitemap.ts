import type { MetadataRoute } from "next";
import {
  SERVICE_CATEGORY_PATHS,
  SERVICES_PATH,
  absoluteSiteUrl,
} from "@/lib/service-page";

const PUBLIC_PATHS = [
  "/",
  SERVICES_PATH,
  ...SERVICE_CATEGORY_PATHS,
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
  return PUBLIC_PATHS.map((path) => ({
    url: absoluteSiteUrl(path),
    lastModified: new Date(),
    changeFrequency: path.startsWith(SERVICES_PATH) ? "weekly" : "monthly",
    priority:
      path === "/"
        ? 1
        : path === SERVICES_PATH
          ? 0.9
          : SERVICE_CATEGORY_PATHS.includes(path)
            ? 0.8
            : 0.6,
  }));
}
