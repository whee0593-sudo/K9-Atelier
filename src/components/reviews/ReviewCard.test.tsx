import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewsShowcase } from "@/components/home/HomeReviews";
import { ReviewCard } from "@/components/reviews/ReviewCard";

describe("review cards", () => {
  it("clamps a long review and offers the full text", () => {
    const html = renderToStaticMarkup(
      <ReviewCard
        item={{
          quote:
            "We have been doing Hand-stripping grooming with Penny for a long time. My rough coat Jack Russell Terrier always comes out nicely. Nails are always well trimmed.",
          name: "Huizi Yuan",
          source: "Google Maps",
          rating: 5,
        }}
      />,
    );

    assert.match(html, /line-clamp-3/);
    assert.match(html, /Show full review/);
    assert.match(html, /Huizi Yuan/);
    assert.equal(html.includes("Show less"), false);
  });

  it("leaves a short review open without a toggle", () => {
    const html = renderToStaticMarkup(
      <ReviewCard
        item={{
          quote: "Penny is definitely the best!!",
          name: "Giancarlo Amyach",
          rating: 5,
        }}
      />,
    );

    assert.match(html, /line-clamp-3/);
    assert.equal(html.includes("Show full review"), false);
  });

  it("shows one review per row on small screens and four on large screens", async () => {
    const html = renderToStaticMarkup(await ReviewsShowcase());

    assert.match(html, /grid-cols-1/);
    assert.match(html, /lg:grid-cols-4/);
    assert.equal(html.includes("grid-cols-2"), false);
    assert.equal(html.includes("md:grid-cols-3"), false);
    assert.match(html, /Mark Keinard/);
    assert.match(html, /Giancarlo Amyach/);
    assert.match(html, /Huizi Yuan/);
    assert.match(html, /scheduling with Penny again/);
  });
});
