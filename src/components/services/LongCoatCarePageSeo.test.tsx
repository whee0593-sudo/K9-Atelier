import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;
import { metadata } from "@/app/services/long-coat-care/page";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import { LongCoatCareJsonLd } from "@/components/seo/LongCoatCareJsonLd";
import { LongCoatCareView } from "@/components/services/LongCoatCareView";
import { ServiceCard } from "@/components/services/ServiceCard";
import { business, getBrandSearchName, getCommunitiesServed } from "@/lib/business";
import {
  LONG_COAT_CARE_AREA_SENTENCE,
  LONG_COAT_CARE_AREA_SERVED,
  LONG_COAT_CARE_CANONICAL,
  LONG_COAT_CARE_DISTINCTION,
  LONG_COAT_CARE_GROOMER_AFTER,
  LONG_COAT_CARE_GROOMER_BEFORE,
  LONG_COAT_CARE_GROOMER_NAME,
  LONG_COAT_CARE_MALTESE_BODY,
  LONG_COAT_CARE_MALTESE_HEADING,
  LONG_COAT_CARE_PAGE_DESCRIPTION,
  LONG_COAT_CARE_PAGE_H1,
  LONG_COAT_CARE_PAGE_INTRO,
  LONG_COAT_CARE_PAGE_TITLE,
  LONG_COAT_CARE_PATH,
  LONG_COAT_CARE_SERVICE_NAME,
  LONG_COAT_CARE_SERVICE_TYPE,
  LONG_COAT_CARE_YORKIE_BODY,
  LONG_COAT_CARE_YORKIE_HEADING,
} from "@/lib/long-coat-care-page";
import { getServiceById } from "@/lib/service-page";

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

function parseScripts(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (match) => JSON.parse(match[1]) as JsonLdNode,
  );
}

function anchors(html: string) {
  return [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(
    (match) => ({
      href: match[1],
      text: match[2]
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .trim(),
    }),
  );
}

describe("long-coat care page metadata", () => {
  it("sets the Palm Beach title, description, canonical, and social tags", () => {
    assert.equal(metadata.title, LONG_COAT_CARE_PAGE_TITLE);
    assert.equal(
      metadata.title,
      "Show-Level Long-Coat Care in Palm Beach | K9 Atelier",
    );
    assert.equal(metadata.description, LONG_COAT_CARE_PAGE_DESCRIPTION);
    assert.equal(
      metadata.description,
      "Private mobile long-coat grooming for Maltese, Yorkshire Terriers and other full-coated small breeds, focused on preserving length, coat health and silky condition.",
    );
    assert.equal(metadata.alternates?.canonical, LONG_COAT_CARE_CANONICAL);
    assert.equal(
      metadata.alternates?.canonical,
      "https://k9atelier.com/services/long-coat-care",
    );
    assert.equal(metadata.openGraph?.title, LONG_COAT_CARE_PAGE_TITLE);
    assert.equal(metadata.openGraph?.description, LONG_COAT_CARE_PAGE_DESCRIPTION);
    assert.equal(metadata.openGraph?.url, LONG_COAT_CARE_CANONICAL);
    assert.equal(metadata.twitter?.title, LONG_COAT_CARE_PAGE_TITLE);
    assert.equal(metadata.twitter?.description, LONG_COAT_CARE_PAGE_DESCRIPTION);
  });
});

describe("long-coat care page content", () => {
  it("keeps one H1, the breed sections, Penny, and crawlable links", () => {
    const html = renderToStaticMarkup(<LongCoatCareView />);
    const headings = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((match) =>
      match[1].replace(/<[^>]+>/g, "").trim(),
    );
    assert.deepEqual(headings, [LONG_COAT_CARE_PAGE_H1]);
    assert.match(html, /Show-Level Long-Coat Care/);
    assert.match(html, new RegExp(LONG_COAT_CARE_PAGE_INTRO.replace(/[().]/g, "\\$&")));
    assert.match(html, /Maintaining a Full Coat/);
    assert.match(html, /Unlike a full haircut, long-coat care is designed to maintain and protect length rather than shorten the overall coat\./);
    assert.equal(html.includes(LONG_COAT_CARE_DISTINCTION), true);
    assert.equal(html.includes(LONG_COAT_CARE_MALTESE_HEADING), true);
    for (const paragraph of LONG_COAT_CARE_MALTESE_BODY) {
      assert.equal(html.includes(paragraph), true, paragraph);
    }
    assert.equal(html.includes(LONG_COAT_CARE_YORKIE_HEADING), true);
    assert.match(html, /Yorkshire Terrier \(Yorkie\)/);
    assert.match(html, /Yorkie long-coat care is private/);
    for (const paragraph of LONG_COAT_CARE_YORKIE_BODY) {
      assert.equal(html.includes(paragraph), true, paragraph);
    }
    assert.match(
      html,
      new RegExp(
        `${LONG_COAT_CARE_GROOMER_BEFORE}<a[^>]*href="/about"[^>]*>${LONG_COAT_CARE_GROOMER_NAME}</a>${LONG_COAT_CARE_GROOMER_AFTER}`,
      ),
    );
    assert.match(html, /Serving/);
    for (const city of LONG_COAT_CARE_AREA_SERVED) {
      assert.equal(html.includes(city), true, city);
    }
    assert.match(html, /Palm Beach and West Palm Beach\./);
    const hero = html.slice(0, html.indexOf("Maintaining a Full Coat"));
    assert.equal(hero.includes("Jupiter Island"), false);
    assert.equal((html.match(/<img\b/g) ?? []).length, 0);
    assert.equal(html.includes("Puppy cut"), false);
    assert.equal(html.includes("Princess look"), false);
    assert.equal(html.includes("the best"), false);

    const links = anchors(html);
    assert.ok(links.some((link) => link.href === "/services/full-groom" && /Full Grooming/.test(link.text)));
    assert.ok(links.some((link) => link.href === "/services" && /Explore All Services/.test(link.text)));
    assert.ok(links.some((link) => link.href === "/about" && link.text === "Penny"));
    assert.ok(links.some((link) => link.href === "/about" && /Meet Your Groomer/.test(link.text)));
    assert.ok(links.some((link) => link.href === "/book" && /Book an Appointment/.test(link.text)));
    assert.equal(
      links.some((link) => link.href === LONG_COAT_CARE_PATH),
      false,
    );
  });

  it("reuses Show Care for Long Coats prices from the catalog", () => {
    const service = getServiceById("long-coat-show-care");
    assert.ok(service);
    assert.equal(service.name, "Show Care for Long Coats");
    assert.deepEqual(
      service.tiers?.map((tier) => [tier.weightTier, tier.priceFrom]),
      [
        ["under15", 120],
        ["15to30", 140],
        ["31to45", 160],
      ],
    );

    const html = renderToStaticMarkup(<LongCoatCareView />);
    assert.match(html, /Show Care for Long Coats/);
    assert.match(html, /From \$120/);
    assert.match(html, /From \$140/);
    assert.match(html, /From \$160/);
    assert.match(html, /Pre-Bath Detangling/);
    assert.match(html, /Sanitary trim and paw-pad hair shaved/);
    assert.match(html, /href="\/book"/);

    const view = readFileSync(
      new URL("./LongCoatCareView.tsx", import.meta.url),
      "utf8",
    );
    const schema = readFileSync(
      new URL("../seo/LongCoatCareJsonLd.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(view.includes("120"), false);
    assert.equal(view.includes("140"), false);
    assert.equal(view.includes("160"), false);
    assert.equal(schema.includes('"offers"'), false);
    assert.equal(schema.includes("price"), false);
  });
});

describe("show care card link", () => {
  it("adds a crawlable long-coat care link without removing booking", () => {
    const service = getServiceById("long-coat-show-care");
    assert.ok(service);
    const html = renderToStaticMarkup(
      <ServiceCard
        service={service}
        headingAs="h2"
        anchorId="long-coat-show-care"
        learnMoreHref={LONG_COAT_CARE_PATH}
        learnMoreLabel="Learn About Long-Coat Care"
      />,
    );
    const links = anchors(html);
    const learn = links.find((link) => link.href === LONG_COAT_CARE_PATH);
    assert.ok(learn);
    assert.match(learn.text, /Learn About Long-Coat Care/);
    assert.ok(links.some((link) => link.href === "/book" && /Book an Appointment/.test(link.text)));

    const source = readFileSync(
      new URL("./ServiceCategoryView.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /long-coat-show-care/);
    assert.match(source, /Learn About Long-Coat Care/);
    assert.match(source, /LONG_COAT_CARE_PATH/);
  });
});

describe("long-coat care structured data", () => {
  it("publishes its own Service and BreadcrumbList without prices", () => {
    const html = renderToStaticMarkup(
      <>
        <LocalBusinessJsonLd />
        <LongCoatCareJsonLd />
      </>,
    );
    const graphs = parseScripts(html);
    assert.equal(graphs.length, 2);
    const nodes = graphs.flatMap((graph) => collectNodes(graph));

    const businesses = nodes.filter((node) => typesOf(node).includes("LocalBusiness"));
    assert.equal(businesses.length, 1);
    assert.equal(businesses[0]["@id"], "https://k9atelier.com/#business");
    assert.equal(businesses[0].name, getBrandSearchName());
    assert.equal(businesses[0].name, "K9 Atelier Mobile Pet Spa");
    assert.equal(businesses[0].url, business.brand.website);

    const services = nodes.filter((node) => typesOf(node).includes("Service"));
    assert.equal(services.length, 1);
    const service = services[0];
    assert.equal(service["@id"], "https://k9atelier.com/services/long-coat-care#service");
    assert.equal(service.name, LONG_COAT_CARE_SERVICE_NAME);
    assert.equal(service.name, "Show-Level Long-Coat Care");
    assert.equal(service.serviceType, LONG_COAT_CARE_SERVICE_TYPE);
    assert.equal(service.serviceType, "Mobile Long-Coat Dog Grooming");
    assert.equal(service.url, "https://k9atelier.com/services/long-coat-care");
    assert.equal(service.description, LONG_COAT_CARE_PAGE_DESCRIPTION);
    assert.equal(service.offers, undefined);
    const provider = service.provider as JsonLdNode;
    assert.equal(provider["@id"], "https://k9atelier.com/#business");
    assert.equal(provider.name, "K9 Atelier Mobile Pet Spa");
    assert.equal(provider["@type"], undefined);

    const businessAreas = businesses[0].areaServed as JsonLdNode[];
    assert.deepEqual(
      businessAreas.map((area) => area.name),
      getCommunitiesServed(),
    );
    const areas = service.areaServed as JsonLdNode[];
    assert.deepEqual(
      areas.map((area) => area.name),
      [...LONG_COAT_CARE_AREA_SERVED],
    );
    for (const area of areas) {
      assert.equal(area["@type"], "City");
      const state = area.containedInPlace as JsonLdNode;
      assert.equal(state["@type"], "State");
      assert.equal(state.name, "Florida");
    }

    const breadcrumbs = nodes.filter((node) => typesOf(node).includes("BreadcrumbList"));
    assert.equal(breadcrumbs.length, 1);
    const items = breadcrumbs[0].itemListElement as JsonLdNode[];
    assert.deepEqual(
      items.map((item) => [item.position, item.name, item.item]),
      [
        [1, "Home", "https://k9atelier.com/"],
        [2, "Services", "https://k9atelier.com/services"],
        [3, "Show-Level Long-Coat Care", "https://k9atelier.com/services/long-coat-care"],
      ],
    );

    const serialized = JSON.stringify(graphs);
    for (const token of ['"Review"', '"AggregateRating"', '"reviewRating"', '"FAQPage"', '"offers"']) {
      assert.equal(serialized.includes(token), false, token);
    }
  });
});
