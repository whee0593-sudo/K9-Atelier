import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Service components rely on the Next.js JSX runtime. Expose React for tsx tests.
(globalThis as { React?: typeof React }).React = React;
import { generateMetadata } from "@/app/services/[slug]/page";
import { BathCoatJsonLd } from "@/components/seo/BathCoatJsonLd";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import { BathCoatEditorial } from "@/components/services/BathCoatEditorial";
import { ServiceCard } from "@/components/services/ServiceCard";
import { ServicesSection } from "@/components/services/ServicesSection";
import { business, getBrandSearchName, getCommunitiesServed } from "@/lib/business";
import {
  BATH_COAT_FAQS,
  BATH_COAT_FULL_GROOM_NOTE,
  BATH_COAT_HAND_STRIPPING_NOTE,
  BATH_COAT_IDS,
  BATH_COAT_MORE_BODY,
  BATH_COAT_MORE_HEADING,
  BATH_COAT_PAGE_DESCRIPTION,
  BATH_COAT_PAGE_H1,
  BATH_COAT_PAGE_INTRO,
  BATH_COAT_PAGE_TITLE,
  BATH_COAT_ROUTINE_BODY,
  BATH_COAT_ROUTINE_HEADING,
  getServiceById,
  getServiceCategory,
  getServicesByIds,
  serviceCardPriceValue,
  serviceDurationLabel,
  serviceStartingPriceLabel,
} from "@/lib/service-page";

const SIGNATURE_BATH_TIERS = [
  ["under15", 90, 45, 60],
  ["15to30", 110, 60, 75],
  ["31to45", 130, 75, 90],
] as const;

const LONG_COAT_TIERS = [
  ["under15", 120, 60, 75],
  ["15to30", 140, 75, 90],
  ["31to45", 160, 90, 105],
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function htmlPattern(value: string) {
  return escapeRegExp(value.replace(/&/g, "&amp;"));
}

describe("bath and coat care page metadata", () => {
  it("sets the Palm Beach title, description, and canonical", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "bath-coat-care" }),
    });
    const category = getServiceCategory("bath-coat-care");

    assert.equal(metadata.title, BATH_COAT_PAGE_TITLE);
    assert.equal(
      metadata.title,
      "Bath & Coat Care for Dogs in Palm Beach | K9 Atelier",
    );
    assert.equal(metadata.description, BATH_COAT_PAGE_DESCRIPTION);
    assert.equal(
      metadata.description,
      "Private mobile bath and coat care in Palm Beach with professional bathing, drying and coat maintenance tailored to your dog\u2019s skin, coat and grooming needs.",
    );
    assert.equal(
      metadata.alternates?.canonical,
      "https://k9atelier.com/services/bath-coat-care",
    );
    assert.equal(metadata.openGraph?.title, BATH_COAT_PAGE_TITLE);
    assert.equal(metadata.openGraph?.description, BATH_COAT_PAGE_DESCRIPTION);
    assert.equal(
      metadata.openGraph?.url,
      "https://k9atelier.com/services/bath-coat-care",
    );
    assert.equal(metadata.twitter?.title, BATH_COAT_PAGE_TITLE);
    assert.equal(metadata.twitter?.description, BATH_COAT_PAGE_DESCRIPTION);
    assert.equal(category?.pageEyebrow, "Bath & Coat Care");
    assert.equal(category?.pageH1, BATH_COAT_PAGE_H1);
    assert.equal(category?.pageH1, "Coat Health, Kept Beautiful.");
    assert.equal(category?.pageIntro, BATH_COAT_PAGE_INTRO);
    assert.equal(
      category?.pageIntro,
      "Private mobile grooming in Palm Beach, with professional bath and coat care tailored to your dog\u2019s coat and skin.",
    );
  });
});

describe("bath and coat care page content", () => {
  it("keeps one H1 and renders the editorial sections, FAQs, and crawlable links", () => {
    const services = getServicesByIds(BATH_COAT_IDS);
    assert.equal(services.length, 2);
    const html = renderToStaticMarkup(
      <>
        <ServicesSection
          id="bath-coat-care"
          eyebrow="Bath & Coat Care"
          title={BATH_COAT_PAGE_H1}
          titleAs="h1"
          intro={BATH_COAT_PAGE_INTRO}
          tone="white"
        >
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              headingAs="h2"
              anchorId={service.id}
            />
          ))}
        </ServicesSection>
        <BathCoatEditorial />
      </>,
    );
    const links = anchors(html);

    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.match(html, /Bath &amp; Coat Care/);
    assert.match(html, /Coat Health, Kept Beautiful\./);
    assert.match(
      html,
      /Private mobile grooming in Palm Beach, with professional bath and coat care tailored to your dog\u2019s coat and skin\./,
    );
    assert.match(html, new RegExp(htmlPattern(BATH_COAT_MORE_HEADING)));
    assert.match(html, new RegExp(htmlPattern(BATH_COAT_MORE_BODY)));
    assert.match(html, new RegExp(htmlPattern(BATH_COAT_ROUTINE_HEADING)));
    assert.match(html, new RegExp(htmlPattern(BATH_COAT_ROUTINE_BODY)));
    assert.match(html, new RegExp(htmlPattern(BATH_COAT_FULL_GROOM_NOTE)));
    assert.match(html, new RegExp(htmlPattern(BATH_COAT_HAND_STRIPPING_NOTE)));
    assert.equal(html.includes("prevents skin"), false);
    assert.equal(html.includes("treats skin"), false);
    assert.equal(html.includes("all wire"), false);

    for (const faq of BATH_COAT_FAQS) {
      assert.match(html, new RegExp(htmlPattern(faq.question)));
      assert.match(html, new RegExp(htmlPattern(faq.answer)));
      assert.match(
        html,
        new RegExp(`<details[^>]*open[^>]*>[\\s\\S]*${htmlPattern(faq.question)}`),
      );
    }
    assert.equal((html.match(/<details\b/g) ?? []).length, 3);
    assert.equal(html.includes("FAQPage"), false);

    const fullGroom = links.find((link) => link.href === "/services/full-groom");
    const handStripping = links.find((link) => link.href === "/services/hand-stripping");
    const servicesLink = links.find((link) => link.href === "/services");
    const groomer = links.find((link) => link.href === "/about");
    const booking = links.filter((link) => link.href === "/book");

    assert.ok(fullGroom);
    assert.match(fullGroom.text, /^Full Grooming/);
    assert.match(fullGroom.text, /→/);
    assert.ok(handStripping);
    assert.match(handStripping.text, /^Hand Stripping/);
    assert.match(handStripping.text, /→/);
    assert.ok(servicesLink);
    assert.match(servicesLink.text, /^Explore All Services/);
    assert.match(servicesLink.text, /→/);
    assert.ok(groomer);
    assert.match(groomer.text, /^Meet Your Groomer/);
    assert.match(groomer.text, /→/);
    assert.ok(booking.length >= 1);
    assert.match(booking[0].text, /Book an Appointment/);
    assert.equal(
      links.filter((link) => link.href === "/services/full-groom").length,
      1,
    );
    assert.equal(
      links.filter((link) => link.href === "/services/hand-stripping").length,
      1,
    );
    assert.equal((html.match(/<img\b/g) ?? []).length, 0);
  });

  it("keeps Bath & Coat Care prices and duration sourced from the catalog", () => {
    const signature = getServiceById("signature-bath-care");
    const longCoat = getServiceById("long-coat-show-care");
    assert.ok(signature);
    assert.ok(longCoat);
    assert.equal(serviceStartingPriceLabel(signature), "From $90");
    assert.equal(serviceCardPriceValue(signature), "$90");
    assert.equal(serviceDurationLabel(signature), "45\u201390 min");
    assert.equal(serviceStartingPriceLabel(longCoat), "From $120");
    assert.equal(serviceCardPriceValue(longCoat), "$120");
    assert.equal(serviceDurationLabel(longCoat), "60\u2013105 min");

    for (const [weightTier, price, durationMin, durationMax] of SIGNATURE_BATH_TIERS) {
      const entry = signature.tiers?.find((tier) => tier.weightTier === weightTier);
      assert.equal(entry?.priceFrom, price, `signature ${weightTier}`);
      assert.equal(entry?.durationMin, durationMin);
      assert.equal(entry?.durationMax, durationMax);
    }
    for (const [weightTier, price, durationMin, durationMax] of LONG_COAT_TIERS) {
      const entry = longCoat.tiers?.find((tier) => tier.weightTier === weightTier);
      assert.equal(entry?.priceFrom, price, `long coat ${weightTier}`);
      assert.equal(entry?.durationMin, durationMin);
      assert.equal(entry?.durationMax, durationMax);
    }

    const html = renderToStaticMarkup(
      <>
        <ServiceCard service={signature} headingAs="h2" anchorId="signature-bath" />
        <ServiceCard service={longCoat} headingAs="h2" anchorId="long-coat-show-care" />
      </>,
    );
    assert.match(html, />\$90</);
    assert.match(html, />\$120</);
    assert.match(html, /From \$90/);
    assert.match(html, /From \$130/);
    assert.match(html, /From \$160/);
    assert.match(html, /45\u201360 min/);
    assert.match(html, /90\u2013105 min/);
    assert.match(html, /href="\/book"/);
    assert.match(html, /Book an Appointment/);

    const editorial = readFileSync(
      new URL("./BathCoatEditorial.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(editorial.includes("$"), false);
    const catalog = readFileSync(
      new URL("../../../content/business.json", import.meta.url),
      "utf8",
    );
    assert.equal(catalog.includes('"id": "signature-bath-care"'), true);
    assert.equal(catalog.includes('"priceFrom": 90'), true);
  });
});

describe("bath and coat care structured data", () => {
  it("publishes Service and BreadcrumbList without review or FAQ markup", () => {
    const html = renderToStaticMarkup(
      <>
        <LocalBusinessJsonLd />
        <BathCoatJsonLd />
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
    assert.equal(service.name, "Bath & Coat Care");
    assert.equal(service.url, "https://k9atelier.com/services/bath-coat-care");
    assert.equal(service.description, BATH_COAT_PAGE_DESCRIPTION);
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
        [3, "Bath & Coat Care", "https://k9atelier.com/services/bath-coat-care"],
      ],
    );

    const serialized = JSON.stringify(graphs);
    for (const token of ['"Review"', '"AggregateRating"', '"reviewRating"', '"FAQPage"']) {
      assert.equal(serialized.includes(token), false, token);
    }
    assert.equal(nodes.filter((node) => typesOf(node).includes("Review")).length, 0);
    assert.equal(
      nodes.filter((node) => typesOf(node).includes("AggregateRating")).length,
      0,
    );
  });
});

describe("bath and coat care page composition", () => {
  it("attaches structured data and editorial content only on the bath and coat view", () => {
    const source = readFileSync(
      new URL("./ServiceCategoryView.tsx", import.meta.url),
      "utf8",
    );
    assert.match(
      source,
      /category\.slug === "bath-coat-care" \? <BathCoatJsonLd \/> : null/,
    );
    assert.match(
      source,
      /category\.slug === "bath-coat-care" \? <BathCoatEditorial \/> : null/,
    );
    assert.match(source, /titleAs="h1"/);
    assert.equal(source.includes("showRequestLink={false}"), false);
    assert.match(source, /<MobileBookBar \/>/);

    const otherPages = [
      "full-groom",
      "hand-stripping",
      "spa",
      "color",
      "specialty-care",
      "add-ons",
    ];
    for (const slug of otherPages) {
      assert.equal(source.includes(`slug === "${slug}" ? <BathCoat`), false, slug);
    }
  });
});
