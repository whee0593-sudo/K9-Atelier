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
  it("sends the hero secondary button to the contact page", () => {
    const source = readFileSync(new URL("./HomeHero.tsx", import.meta.url), "utf8");

    assert.match(source, /Ask a Question/);
    assert.match(source, /href="\/contact"/);
    assert.match(source, /heroCtaClass/);
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
