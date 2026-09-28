import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ADD_ONS_PATH,
  BATH_COAT_PATH,
  COLOR_PATH,
  FULL_GROOM_PATH,
  HAND_STRIPPING_PATH,
  SERVICE_CATEGORY_PATHS,
  SERVICES_PATH,
  SPA_PATH,
  SPECIALTY_CARE_PATH,
  absoluteSiteUrl,
} from "../lib/service-page";
import sitemap from "./sitemap";

/** Public indexable pages that sitemap.xml must keep advertising. */
const INTENDED_URLS = [
  "https://k9atelier.com/",
  "https://k9atelier.com/services",
  "https://k9atelier.com/services/bath-coat-care",
  "https://k9atelier.com/services/full-groom",
  "https://k9atelier.com/services/hand-stripping",
  "https://k9atelier.com/services/spa",
  "https://k9atelier.com/services/color",
  "https://k9atelier.com/services/specialty-care",
  "https://k9atelier.com/services/add-ons",
  "https://k9atelier.com/gallery",
  "https://k9atelier.com/reviews",
  "https://k9atelier.com/about",
  "https://k9atelier.com/faq",
  "https://k9atelier.com/contact",
  "https://k9atelier.com/service-area",
  "https://k9atelier.com/shop",
  "https://k9atelier.com/referrals",
  "https://k9atelier.com/privacy",
  "https://k9atelier.com/terms",
] as const;

describe("sitemap", () => {
  it("returns the existing public indexable URLs on https://k9atelier.com", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    assert.equal(entries.length, INTENDED_URLS.length);
    assert.deepEqual(urls, [...INTENDED_URLS]);

    for (const url of urls) {
      assert.equal(new URL(url).protocol, "https:");
      assert.equal(new URL(url).hostname, "k9atelier.com");
    }

    assert.ok(urls.includes(absoluteSiteUrl(SERVICES_PATH)));
    assert.ok(urls.includes(absoluteSiteUrl(FULL_GROOM_PATH)));
    assert.ok(urls.includes(absoluteSiteUrl(HAND_STRIPPING_PATH)));
    assert.ok(urls.includes(absoluteSiteUrl(BATH_COAT_PATH)));
    assert.ok(urls.includes(absoluteSiteUrl(SPA_PATH)));
    assert.ok(urls.includes(absoluteSiteUrl(COLOR_PATH)));
    assert.ok(urls.includes(absoluteSiteUrl(SPECIALTY_CARE_PATH)));
    assert.ok(urls.includes(absoluteSiteUrl(ADD_ONS_PATH)));
    assert.equal(
      SERVICE_CATEGORY_PATHS.every((path) =>
        urls.includes(absoluteSiteUrl(path)),
      ),
      true,
    );
    assert.equal(
      absoluteSiteUrl(HAND_STRIPPING_PATH),
      "https://k9atelier.com/services/hand-stripping",
    );
  });

  it("omits lastModified when a page has no stored modification date", () => {
    const before = Date.now();
    const entries = sitemap();
    const after = Date.now();

    for (const entry of entries) {
      if (entry.lastModified != null) {
        const timestamp = new Date(entry.lastModified).getTime();
        const stampedAtGeneration = timestamp >= before && timestamp <= after;
        assert.equal(
          stampedAtGeneration,
          false,
          `${entry.url} must not use the sitemap generation time as lastModified`,
        );
      }

      assert.equal(
        entry.lastModified,
        undefined,
        `${entry.url} has no page-specific modification date`,
      );
    }
  });
});
