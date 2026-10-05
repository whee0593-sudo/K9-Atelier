import type { MetadataRoute } from "next";

const SITE_ORIGIN = "https://k9atelier.com";

/** Account, sign-in, staff, and API areas are not public site pages. */
const PRIVATE_PATHS = [
  "/account",
  "/login",
  "/admin",
  "/api",
  "/auth",
  "/confirm-account",
  "/preview",
];

export default function robots(): MetadataRoute.Robots {
  const publicSite = {
    allow: "/",
    disallow: PRIVATE_PATHS,
  };

  return {
    rules: [
      { userAgent: "*", ...publicSite },
      { userAgent: "Googlebot", ...publicSite },
      { userAgent: "OAI-SearchBot", ...publicSite },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
