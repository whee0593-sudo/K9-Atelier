import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Service components rely on the Next.js JSX runtime. Expose React for tsx tests.
(globalThis as { React?: typeof React }).React = React;
import { generateMetadata } from "@/app/services/[slug]/page";
import { HandStrippingJsonLd } from "@/components/seo/HandStrippingJsonLd";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import { HandStrippingEditorial } from "@/components/services/HandStrippingEditorial";
import { ServiceCard } from "@/components/services/ServiceCard";
import { ServicesSection } from "@/components/services/ServicesSection";
import { business, getBrandSearchName, getCommunitiesServed } from "@/lib/business";
import {
  HAND_STRIPPING_COMPARE_HEADING,
  HAND_STRIPPING_FAQS,
  HAND_STRIPPING_MAINTENANCE_HEADING,
  HAND_STRIPPING_PAGE_DESCRIPTION,
  HAND_STRIPPING_PAGE_H1,
  HAND_STRIPPING_PAGE_INTRO,
  HAND_STRIPPING_PAGE_TITLE,
  HAND_STRIPPING_SUITABLE_HEADING,
  HAND_STRIPPING_SUITABLE_NOTE,
  HAND_STRIPPING_WHAT_HEADING,
  getServiceById,
  getServiceCategory,
  serviceCardPriceValue,
  serviceDurationLabel,
  serviceStartingPriceLabel,
} from "@/lib/service-page";

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

describe("hand stripping page metadata", () => {
  it("sets the Palm Beach title, description, and canonical", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "hand-stripping" }),
    });
    const category = getServiceCategory("hand-stripping");

    assert.equal(metadata.title, HAND_STRIPPING_PAGE_TITLE);
    assert.equal(
      metadata.title,
      "Hand Stripping Dog Grooming in Palm Beach | K9 Atelier",
    );
    assert.equal(metadata.description, HAND_STRIPPING_PAGE_DESCRIPTION);
    assert.equal(
      metadata.description,
      "Professional hand stripping in Palm Beach for wire-coated dogs, preserving natural coat texture, color and protection through traditional coat care.",
    );
    assert.equal(
      metadata.alternates?.canonical,
      "https://k9atelier.com/services/hand-stripping",
    );
    assert.equal(metadata.openGraph?.url, "https://k9atelier.com/services/hand-stripping");
    assert.equal(metadata.twitter?.title, HAND_STRIPPING_PAGE_TITLE);
    assert.equal(metadata.twitter?.description, HAND_STRIPPING_PAGE_DESCRIPTION);
    assert.equal(category?.pageEyebrow, "Hand Stripping");
    assert.equal(category?.pageH1, HAND_STRIPPING_PAGE_H1);
    assert.equal(category?.pageIntro, HAND_STRIPPING_PAGE_INTRO);
    assert.equal(
      category?.pageIntro,
      "Professional hand stripping in Palm Beach for wire-coated breeds, preserving harsh texture, rich color and the coat\u2019s natural protective qualities.",
    );
  });
});

describe("hand stripping page content", () => {
  it("keeps one H1 and renders the new sections, FAQs, and crawlable links", () => {
    const service = getServiceById("hand-stripping");
    assert.ok(service);
    const html = renderToStaticMarkup(
      <>
        <ServicesSection
          id="hand-stripping"
          eyebrow="Hand Stripping"
          title={HAND_STRIPPING_PAGE_H1}
          titleAs="h1"
          intro={HAND_STRIPPING_PAGE_INTRO}
          tone="white"
        >
          <ServiceCard service={service} headingAs="h2" anchorId="hand-stripping" />
        </ServicesSection>
        <HandStrippingEditorial />
      </>,
    );
    const links = anchors(html);

    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.match(html, /Hand Stripping/);
    assert.match(
      html,
      /Professional hand stripping in Palm Beach for wire-coated breeds, preserving harsh texture, rich color and the coat\u2019s natural protective qualities\./,
    );
    for (const heading of [
      HAND_STRIPPING_WHAT_HEADING,
      HAND_STRIPPING_COMPARE_HEADING,
      HAND_STRIPPING_SUITABLE_HEADING,
      HAND_STRIPPING_MAINTENANCE_HEADING,
    ]) {
      assert.match(html, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.match(html, /Norwich Terriers/);
    assert.match(html, new RegExp(HAND_STRIPPING_SUITABLE_NOTE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(html, /Rather than cutting the coat shorter with clippers/);
    assert.match(html, /Clipping shortens the existing hair/);

    for (const faq of HAND_STRIPPING_FAQS) {
      assert.match(html, new RegExp(faq.question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.match(html, new RegExp(faq.answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.equal((html.match(/<details\b/g) ?? []).length, 3);
    assert.match(html, /<details[^>]*open/);
    assert.equal(html.includes("FAQPage"), false);

    const services = links.find((link) => link.href === "/services");
    const bath = links.find(
      (link) => link.href === "/services/bath-coat-care" && /Bath & Coat Care/.test(link.text),
    );
    const signatureBath = links.find(
      (link) =>
        link.href === "/services/bath-coat-care" && link.text === "Signature Bath & Care",
    );
    const groomer = links.find((link) => link.href === "/about");
    const booking = links.filter((link) => link.href === "/book");

    assert.ok(services);
    assert.match(services.text, /^Explore All Services/);
    assert.match(services.text, /→/);
    assert.ok(bath);
    assert.match(bath.text, /^Bath & Coat Care/);
    assert.match(bath.text, /→/);
    assert.ok(signatureBath);
    assert.match(
      html,
      /please add a <a[^>]*href="\/services\/bath-coat-care"[^>]*>Signature Bath &amp; Care<\/a> service to your booking\./,
    );
    assert.ok(groomer);
    assert.match(groomer.text, /^Meet Your Groomer/);
    assert.match(groomer.text, /→/);
    assert.ok(booking.length >= 1);
    assert.match(booking[0].text, /Book an Appointment/);
  });

  it("keeps the hourly price and duration sourced from the catalog", () => {
    const service = getServiceById("hand-stripping");
    assert.ok(service);
    assert.equal(service.hourlyRate, 160);
    assert.equal(service.pricingType, "hourly");
    assert.equal(serviceStartingPriceLabel(service), "From $160 / hour");
    assert.equal(serviceCardPriceValue(service), "$160 / hour");
    assert.equal(
      service.durationNote,
      "1 – 1.5 hours (varies by coat texture & coverage)",
    );
    assert.equal(serviceDurationLabel(service), service.durationNote);
    assert.equal(
      service.note,
      "If a bath is desired immediately after hand stripping, please add a Signature Bath & Care service to your booking.",
    );
    assert.match(
      service.description,
      /Charged at an hourly rate due to the intense precision and time required\./,
    );

    const html = renderToStaticMarkup(
      <ServiceCard service={service} headingAs="h2" anchorId="hand-stripping" />,
    );
    assert.match(html, /\$160 \/ hour/);
    assert.match(html, /From \$160 \/ hour/);
    assert.match(html, /1 – 1\.5 hours \(varies by coat texture &amp; coverage\)/);
    assert.match(html, /href="\/book"/);

    const editorial = readFileSync(
      new URL("./HandStrippingEditorial.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(editorial.includes("$"), false);
  });
});

describe("hand stripping structured data", () => {
  it("publishes Service and BreadcrumbList without review or FAQ markup", () => {
    const html = renderToStaticMarkup(
      <>
        <LocalBusinessJsonLd />
        <HandStrippingJsonLd />
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
    assert.equal(service.name, "Hand Stripping");
    assert.equal(service.url, "https://k9atelier.com/services/hand-stripping");
    assert.equal(service.description, HAND_STRIPPING_PAGE_DESCRIPTION);
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
        [3, "Hand Stripping", "https://k9atelier.com/services/hand-stripping"],
      ],
    );

    const serialized = JSON.stringify(graphs);
    for (const token of ['"Review"', '"AggregateRating"', '"reviewRating"', '"FAQPage"']) {
      assert.equal(serialized.includes(token), false, token);
    }
  });
});

describe("hand stripping page composition", () => {
  it("attaches structured data and editorial content only on the hand stripping view", () => {
    const source = readFileSync(
      new URL("./ServiceCategoryView.tsx", import.meta.url),
      "utf8",
    );
    assert.match(
      source,
      /category\.slug === "hand-stripping" \? <HandStrippingJsonLd \/> : null/,
    );
    assert.match(
      source,
      /category\.slug === "hand-stripping" \? <HandStrippingEditorial \/> : null/,
    );
    assert.equal(source.includes("showRequestLink={false}"), false);
    assert.match(source, /<MobileBookBar \/>/);
  });
});
