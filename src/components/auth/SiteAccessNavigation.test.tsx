import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { SiteAccessNavigation } from "./SiteAccessNavigation";
import AdminLoginPage from "@/app/login/admin/page";

(globalThis as { React?: typeof React }).React = React;

describe("production site access navigation", () => {
  it("returns to the public homepage without preview controls", () => {
    const html = renderToStaticMarkup(<SiteAccessNavigation privacyMode={false} />);
    assert.match(html, /href="\/"/);
    assert.match(html, /View website/);
    assert.doesNotMatch(html, /Exit preview|under-construction|<button/);
  });

  it("does not advertise preview passwords or construction while the site is public", () => {
    const html = renderToStaticMarkup(<AdminLoginPage />);
    assert.match(html, /href="\/login\?next=\/admin"/);
    assert.match(html, /View website/);
    assert.doesNotMatch(html, /privacy mode|prepare for launch|Access password|under-construction/);
  });

  it("uses the actual maintenance gate for the admin banner and preserves preview exit", () => {
    const banner = readFileSync(new URL("../admin/AdminStaffBanner.tsx", import.meta.url), "utf8");
    assert.match(banner, /isPrivacyGateActive\(business.site\?\.privacyMode === true\)/);
    assert.match(banner, /SiteAccessNavigation privacyMode=\{privacyMode\}/);
    const nav = readFileSync(new URL("./SiteAccessNavigation.tsx", import.meta.url), "utf8");
    assert.match(nav, /privacyMode \? \(\s*<ExitPreviewButton/);
  });
});
