import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Service components rely on the Next.js JSX runtime. Expose React for tsx tests.
(globalThis as { React?: typeof React }).React = React;
import { generateMetadata } from "@/app/services/[slug]/page";
import { FullGroomJsonLd } from "@/components/seo/FullGroomJsonLd";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import { FullGroomEditorial } from "@/components/services/FullGroomEditorial";
import { ServiceCard } from "@/components/services/ServiceCard";
import { ServicesSection } from "@/components/services/ServicesSection";
import { business, getBrandSearchName, getCommunitiesServed } from "@/lib/business";
import {
  FULL_GROOM_FAQS,
  FULL_GROOM_PAGE_DESCRIPTION,
  FULL_GROOM_PAGE_H1,
  FULL_GROOM_PAGE_INTRO,
  FULL_GROOM_PAGE_TITLE,
  FULL_GROOM_STYLING_HEADING,
  getServiceById,
  getServiceCategory,
  serviceCardPriceValue,
  serviceDurationLabel,
  serviceStartingPriceLabel,
} from "@/lib/service-page";

const FULL_GROOM_MATRIX = [
  ["under15", "short-light", 140],
  ["under15", "medium-standard", 155],
  ["under15", "long-full", 170],
  ["15to30", "short-light", 160],
  ["15to30", "medium-standard", 175],
  ["15to30", "long-full", 190],
  ["31to45", "short-light", 180],
  ["31to45", "medium-standard", 195],
  ["31to45", "long-full", 210],
] as const;

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

describe("full groom page metadata", () => {
  it("sets the Palm Beach title, description, and canonical", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "full-groom" }),
    });
    const category = getServiceCategory("full-groom");

    assert.equal(metadata.title, FULL_GROOM_PAGE_TITLE);
    assert.equal(metadata.title, "Full Dog Grooming in Palm Beach | K9 Atelier");
    assert.equal(metadata.description, FULL_GROOM_PAGE_DESCRIPTION);
    assert.equal(
      metadata.description,
      "Private mobile full grooming in Palm Beach with custom haircuts and styling tailored to your dog\u2019s coat, lifestyle and individual expression.",
    );
    assert.equal(
      metadata.alternates?.canonical,
      "https://k9atelier.com/services/full-groom",
    );
    assert.equal(metadata.openGraph?.title, FULL_GROOM_PAGE_TITLE);
    assert.equal(metadata.openGraph?.description, FULL_GROOM_PAGE_DESCRIPTION);
    assert.equal(metadata.openGraph?.url, "https://k9atelier.com/services/full-groom");
    assert.equal(metadata.twitter?.title, FULL_GROOM_PAGE_TITLE);
    assert.equal(metadata.twitter?.description, FULL_GROOM_PAGE_DESCRIPTION);
    assert.equal(category?.pageH1, FULL_GROOM_PAGE_H1);
    assert.equal(category?.pageEyebrow, "Full Grooming");
    assert.equal(category?.pageIntro, FULL_GROOM_PAGE_INTRO);
    assert.equal(
      category?.pageIntro,
      "Private mobile full grooming in Palm Beach, with custom haircuts and styling for coats that need more than a bath.",
    );
  });
});

describe("full groom page content", () => {
  it("keeps one H1 and renders the included, styling, and visible FAQ sections", () => {
    const service = getServiceById("custom-full-haircut");
    assert.ok(service);
    const html = renderToStaticMarkup(
      <>
        <ServicesSection
          id="full-groom"
          eyebrow="Full Grooming"
          title={FULL_GROOM_PAGE_H1}
          titleAs="h1"
          intro={FULL_GROOM_PAGE_INTRO}
          tone="white"
        >
          <ServiceCard
            service={service}
            headingAs="h2"
            anchorId="atelier-full-groom"
          />
        </ServicesSection>
        <FullGroomEditorial />
      </>,
    );
    const links = anchors(html);

    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.match(html, /Full Grooming/);
    assert.match(html, /A Complete Style, Done With Patience\./);
    assert.match(
      html,
      /Private mobile full grooming in Palm Beach, with custom haircuts and styling for coats that need more than a bath\./,
    );
    assert.match(html, /What\u2019s Included in a Full Groom/);
    assert.match(html, /complete bath and coat care/);
    assert.match(html, /teddy-bear inspired finishes/);
    assert.match(html, new RegExp(FULL_GROOM_STYLING_HEADING));
    assert.match(html, /one-style-fits-all approach/);

    for (const faq of FULL_GROOM_FAQS) {
      assert.match(html, new RegExp(faq.question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(html, new RegExp(faq.answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(html, new RegExp(`<details[^>]*open[^>]*>[\\s\\S]*${faq.question}`));
    }
    assert.equal((html.match(/<details\b/g) ?? []).length, 3);
    assert.equal(html.includes("FAQPage"), false);

    const bath = links.find((link) => link.href === "/services/bath-coat-care");
    const groomer = links.find((link) => link.href === "/about");
    const services = links.find((link) => link.href === "/services");
    assert.ok(bath);
    assert.match(bath.text, /^Bath & Coat Care/);
    assert.match(bath.text, /→/);
    assert.ok(groomer);
    assert.match(groomer.text, /^Meet Your Groomer/);
    assert.match(groomer.text, /→/);
    assert.ok(services);
    assert.match(services.text, /^Explore All Services/);
    assert.match(services.text, /→/);
    assert.equal((html.match(/<img\b/g) ?? []).length, 0);
  });

  it("keeps Full Groom prices and duration sourced from the catalog", () => {
    const service = getServiceById("custom-full-haircut");
    assert.ok(service);
    assert.equal(serviceStartingPriceLabel(service), "From $140");
    assert.equal(serviceCardPriceValue(service), "$140");
    assert.equal(serviceDurationLabel(service), "75\u2013120 min");
    assert.equal(
      service.pricingNote,
      "Starting prices are based on weight and coat type. Final pricing may vary based on coat density, condition, requested style, temperament, and additional grooming time required.",
    );

    for (const [weightTier, coatType, price] of FULL_GROOM_MATRIX) {
      const entry = service.coatTypePrices?.find(
        (item) => item.weightTier === weightTier && item.coatType === coatType,
      );
      assert.equal(entry?.priceFrom, price, `${weightTier} ${coatType}`);
    }

    const html = renderToStaticMarkup(
      <ServiceCard service={service} headingAs="h2" anchorId="atelier-full-groom" />,
    );
    assert.match(html, />\$140</);
    assert.match(html, /75\u2013120 min/);
    assert.match(html, /From \$140/);
    assert.match(html, /From \$210/);
    assert.match(html, /Final pricing may vary based on coat density/);
    assert.match(html, /href="\/book"/);
    assert.match(html, /Book an Appointment/);

    const editorial = readFileSync(
      new URL("./FullGroomEditorial.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(editorial.includes("$"), false);
    assert.equal(readFileSync(new URL("../../../content/business.json", import.meta.url), "utf8").includes('"priceFrom": 140'), true);
  });
});

describe("full groom structured data", () => {
  it("publishes Service and BreadcrumbList without review markup", () => {
    const html = renderToStaticMarkup(
      <>
        <LocalBusinessJsonLd />
        <FullGroomJsonLd />
      </>,
    );
    const graphs = parseScripts(html);
    assert.equal(graphs.length, 2);
    const nodes = graphs.flatMap((graph) => collectNodes(graph));

    const businesses = nodes.filter((node) => typesOf(node).includes("LocalBusiness"));
    assert.equal(businesses.length, 1);
    assert.equal(businesses[0].name, getBrandSearchName());
    assert.equal(businesses[0].name, "K9 Atelier Mobile Pet Spa");
    assert.equal(businesses[0].url, business.brand.website);
    assert.equal(businesses[0].telephone, "+1-561-593-3335");
    assert.equal(businesses[0]["@id"], "https://k9atelier.com/#business");

    const services = nodes.filter((node) => typesOf(node).includes("Service"));
    assert.equal(services.length, 1);
    const service = services[0];
    assert.equal(service.name, "Full Grooming");
    assert.equal(service.url, "https://k9atelier.com/services/full-groom");
    assert.equal(service.description, FULL_GROOM_PAGE_DESCRIPTION);
    const provider = service.provider as JsonLdNode;
    assert.equal(provider["@id"], businesses[0]["@id"]);
    assert.equal(provider.name, "K9 Atelier Mobile Pet Spa");
    assert.equal(provider["@type"], undefined);

    const areas = service.areaServed as JsonLdNode[];
    assert.deepEqual(
      areas.map((area) => area.name),
      getCommunitiesServed(),
    );
    assert.deepEqual(areas.map((area) => area.name), [
      "Palm Beach",
      "Jupiter",
      "Palm Beach Gardens",
      "West Palm Beach",
    ]);
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
        [3, "Full Grooming", "https://k9atelier.com/services/full-groom"],
      ],
    );

    const serialized = JSON.stringify(graphs);
    assert.equal(serialized.includes('"Review"'), false);
    assert.equal(serialized.includes('"AggregateRating"'), false);
    assert.equal(serialized.includes('"reviewRating"'), false);
    assert.equal(serialized.includes('"FAQPage"'), false);
    assert.equal(nodes.filter((node) => typesOf(node).includes("Review")).length, 0);
    assert.equal(
      nodes.filter((node) => typesOf(node).includes("AggregateRating")).length,
      0,
    );
  });
});

describe("full groom page composition", () => {
  it("attaches structured data and editorial content only on the full groom view", () => {
    const source = readFileSync(
      new URL("./ServiceCategoryView.tsx", import.meta.url),
      "utf8",
    );
    assert.match(source, /category\.slug === "full-groom" \? <FullGroomJsonLd \/> : null/);
    assert.match(source, /category\.slug === "full-groom" \? <FullGroomEditorial \/> : null/);
    assert.match(source, /titleAs="h1"/);
    assert.match(source, /<ServicesSection/);
    assert.equal(source.includes("showRequestLink={false}"), false);
    assert.match(source, /<MobileBookBar \/>/);
  });
});
