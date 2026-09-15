import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FULL_GROOM_PATH, SERVICES_PATH, absoluteSiteUrl } from "../lib/service-page";
import sitemap from "./sitemap";

describe("sitemap", () => {
  it("includes the Full Groom category route and the Services hub", () => {
    const urls = sitemap().map((entry) => entry.url);
    assert.ok(urls.includes(absoluteSiteUrl(FULL_GROOM_PATH)));
    assert.ok(urls.includes(absoluteSiteUrl(SERVICES_PATH)));
    assert.equal(absoluteSiteUrl(FULL_GROOM_PATH), "https://k9atelier.com/services/full-groom");
  });
});
