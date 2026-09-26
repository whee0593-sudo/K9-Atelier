import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const story = readFileSync(
  new URL("../../components/about/AboutStory.tsx", import.meta.url),
  "utf8",
);

describe("about page", () => {
  it("renders the editorial story", () => {
    assert.match(page, /<AboutStory \/>/);
    assert.match(page, /About · K9 Atelier/);
  });

  it("follows Penny’s career from the ring to the atelier", () => {
    for (const line of [
      "About Penny",
      "A thoughtful approach to the art of grooming.",
      "Multiple Award-Winning Show Groomer",
      "Professional Groomer Since 2010",
      "From the Show Ring",
      "Where precision became instinct.",
      "2019 · Best in Show · Bichon",
      "A life shaped by the grooming table.",
      "Award-Winning Experience",
      "Years of craft. Moments of recognition.",
      "Best in Group",
      "Pomeranian",
      "Poodle",
      "Best in Show",
      "Bichon",
      "Sharing the Craft",
      "Experience worth sharing.",
      "The Craft",
      "The details make the difference.",
      "The K9 Atelier Approach",
      "Experience, made personal.",
      "Grooming, elevated.",
    ]) {
      assert.equal(story.includes(line), true, line);
    }
  });

  it("uses the about photographs with descriptive filenames", () => {
    for (const file of [
      "about-professional-portrait.jpg",
      "about-competition-group.jpg",
      "about-competition-grooming.jpg",
      "about-2019-trophy.jpg",
      "about-2019-award.jpg",
      "about-awards-credentials.jpg",
      "about-teaching.jpg",
      "about-craft-detail.jpg",
    ]) {
      assert.equal(story.includes(`/images/about/${file}`), true, file);
    }
  });
});
