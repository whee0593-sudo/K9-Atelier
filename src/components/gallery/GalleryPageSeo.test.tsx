import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Page components use the Next.js JSX runtime. Expose React for tsx tests.
(globalThis as { React?: typeof React }).React = React;
import GalleryPage, { metadata } from "@/app/gallery/page";
import { GalleryWall } from "@/components/gallery/GalleryWall";
import { GalleryJsonLd } from "@/components/seo/GalleryJsonLd";
import { LocalBusinessJsonLd } from "@/components/seo/LocalBusinessJsonLd";
import {
  GALLERY_CONTEXT_BODY,
  GALLERY_CONTEXT_HEADING,
  GALLERY_PAGE_CANONICAL,
  GALLERY_PAGE_DESCRIPTION,
  GALLERY_PAGE_H1,
  GALLERY_PAGE_INTRO,
  GALLERY_PAGE_TITLE,
  GALLERY_SERVICE_LINKS,
} from "@/lib/gallery-page";
import {
  GALLERY_FRAME_SLOTS,
  SELECTED_WORK_CAPTIONS,
} from "@/lib/gallery-wall";
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
    if (typesOf(node).length > 0 || typeof node["@id"] === "string") {
      found.push(node);
    }
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

function images(html: string) {
  return [...html.matchAll(/<img\b([^>]*)>/g)].map((match) => {
    const tag = match[1];
    const attr = (name: string) => {
      const found = tag.match(new RegExp(`${name}="([^"]*)"`));
      return found?.[1] ?? "";
    };
    return {
      src: attr("src"),
      alt: attr("alt"),
      width: attr("width"),
      height: attr("height"),
      sizes: attr("sizes"),
    };
  });
}

describe("gallery page metadata", () => {
  it("sets the Palm Beach title, description, and canonical", () => {
    assert.equal(metadata.title, GALLERY_PAGE_TITLE);
    assert.equal(metadata.title, "Dog Grooming Gallery | Palm Beach | K9 Atelier");
    assert.equal(metadata.description, GALLERY_PAGE_DESCRIPTION);
    assert.equal(
      metadata.description,
      "Explore K9 Atelier\u2019s grooming portfolio featuring custom haircuts, Asian Fusion styling, hand stripping, creative color and coat-focused grooming in Palm Beach.",
    );
    assert.equal(metadata.alternates?.canonical, GALLERY_PAGE_CANONICAL);
    assert.equal(metadata.alternates?.canonical, "https://k9atelier.com/gallery");
    assert.equal(metadata.openGraph?.title, GALLERY_PAGE_TITLE);
    assert.equal(metadata.openGraph?.description, GALLERY_PAGE_DESCRIPTION);
    assert.equal(metadata.openGraph?.url, GALLERY_PAGE_CANONICAL);
    assert.equal(metadata.twitter?.title, GALLERY_PAGE_TITLE);
    assert.equal(metadata.twitter?.description, GALLERY_PAGE_DESCRIPTION);
  });
});

describe("gallery page content", () => {
  it("keeps one H1 and the portfolio context with crawlable service links", () => {
    const html = renderToStaticMarkup(<GalleryPage />);
    const links = anchors(html);

    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.match(html, new RegExp(`<h1[^>]*>${GALLERY_PAGE_H1}</h1>`));
    assert.match(html, /Selected grooming work by K9 Atelier in Palm Beach\./);
    assert.equal(html.includes(GALLERY_PAGE_INTRO), true);
    assert.match(html, new RegExp(`<h2[^>]*>${GALLERY_CONTEXT_HEADING}</h2>`));
    assert.equal(html.includes(GALLERY_CONTEXT_BODY), true);

    for (const service of GALLERY_SERVICE_LINKS) {
      const link = links.find((item) => item.href === service.href);
      assert.ok(link, service.href);
      assert.match(link.text, new RegExp(`^${service.label}\\b`));
      assert.match(link.text, /→/);
    }

    assert.equal(
      links.filter((link) => link.href === "/services/full-groom").length,
      1,
    );
    assert.equal(
      links.filter((link) => link.href === "/services/hand-stripping").length,
      1,
    );
    assert.equal(links.filter((link) => link.href === "/services/color").length, 1);
  });
});

describe("gallery image semantics", () => {
  it("renders each portfolio work as its own image with factual alt text and a readable caption", () => {
    const html = renderToStaticMarkup(<GalleryWall />);
    const imgs = images(html);

    assert.equal(imgs.length, GALLERY_FRAME_SLOTS.length);
    assert.equal(imgs.length, 16);

    for (const slot of GALLERY_FRAME_SLOTS) {
      const img = imgs.find((item) => item.src === slot.photoSrc);
      assert.ok(img, slot.photoSrc);
      assert.equal(img.alt, slot.photoAlt);
      assert.ok(img.alt.length > 20);
      assert.equal(img.alt.includes("Palm Beach"), false);
      assert.equal(img.width, String(slot.photoWidth));
      assert.equal(img.height, String(slot.photoHeight));
      assert.equal(
        existsSync(path.join(process.cwd(), "public", slot.photoSrc.slice(1))),
        true,
        slot.photoSrc,
      );

      const caption = SELECTED_WORK_CAPTIONS[slot.id];
      assert.ok(caption?.kicker);
      assert.ok(caption?.detail);
      assert.equal(html.includes(caption.kicker), true, caption.kicker);
      assert.equal(html.includes(caption.detail), true, caption.detail);
    }

    const artwork = readFileSync(
      new URL("./SelectedWorkSection.tsx", import.meta.url),
      "utf8",
    );
    assert.match(artwork, /sizes="\(max-width: 767px\) 46vw, 520px"/);
    assert.match(artwork, /className="h-auto w-full bg-transparent object-contain"/);
    assert.match(html, /h-auto w-full bg-transparent object-contain/);

    assert.equal(html.includes("Norwich Terrier"), true);
    assert.equal(html.includes("Hand Stripping"), true);
    assert.equal(html.includes(">Norwich<"), false);
    assert.equal(html.includes("Hand strip"), false);
    assert.equal(html.includes("Creative Color Dye"), false);
    assert.equal(html.includes("Creative color"), false);
    assert.equal((html.match(/Creative Color/g) ?? []).length, 2);
  });
});

describe("gallery structured data", () => {
  it("publishes a Home to Gallery breadcrumb without review, rating, or FAQ markup", () => {
    const html = renderToStaticMarkup(
      <>
        <LocalBusinessJsonLd />
        <GalleryJsonLd />
      </>,
    );
    const scripts = parseScripts(html);
    assert.equal(scripts.length, 2);
    const nodes = scripts.flatMap((script) => collectNodes(script));
    const serialized = JSON.stringify(scripts);

    const breadcrumbs = nodes.filter((node) => typesOf(node).includes("BreadcrumbList"));
    assert.equal(breadcrumbs.length, 1);
    const items = breadcrumbs[0].itemListElement as JsonLdNode[];
    assert.deepEqual(
      items.map((item) => [item.position, item.name, item.item]),
      [
        [1, "Home", "https://k9atelier.com/"],
        [2, "Gallery", "https://k9atelier.com/gallery"],
      ],
    );

    const page = nodes.find((node) => typesOf(node).includes("WebPage"));
    assert.ok(page);
    assert.equal(page["@id"], GALLERY_PAGE_CANONICAL);
    assert.equal(page.url, GALLERY_PAGE_CANONICAL);
    assert.equal(page.name, GALLERY_PAGE_TITLE);
    assert.equal(page.description, GALLERY_PAGE_DESCRIPTION);
    assert.deepEqual(page.about, { "@id": "https://k9atelier.com/#business" });

    const business = nodes.find((node) => typesOf(node).includes("LocalBusiness"));
    assert.ok(business);
    assert.equal(business["@id"], "https://k9atelier.com/#business");
    assert.equal(business.name, getBrandSearchName());
    assert.equal(business.name, "K9 Atelier Mobile Pet Spa");
    assert.equal(business.url, "https://k9atelier.com");
    assert.equal(business.telephone, "+1-561-593-3335");
    assert.equal(business.review, undefined);
    assert.equal(business.aggregateRating, undefined);

    assert.equal(serialized.includes('"Review"'), false);
    assert.equal(serialized.includes('"AggregateRating"'), false);
    assert.equal(serialized.includes('"reviewRating"'), false);
    assert.equal(serialized.includes('"FAQPage"'), false);
    assert.equal(serialized.includes('"ImageObject"'), false);
    assert.equal(
      nodes.filter((node) => typesOf(node).includes("ImageObject")).length,
      0,
    );
  });
});
