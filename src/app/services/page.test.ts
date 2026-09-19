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

describe("service directory layout", () => {
  const directory = readFileSync(
    new URL("../../components/services/ServiceDirectory.tsx", import.meta.url),
    "utf8",
  );

  it("centers leftover cards instead of leaving a 2-column orphan", () => {
    assert.match(directory, /lg:grid-cols-3/);
    assert.match(directory, /lg:last:col-start-2/);
    assert.match(directory, /md:last:justify-self-center/);
    assert.match(directory, /servicesCategoryTitleClass/);
    assert.match(directory, /servicesBodyClass/);
    assert.match(directory, /servicesPriceClass/);
    assert.equal(directory.includes("uppercase"), false);
    assert.equal(directory.includes("Haircuts · Hand stripping"), false);
  });
});

describe("services landing typography", () => {
  const typeScale = readFileSync(
    new URL("../../components/services/services-type.ts", import.meta.url),
    "utf8",
  );

  it("keeps brand fonts, readable body size, and ink/taupe contrast", () => {
    assert.match(typeScale, /font-display/);
    assert.match(typeScale, /font-body/);
    assert.match(typeScale, /text-base/);
    assert.match(typeScale, /md:text-\[17px\]/);
    assert.match(typeScale, /text-ink/);
    assert.match(typeScale, /text-taupe/);
    assert.equal(typeScale.includes("text-sm"), false);
  });
});
