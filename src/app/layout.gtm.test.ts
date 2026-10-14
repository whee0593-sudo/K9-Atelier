import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const googleAds = readFileSync(
  new URL("../lib/google-ads.ts", import.meta.url),
  "utf8",
);

const GTM_ID = "GTM-MKRPGPRZ";

describe("Google Tag Manager layout install", () => {
  it("installs the container with the Next.js GoogleTagManager component", () => {
    assert.match(
      layout,
      /import \{ GoogleTagManager \} from "@next\/third-parties\/google"/,
    );
    assert.match(layout, /const GTM_CONTAINER_ID = "GTM-MKRPGPRZ"/);
    const bodyStart = layout.indexOf("<body");
    const tagManager = layout.indexOf("<GoogleTagManager");
    assert.ok(tagManager > bodyStart);
    assert.match(layout, /<GoogleTagManager gtmId=\{GTM_CONTAINER_ID\} \/>/);
    assert.doesNotMatch(layout, /sendGTMEvent/);
    assert.doesNotMatch(layout, /GoogleAnalytics/);
  });

  it("places the official noscript iframe first inside body", () => {
    const bodyStart = layout.indexOf("<body");
    const noscriptStart = layout.indexOf("<noscript>");
    const tagManager = layout.indexOf("<GoogleTagManager");
    const existingAdsScript = layout.indexOf("google-ads-gtag");
    assert.ok(bodyStart >= 0);
    assert.ok(noscriptStart > bodyStart);
    assert.ok(tagManager > noscriptStart);
    assert.ok(existingAdsScript > tagManager);
    assert.match(
      layout,
      /src=\{`https:\/\/www\.googletagmanager\.com\/ns\.html\?id=\$\{GTM_CONTAINER_ID\}`\}/,
    );
    assert.match(layout, /display:\s*"none"/);
    assert.match(layout, /visibility:\s*"hidden"/);
    assert.match(layout, /height="0"/);
    assert.match(layout, /width="0"/);
    assert.equal(GTM_ID, "GTM-MKRPGPRZ");
  });

  it("does not add a second Google Ads tag or a new conversion event", () => {
    assert.match(
      layout,
      /src=\{`https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=\$\{GOOGLE_ADS_ID\}`\}/,
    );
    assert.match(layout, /gtag\('config', '\$\{GOOGLE_ADS_ID\}'\)/);
    assert.doesNotMatch(layout, /gtag\('event'/);
    assert.doesNotMatch(layout, /G-[A-Z0-9]{6,}/);
    assert.match(googleAds, /export const GOOGLE_ADS_ID = "AW-18402037044"/);
    assert.match(
      googleAds,
      /export const GOOGLE_ADS_BOOK_CONVERSION_LABEL = "x65RCOrWw-UcELSa48ZE"/,
    );
    assert.match(googleAds, /window\.gtag\("event", "conversion"/);
  });
});
