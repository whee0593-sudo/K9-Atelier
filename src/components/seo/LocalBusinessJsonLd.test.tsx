import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import { getBrandSearchName } from "@/lib/business";
import { reviews } from "@/lib/reviews";

/**
 * Parent types Google accepts for nested Review and AggregateRating.
 * https://developers.google.com/search/docs/appearance/structured-data/review-snippet
 * (valid types for itemReviewed / the parent of a nested review).
 */
const GOOGLE_REVIEW_PARENT_TYPES = new Set([
  "Book",
  "Course",
  "CreativeWorkSeason",
  "CreativeWorkSeries",
  "Episode",
  "Event",
  "Game",
  "HowTo",
  "LocalBusiness",
  "MediaObject",
  "Movie",
  "MusicPlaylist",
  "MusicRecording",
  "Organization",
  "Product",
  "Recipe",
  "SoftwareApplication",
]);

type JsonLdNode = Record<string, unknown>;

function typesOf(node: JsonLdNode) {
  const value = node["@type"];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  return [];
}

function collectReviewSnippetNodes(data: unknown) {
  const found: Array<{ node: JsonLdNode; parent: JsonLdNode | null }> = [];

  function walk(value: unknown, parent: JsonLdNode | null) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, parent);
      return;
    }
    const node = value as JsonLdNode;
    const types = typesOf(node);
    if (types.includes("Review") || types.includes("AggregateRating")) {
      found.push({ node, parent });
    }
    for (const child of Object.values(node)) walk(child, node);
  }

  walk(data, null);
  return found;
}

function parseJsonLd() {
  const html = renderToStaticMarkup(<LocalBusinessJsonLd />);
  const match = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, "expected a JSON-LD script tag");
  return JSON.parse(match[1]) as JsonLdNode;
}

describe("LocalBusiness review structured data", () => {
  it("nests every Review and AggregateRating under a Google-supported parent", () => {
    const data = parseJsonLd();
    const items = collectReviewSnippetNodes(data);
    const reviewsInMarkup = items.filter(({ node }) => typesOf(node).includes("Review"));
    const ratingsInMarkup = items.filter(({ node }) =>
      typesOf(node).includes("AggregateRating"),
    );

    assert.equal(reviewsInMarkup.length, reviews.items.length);
    assert.equal(ratingsInMarkup.length, 1);
    assert.equal(items.length, reviews.items.length + 1);

    for (const { node, parent } of items) {
      assert.ok(parent, `${typesOf(node).join("/")} is missing a parent entity`);
      const parentTypes = typesOf(parent);
      assert.ok(
        parentTypes.some((type) => GOOGLE_REVIEW_PARENT_TYPES.has(type)),
        `${typesOf(node).join("/")} parent ${parentTypes.join(", ") || "(none)"} is not a Google reviewable type`,
      );
      assert.equal(parentTypes.includes("PetGroomer"), false);
      assert.equal(parentTypes.includes("Service"), false);
      assert.equal(typeof parent.name, "string");
      assert.equal(parent.name, getBrandSearchName());
      assert.equal(node.itemReviewed, undefined);
    }
  });

  it("keeps the published review text and required Review snippet fields", () => {
    const data = parseJsonLd();
    const items = collectReviewSnippetNodes(data);
    const reviewNodes = items
      .filter(({ node }) => typesOf(node).includes("Review"))
      .map(({ node }) => node);

    assert.deepEqual(
      reviewNodes.map((node) => node.reviewBody),
      reviews.items.map((item) => item.quote),
    );

    for (const node of reviewNodes) {
      const author = node.author as JsonLdNode;
      assert.ok(author);
      assert.ok(typesOf(author).includes("Person") || typesOf(author).includes("Organization"));
      assert.equal(typeof author.name, "string");
      assert.ok((author.name as string).length > 0);
      assert.ok((author.name as string).length < 100);

      const rating = node.reviewRating as JsonLdNode;
      assert.equal(rating["@type"], "Rating");
      assert.equal(typeof rating.ratingValue, "number");
      assert.ok((rating.ratingValue as number) >= 1);
      assert.ok((rating.ratingValue as number) <= 5);
    }

    const aggregate = items.find(({ node }) => typesOf(node).includes("AggregateRating"))?.node;
    assert.ok(aggregate);
    assert.equal(typeof aggregate.ratingValue, "number");
    assert.equal(aggregate.reviewCount, reviews.items.length);
    assert.equal(aggregate.bestRating, 5);
    assert.equal(aggregate.worstRating, 1);
  });
});
