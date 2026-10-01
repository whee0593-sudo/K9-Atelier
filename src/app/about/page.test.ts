import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { metadata } from "@/app/about/page";
import { AboutStory } from "@/components/about/AboutStory";
import { AboutJsonLd } from "@/components/seo/AboutJsonLd";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import {
  ABOUT_PAGE_CANONICAL,
  ABOUT_PAGE_DESCRIPTION,
  ABOUT_PAGE_TITLE,
} from "@/lib/about-page";
import { getBrandSearchName } from "@/lib/business";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const story = readFileSync(
  new URL("../../components/about/AboutStory.tsx", import.meta.url),
  "utf8",
);

const BUSINESS_ID = "https://k9atelier.com/#business";
const PERSON_ID = "https://k9atelier.com/about#penny";

type JsonLdNode = Record<string, unknown>;

function typesOf(node: JsonLdNode) {
  const value = node["@type"];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string");
  return [];
}

function parseJsonLd(html: string) {
  const match = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, "expected a JSON-LD script tag");
  return JSON.parse(match[1]) as JsonLdNode;
}

describe("about page", () => {
  it("renders the editorial story", () => {
    assert.match(page, /<AboutStory \/>/);
    assert.match(page, /ABOUT_PAGE_TITLE/);
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
      "about-approach-portrait.jpg",
    ]) {
      assert.equal(story.includes(`/images/about/${file}`), true, file);
    }
  });

  it("keeps the portrait eager and defers the show-ring photographs", () => {
    const html = renderToStaticMarkup(React.createElement(AboutStory));
    assert.match(html, /about-professional-portrait\.jpg/);
    assert.match(html, /fetchpriority="high"/i);
    assert.equal(html.includes('loading="lazy"'), true);

    const portrait = html.indexOf("about-professional-portrait.jpg");
    const deferred = html.indexOf("content-visibility:hidden");
    assert.ok(portrait > -1);
    assert.ok(deferred > portrait);

    for (const file of [
      "about-competition-grooming.jpg",
      "about-2019-trophy.jpg",
      "about-2019-award.jpg",
      "about-competition-group.jpg",
      "about-awards-credentials.jpg",
    ]) {
      assert.equal(html.includes(file), true, file);
    }
    assert.match(html, /min\(365px, calc\(100vw - 2rem\)\)/);
  });

  it("keeps factual alt text for the photographs on the page", () => {
    for (const alt of [
      "Penny in a black suit beside a white dog, a formal studio portrait",
      "Groomers and their dogs gathered on a professional grooming competition floor",
      "Penny grooming during a professional grooming competition",
      "Penny receiving an award at a professional grooming competition",
      "Penny with a white Bichon, a trophy, and award rosettes after Best in Show in 2019",
      "Professional grooming awards, rosettes and certificates",
      "Penny demonstrating grooming technique during hands-on instruction",
      "A groomer finishing a detailed facial trim on a brown poodle",
      "A cream curly-coated dog sitting in a finished groom",
    ]) {
      assert.equal(story.includes(alt), true, alt);
    }
  });
});

describe("about page metadata", () => {
  it("sets the Penny title, description, and canonical", () => {
    assert.equal(metadata.title, ABOUT_PAGE_TITLE);
    assert.equal(
      metadata.title,
      "About Penny | Award-Winning Dog Groomer | K9 Atelier",
    );
    assert.equal(metadata.description, ABOUT_PAGE_DESCRIPTION);
    assert.equal(
      metadata.description,
      "Meet Penny, founder of K9 Atelier and a professional groomer since 2010, with experience in competition grooming, award-winning work and hands-on instruction.",
    );
    assert.equal(metadata.alternates?.canonical, ABOUT_PAGE_CANONICAL);
    assert.equal(metadata.alternates?.canonical, "https://k9atelier.com/about");
  });
});

describe("about page content", () => {
  it("keeps one H1, the award history, and a crawlable services link", () => {
    const html = renderToStaticMarkup(React.createElement(AboutStory));
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.match(html, /A thoughtful approach to the art of grooming\./);

    const awards = [
      ["2014", "Best in Group", "Pomeranian"],
      ["2017", "Best in Group", "Poodle"],
      ["2019", "Best in Show", "Bichon"],
    ] as const;
    for (const [year, title, breed] of awards) {
      assert.match(story, new RegExp(`year: "${year}"`));
      assert.match(story, new RegExp(`title: "${title}"`));
      assert.match(story, new RegExp(`breed: "${breed}"`));
      assert.match(html, new RegExp(year));
      assert.match(html, new RegExp(title));
      assert.match(html, new RegExp(breed));
    }

    const links = [
      ...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g),
    ].map((match) => ({
      href: match[1],
      text: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    }));
    const services = links.filter((link) => link.href === "/services");
    assert.equal(services.length, 1);
    assert.match(services[0].text, /Explore Grooming Services/);
    assert.match(services[0].text, /→/);
  });
});

describe("about structured data", () => {
  it("publishes Penny, a Home to About breadcrumb, and no review markup", () => {
    const html = renderToStaticMarkup(React.createElement(AboutJsonLd));
    const data = parseJsonLd(html);
    const graph = data["@graph"] as JsonLdNode[];
    const serialized = JSON.stringify(data);

    const person = graph.find((node) => typesOf(node).includes("Person"));
    const breadcrumb = graph.find((node) =>
      typesOf(node).includes("BreadcrumbList"),
    );
    const businessReference = graph.find((node) => node["@id"] === BUSINESS_ID);

    assert.ok(person);
    assert.equal(person["@id"], PERSON_ID);
    assert.equal(person.name, "Penny");
    assert.equal(person.url, "https://k9atelier.com/about");
    assert.equal(person.jobTitle, "Professional Groomer");
    assert.deepEqual(person.worksFor, { "@id": BUSINESS_ID });
    assert.ok(Array.isArray(person.sameAs));
    assert.ok((person.sameAs as string[]).includes("https://instagram.com/k9atelierfl"));
    assert.ok(
      (person.sameAs as string[]).includes(
        "https://www.facebook.com/share/1GyGZkHdNE/?mibextid=wwXIfr",
      ),
    );
    assert.ok(
      (person.sameAs as string[]).includes("https://share.google/GpMiMzxgC8NxDjAsI"),
    );

    assert.ok(businessReference);
    assert.equal(businessReference["@type"], undefined);
    assert.deepEqual(businessReference.founder, { "@id": PERSON_ID });
    assert.equal(businessReference.name, undefined);
    assert.equal(businessReference.telephone, undefined);
    assert.equal(businessReference.address, undefined);
    assert.equal(businessReference.areaServed, undefined);

    assert.ok(breadcrumb);
    const items = breadcrumb.itemListElement as JsonLdNode[];
    assert.deepEqual(
      items.map((item) => [item.position, item.name, item.item]),
      [
        [1, "Home", "https://k9atelier.com/"],
        [2, "About", "https://k9atelier.com/about"],
      ],
    );

    assert.equal(serialized.includes('"Review"'), false);
    assert.equal(serialized.includes('"AggregateRating"'), false);
    assert.equal(serialized.includes('"reviewRating"'), false);
    assert.equal(serialized.includes('"FAQPage"'), false);
    assert.equal(typesOf(person).includes("Person"), true);
    assert.equal(
      graph.filter((node) => typesOf(node).includes("LocalBusiness")).length,
      0,
    );
  });

  it("keeps the shared LocalBusiness entity that Penny works for", () => {
    const data = parseJsonLd(
      renderToStaticMarkup(React.createElement(LocalBusinessJsonLd)),
    );
    const graph = data["@graph"] as JsonLdNode[];
    const entity = graph.find((node) => typesOf(node).includes("LocalBusiness"));
    assert.ok(entity);
    assert.equal(entity["@id"], BUSINESS_ID);
    assert.equal(entity.name, getBrandSearchName());
    assert.equal(entity.name, "K9 Atelier Mobile Pet Spa");
    assert.equal(entity.url, "https://k9atelier.com");
    assert.equal(entity.telephone, "+1-561-593-3335");
    assert.equal(entity.review, undefined);
    assert.equal(entity.aggregateRating, undefined);
  });
});
