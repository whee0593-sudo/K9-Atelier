import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const servicesPage = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("services directory page", () => {
  it("keeps the page to hero, directory, introduction, consultation, and notes", () => {
    const hero = servicesPage.indexOf("<ServicesHero />");
    const directory = servicesPage.indexOf("<ServiceDirectory />");
    const introduction = servicesPage.indexOf("<ServicesIntroduction />");
    const consultation = servicesPage.indexOf("<ConsultationPrompt />");
    const notes = servicesPage.indexOf("<ServiceNotes />");

    assert.ok(hero >= 0 && directory > hero);
    assert.ok(introduction > directory && consultation > introduction);
    assert.ok(notes > consultation);
    assert.match(servicesPage, /ServicesJsonLd/);
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
    assert.match(directory, /font-display/);
    assert.match(directory, /md:text-3xl/);
    assert.match(directory, /mt-auto/);
    assert.equal(directory.includes("font-display text-3xl text-ink uppercase"), false);
    assert.equal(directory.includes("Haircuts · Hand stripping"), false);
  });
});
