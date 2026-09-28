import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import { getBrandSearchName } from "@/lib/business";

type JsonLdNode = Record<string, unknown>;

function typesOf(node: JsonLdNode) {
  const value = node["@type"];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  return [];
}

function collectNodes(data: unknown) {
  const found: JsonLdNode[] = [];

  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    const node = value as JsonLdNode;
    if (typesOf(node).length > 0) found.push(node);
    for (const child of Object.values(node)) walk(child);
  }

  walk(data);
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

describe("LocalBusiness structured data", () => {
  it("keeps LocalBusiness details and omits Review and AggregateRating", () => {
    const data = parseJsonLd();
    const nodes = collectNodes(data);
    const businesses = nodes.filter((node) => typesOf(node).includes("LocalBusiness"));

    assert.equal(businesses.length, 1);
    const business = businesses[0];
    assert.equal(business.name, getBrandSearchName());
    assert.equal(business.name, "K9 Atelier Mobile Pet Spa");
    assert.equal(business.url, "https://k9atelier.com");
    assert.equal(business.telephone, "+1-561-593-3335");
    assert.equal(business.review, undefined);
    assert.equal(business.aggregateRating, undefined);

    const reviews = nodes.filter((node) => typesOf(node).includes("Review"));
    const ratings = nodes.filter((node) => typesOf(node).includes("AggregateRating"));
    assert.equal(reviews.length, 0);
    assert.equal(ratings.length, 0);

    const serialized = JSON.stringify(data);
    assert.equal(serialized.includes('"Review"'), false);
    assert.equal(serialized.includes('"AggregateRating"'), false);
    assert.equal(serialized.includes('"reviewRating"'), false);
  });
});

describe("LocalBusiness entity fields", () => {
  it("publishes name, url, telephone, hours, and Florida cities served", () => {
    const data = parseJsonLd();
    const graph = data["@graph"] as JsonLdNode[];
    const entity = graph.find((node) => typesOf(node).includes("LocalBusiness"));
    assert.ok(entity);

    assert.equal(entity.name, getBrandSearchName());
    assert.equal(entity.name, "K9 Atelier Mobile Pet Spa");
    assert.equal(entity.url, "https://k9atelier.com");
    assert.equal(entity.telephone, "+1-561-593-3335");

    const hours = entity.openingHoursSpecification as JsonLdNode[];
    assert.equal(hours.length, 1);
    assert.equal(hours[0]["@type"], "OpeningHoursSpecification");
    assert.deepEqual(hours[0].dayOfWeek, [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ]);
    assert.equal(hours[0].opens, "09:00");
    assert.equal(hours[0].closes, "16:00");

    const areas = entity.areaServed as JsonLdNode[];
    assert.deepEqual(
      areas.map((area) => area.name),
      ["Palm Beach", "Jupiter", "Palm Beach Gardens", "West Palm Beach"],
    );
    for (const area of areas) {
      assert.equal(area["@type"], "City");
      const state = area.containedInPlace as JsonLdNode;
      assert.equal(state["@type"], "State");
      assert.equal(state.name, "Florida");
    }
  });
});
