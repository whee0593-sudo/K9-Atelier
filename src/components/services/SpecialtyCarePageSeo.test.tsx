import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { React?: typeof React }).React = React;
import { generateMetadata } from "@/app/services/[slug]/page";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import { SpecialtyCareJsonLd } from "@/components/seo/SpecialtyCareJsonLd";
import { ServiceCard } from "@/components/services/ServiceCard";
import { ServicesSection } from "@/components/services/ServicesSection";
import { business, getBrandSearchName } from "@/lib/business";
import { getServiceDisplayName } from "@/lib/service-display";
import {
  SERVICES_DIRECTORY_DESCRIPTIONS,
  SPECIALTY_CARE_AREA_SENTENCE,
  SPECIALTY_CARE_AREA_SERVED,
  SPECIALTY_CARE_EOL_SUMMARY,
  SPECIALTY_CARE_PAGE_DESCRIPTION,
  SPECIALTY_CARE_PAGE_H1,
  SPECIALTY_CARE_PAGE_INTRO,
  SPECIALTY_CARE_PAGE_TITLE,
  SPECIALTY_CARE_PATH,
  SPECIALTY_CARE_PENNY_AFTER,
  SPECIALTY_CARE_PENNY_BEFORE,
  SPECIALTY_CARE_PENNY_NAME,
  SPECIALTY_CARE_SENIOR_BEST_FOR,
  SPECIALTY_CARE_SENIOR_DETAIL,
  SPECIALTY_CARE_SENIOR_INDIVIDUAL,
  SPECIALTY_CARE_SENIOR_NAME,
  SPECIALTY_CARE_SENIOR_SUMMARY,
  SPECIALTY_CARE_SERVICE_ID,
  SPECIALTY_CARE_SERVICE_TYPE,
  getServiceById,
  getServiceCategory,
  specialtyCareDisplayService,
} from "@/lib/service-page";

type JsonLdNode = Record<string, unknown>;

const FORBIDDEN = [
  "medically fragile",
  "paralysis",
  "paralyzed",
  "post-surgical",
  "serious illness",
  "medical needs",
  "hospice",
  "recovering from surgery",
  "cannot tolerate a standard grooming routine",
  "physical and emotional needs",
  "treatment",
];

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

describe("specialty care page metadata", () => {
  it("sets the senior grooming title, description, canonical, and social tags", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "specialty-care" }),
    });
    const category = getServiceCategory("specialty-care");

    assert.equal(metadata.title, SPECIALTY_CARE_PAGE_TITLE);
    assert.equal(
      metadata.title,
      "Extra-Gentle Senior Dog Grooming in Palm Beach | K9 Atelier",
    );
    assert.equal(metadata.description, SPECIALTY_CARE_PAGE_DESCRIPTION);
    assert.equal(
      metadata.description,
      "Private mobile senior dog grooming with patient one-on-one care, a slower pace and extra breaks for older dogs who need a gentler appointment.",
    );
    assert.equal(metadata.alternates?.canonical, "https://k9atelier.com/services/specialty-care");
    assert.equal(metadata.openGraph?.title, SPECIALTY_CARE_PAGE_TITLE);
    assert.equal(metadata.openGraph?.description, SPECIALTY_CARE_PAGE_DESCRIPTION);
    assert.equal(metadata.openGraph?.url, "https://k9atelier.com/services/specialty-care");
    assert.equal(metadata.twitter?.title, SPECIALTY_CARE_PAGE_TITLE);
    assert.equal(metadata.twitter?.description, SPECIALTY_CARE_PAGE_DESCRIPTION);
    assert.equal(String(metadata.title).includes("End-of-Life"), false);
    assert.equal(String(metadata.description).includes("End-of-Life"), false);
    assert.equal(category?.pageEyebrow, "Specialty Care");
    assert.equal(category?.pageH1, SPECIALTY_CARE_PAGE_H1);
    assert.equal(category?.pageIntro, SPECIALTY_CARE_PAGE_INTRO);
    assert.equal(category?.navLabel, "Specialty Care");
    assert.equal(category?.directoryName, "Specialty Care");
    assert.equal(category?.directoryDescription, "Senior · Comfort care");
    assert.equal(
      SERVICES_DIRECTORY_DESCRIPTIONS["specialty-care"],
      "Senior · Extra-gentle comfort care",
    );
    assert.equal(category?.path, SPECIALTY_CARE_PATH);
  });
});

describe("specialty care page content", () => {
  it("positions extra-gentle senior care ahead of member end-of-life care", () => {
    const category = getServiceCategory("specialty-care");
    assert.ok(category);
    const senior = getServiceById(SPECIALTY_CARE_SERVICE_ID);
    const endOfLife = getServiceById("end-of-life-care");
    assert.ok(senior);
    assert.ok(endOfLife);
    const html = renderToStaticMarkup(
      <>
        <SpecialtyCareJsonLd />
        <ServicesSection
          id="specialty-care"
          eyebrow={category.pageEyebrow}
          title={category.pageH1}
          titleAs="h1"
          titleClassName="text-balance text-pretty"
          intro={category.pageIntro}
          tone="white"
        >
          <div>
            <ServiceCard
              service={specialtyCareDisplayService(senior)}
              headingAs="h2"
              anchorId="senior-comfort-care"
              detailsInitiallyOpen
              detailParagraphs={[
                SPECIALTY_CARE_SENIOR_DETAIL,
                SPECIALTY_CARE_SENIOR_INDIVIDUAL,
              ]}
              leadLink={{
                before: SPECIALTY_CARE_PENNY_BEFORE,
                label: SPECIALTY_CARE_PENNY_NAME,
                after: SPECIALTY_CARE_PENNY_AFTER,
                href: "/about",
              }}
            />
            <ServiceCard
              service={specialtyCareDisplayService(endOfLife)}
              headingAs="h2"
              quiet
              anchorId="end-of-life-care"
            />
          </div>
          <p>{SPECIALTY_CARE_AREA_SENTENCE}</p>
        </ServicesSection>
      </>,
    );
    const headings = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((match) =>
      match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    );

    assert.deepEqual(headings, [SPECIALTY_CARE_PAGE_H1]);
    assert.match(html, /Specialty Care/);
    assert.equal(html.includes(SPECIALTY_CARE_PAGE_INTRO), true);
    assert.equal(html.includes(SPECIALTY_CARE_SENIOR_SUMMARY), true);
    assert.equal(html.includes(SPECIALTY_CARE_SENIOR_BEST_FOR), true);
    assert.equal(html.includes(SPECIALTY_CARE_SENIOR_DETAIL), true);
    assert.equal(html.includes(SPECIALTY_CARE_SENIOR_INDIVIDUAL), true);
    assert.equal(html.includes(SPECIALTY_CARE_EOL_SUMMARY), true);
    assert.equal(html.includes(SPECIALTY_CARE_AREA_SENTENCE), true);
    assert.equal((html.match(/Serving Jupiter Island/g) ?? []).length, 1);

    const visible = html.replace(/<script[\s\S]*?<\/script>/g, "");
    const hero = visible.slice(0, visible.indexOf(SPECIALTY_CARE_SENIOR_SUMMARY));
    assert.equal(hero.includes("Jupiter Island"), false);
    assert.equal(hero.includes("End-of-Life"), false);

    assert.match(
      html,
      new RegExp(
        `${SPECIALTY_CARE_PENNY_BEFORE}<a[^>]*href="/about"[^>]*>${SPECIALTY_CARE_PENNY_NAME}</a>${SPECIALTY_CARE_PENNY_AFTER.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      ),
    );

    const lowered = html.toLowerCase();
    for (const phrase of FORBIDDEN) {
      assert.equal(lowered.includes(phrase), false, phrase);
    }

    assert.match(html, /href="\/book"/);
    assert.match(html, /href="\/login"/);
    assert.match(html, /Members only/);
    assert.match(html, /Complimentary/);
    assert.match(html, /From \$30/);
    assert.match(html, /From \$40/);
    assert.match(html, /From \$50/);
    assert.match(html, /added to the base service/);
    assert.equal(html.includes("Senior &amp; Gentle Comfort Care"), false);
    assert.equal(html.includes("Senior & Gentle Comfort Care"), false);
  });

  it("keeps the catalog id, Gentle Care booking name, and add-on prices", () => {
    const service = getServiceById(SPECIALTY_CARE_SERVICE_ID);
    assert.ok(service);
    assert.equal(service.id, "senior-comfort-care");
    assert.equal(service.name, "Senior & Gentle Comfort Care");
    assert.equal(service.bookableAsPrimary, false);
    assert.equal(service.pricingType, "add_on");
    assert.deepEqual(
      service.tiers?.map((tier) => [tier.weightTier, tier.priceFrom]),
      [
        ["under15", 30],
        ["15to30", 40],
        ["31to45", 50],
      ],
    );
    assert.equal(getServiceDisplayName(service.id, service.name), "Gentle Care");

    const endOfLife = getServiceById("end-of-life-care");
    assert.ok(endOfLife);
    assert.equal(endOfLife.membersOnly, true);
    assert.equal(endOfLife.pricingType, "free");
    assert.equal(endOfLife.name, "End-of-Life Comfort Care");
    assert.match(business.weightPolicy.over45AllowedServiceIds.join(","), /end-of-life-care/);
  });
});

describe("specialty care structured data", () => {
  it("publishes one senior Service and a breadcrumb, without offers or end-of-life", () => {
    const html = renderToStaticMarkup(
      <>
        <LocalBusinessJsonLd />
        <SpecialtyCareJsonLd />
      </>,
    );
    const graphs = parseScripts(html);
    assert.equal(graphs.length, 2);
    const nodes = graphs.flatMap((graph) => collectNodes(graph));

    const services = nodes.filter((node) => typesOf(node).includes("Service"));
    assert.equal(services.length, 1);
    const service = services[0];
    assert.equal(service["@id"], "https://k9atelier.com/services/specialty-care#service");
    assert.equal(service.name, "Extra-Gentle Senior Care");
    assert.equal(service.serviceType, SPECIALTY_CARE_SERVICE_TYPE);
    assert.equal(service.serviceType, "Mobile Senior Dog Grooming");
    assert.equal(service.url, "https://k9atelier.com/services/specialty-care");
    assert.equal(service.description, SPECIALTY_CARE_PAGE_DESCRIPTION);
    assert.equal(service.offers, undefined);
    const provider = service.provider as JsonLdNode;
    assert.equal(provider["@id"], "https://k9atelier.com/#business");
    assert.equal(provider.name, getBrandSearchName());

    const areas = service.areaServed as JsonLdNode[];
    assert.deepEqual(
      areas.map((area) => area.name),
      [...SPECIALTY_CARE_AREA_SERVED],
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
        [3, "Extra-Gentle Senior Care", "https://k9atelier.com/services/specialty-care"],
      ],
    );

    const serialized = JSON.stringify(graphs);
    const view = readFileSync(
      new URL("./ServiceCategoryView.tsx", import.meta.url),
      "utf8",
    );
    assert.match(view, /category\.slug === "specialty-care" \? <SpecialtyCareJsonLd \/> : null/);
    assert.match(view, /SPECIALTY_CARE_AREA_SENTENCE/);
    assert.match(view, /specialtyCareDisplayService\(service\)/);

    assert.equal(serialized.includes("End-of-Life"), false);
    assert.equal(serialized.includes('"offers"'), false);
    for (const token of ['"Review"', '"AggregateRating"', '"reviewRating"', '"FAQPage"']) {
      assert.equal(serialized.includes(token), false, token);
    }
  });
});
