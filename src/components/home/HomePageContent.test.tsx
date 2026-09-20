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
    assert.match(source, /business\.brand\.lead/);
    assert.equal(
      source.includes("Award-winning grooming, brought directly"),
      false,
    );
    assert.equal(source.includes("variant=\"secondary\""), false);
    assert.equal(source.includes("Discover the Experience"), false);
    assert.equal(source.includes("/#first-visit"), false);
  });

  it("puts brand copy and CTAs above the mobile hero image", () => {
    const source = readFileSync(new URL("./HomeHero.tsx", import.meta.url), "utf8");

    const eyebrow = source.indexOf("business.brand.lockup");
    const tagline = source.indexOf("business.brand.tagline");
    const lead = source.indexOf("business.brand.lead");
    const bookCta = source.indexOf("Book an Appointment");
    const askCta = source.indexOf("Ask a Question");
    const photo = source.indexOf("<EditorialPhoto");
    const mobileMeta = source.indexOf("<HeroServiceMeta className=\"md:hidden\"");
    const desktopMeta = source.indexOf("hidden md:block");

    assert.ok(eyebrow > 0 && eyebrow < tagline);
    assert.ok(tagline < lead);
    assert.ok(lead < bookCta);
    assert.ok(bookCta < askCta);
    assert.ok(askCta < photo);
    assert.ok(photo < mobileMeta);
    assert.ok(desktopMeta > 0);
    assert.match(source, /imageClassName="max-h-\[46vh\] md:max-h-\[80vh\]"/);
    assert.match(source, /md:grid-cols-2/);
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
