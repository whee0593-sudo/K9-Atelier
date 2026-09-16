import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const servicesPage = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("services directory page", () => {
  it("keeps the page to hero, directory, consultation, and notes", () => {
    assert.match(servicesPage, /<ServicesHero \/>/);
    assert.match(servicesPage, /<ServiceDirectory \/>/);
    assert.match(servicesPage, /<ConsultationPrompt \/>/);
    assert.match(servicesPage, /<ServiceNotes \/>/);
    assert.equal(servicesPage.includes("Most Requested"), false);
    assert.equal(servicesPage.includes("ServiceCard"), false);
    assert.equal(servicesPage.includes("FeesPoliciesSection"), false);
    assert.equal(servicesPage.includes("FullGroomSection"), false);
    assert.equal(servicesPage.includes("ServicesNav"), false);
    assert.equal(servicesPage.includes("MobileBookBar"), false);
  });
});
