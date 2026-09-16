import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BATH_COAT_PATH,
  COLOR_PATH,
  FULL_GROOM_PATH,
  SERVICE_CATEGORY_PATHS,
  SERVICES_PATH,
  SPA_PATH,
  SPECIALTY_CARE_PATH,
  ADD_ONS_PATH,
  absoluteSiteUrl,
} from "../lib/service-page";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("includes the Services directory and every category route", () => {
    const urls = sitemap().map((entry) => entry.url);
    assert.ok(urls.includes(absoluteSiteUrl(SERVICES_PATH)));
    assert.ok(urls.includes(absoluteSiteUrl(FULL_GROOM_PATH)));
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
      absoluteSiteUrl(FULL_GROOM_PATH),
      "https://k9atelier.com/services/full-groom",
    );
  });
});
