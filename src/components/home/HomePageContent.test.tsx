import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const REMOVED_HOME_SECTIONS = [
  "HomeAboutTeaser",
  "HomeArtistry",
  "HomeBookingCta",
  "HomeExperience",
  "HomeExpertise",
  "HomeFaqTeaser",
  "HomeGentleCare",
  "HomeReviews",
  "HomeSignatureServices",
  "HomeSpaWellness",
] as const;

describe("home page content", () => {
  it("uses the shortened show-groomer hero lead", () => {
    const business = JSON.parse(
      readFileSync(new URL("../../../content/business.json", import.meta.url), "utf8"),
    ) as { brand: { lead: string } };

    assert.equal(
      business.brand.lead,
      "Multiple award-winning show groomer specializing in tailored styling, show-level coat care, extra-gentle senior care, and hand stripping.",
    );
    assert.equal(
      business.brand.lead.includes("Private mobile pet spa in Palm Beach County"),
      false,
    );
  });

  it("sends the hero secondary button to the contact page", () => {
    const source = readFileSync(new URL("./HomeHero.tsx", import.meta.url), "utf8");

    assert.match(source, /Ask a Question/);
    assert.match(source, /href="\/contact"/);
    assert.match(source, /heroCtaClass/);
    assert.match(source, /business\.brand\.lead/);
    assert.equal(
      source.includes("Award-winning grooming, brought directly"),
      false,
    );
    assert.equal(source.includes("variant=\"secondary\""), false);
    assert.equal(source.includes("Discover the Experience"), false);
    assert.equal(source.includes("/#first-visit"), false);
  });

  it("keeps only the hero and first-visit sections", () => {
    const source = readFileSync(
      new URL("./HomePageContent.tsx", import.meta.url),
      "utf8",
    );

    assert.match(source, /<HomeHero \/>/);
    assert.match(source, /<HomeFirstVisit \/>/);

    for (const section of REMOVED_HOME_SECTIONS) {
      assert.equal(
        source.includes(section),
        false,
        `homepage still references ${section}`,
      );
    }
  });
});
