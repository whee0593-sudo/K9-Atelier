import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Footer } from "@/components/Footer";
import { HomePageContent } from "@/components/home/HomePageContent";
import { metadata } from "@/app/page";
import {
  HOME_PAGE_CANONICAL,
  HOME_PAGE_DESCRIPTION,
  HOME_PAGE_TITLE,
} from "@/lib/home-seo";
import { business } from "@/lib/business";
import { getSiteChrome } from "@/lib/site-chrome";

const REMOVED_HOME_SECTIONS = [
  "HomeAboutTeaser",
  "HomeArtistry",
  "HomeExperience",
  "HomeExpertise",
  "HomeFaqTeaser",
  "HomeGentleCare",
  "HomeReviews",
  "HomeSignatureServices",
  "HomeSpaWellness",
] as const;

describe("home page content", () => {
  it("sends the hero secondary button to the callback page", () => {
    const source = readFileSync(new URL("./HomeHero.tsx", import.meta.url), "utf8");

    assert.match(source, /Request a Call/);
    assert.match(source, /href="\/request-a-call"/);
    assert.match(source, /heroCtaClass/);
    assert.match(source, /business\.brand\.highlights/);
    assert.equal(
      source.includes("Award-winning grooming, brought directly"),
      false,
    );
    assert.equal(source.includes("variant=\"secondary\""), false);
    assert.equal(source.includes("Discover the Experience"), false);
    assert.equal(source.includes("/#first-visit"), false);
  });

  it("puts brand copy and CTAs above the mobile hero image", () => {
    const source = readFileSync(new URL("./HomeHero.tsx", import.meta.url), "utf8");

    const wordmark = source.indexOf("business.brand.wordmark");
    const lead = source.indexOf("business.brand.highlights");
    const bookCta = source.indexOf("Book Online");
    const askCta = source.indexOf("Request a Call");
    const photo = source.indexOf("<EditorialPhoto");
    const mobileMeta = source.indexOf("<HeroServiceMeta className=\"md:hidden\"");
    const desktopMeta = source.indexOf("hidden md:block");

    assert.ok(wordmark < lead);
    assert.ok(lead < bookCta);
    assert.ok(bookCta < askCta);
    assert.ok(askCta < photo);
    assert.ok(photo < mobileMeta);
    assert.ok(desktopMeta > 0);
    assert.match(source, /calc\(100vw - 2rem\)/);
    assert.match(source, /!h-\[300px\]/);
    assert.match(source, /md:!h-\[520px\]/);
    assert.match(source, /md:grid-cols-2/);
  });

  it("places service discovery between the hero and first visit", () => {
    const source = readFileSync(
      new URL("./HomePageContent.tsx", import.meta.url),
      "utf8",
    );

    const hero = source.indexOf("<HomeHero />");
    const services = source.indexOf("<HomeServices");
    const selectedWork = source.indexOf("<HomeSelectedWork />");
    const firstVisit = source.indexOf("<HomeFirstVisit />");

    assert.ok(hero >= 0 && services > hero && firstVisit > services);
    assert.ok(selectedWork > services && firstVisit > selectedWork);

    for (const section of REMOVED_HOME_SECTIONS) {
      assert.equal(
        source.includes(section),
        false,
        `homepage still references ${section}`,
      );
    }
  });
});

describe("homepage SEO", () => {
  it("sets the Palm Beach title, description, and canonical", () => {
    assert.equal(metadata.title, HOME_PAGE_TITLE);
    assert.equal(
      metadata.title,
      "Mobile Dog Grooming in Palm Beach | K9 Atelier",
    );
    assert.equal(metadata.description, HOME_PAGE_DESCRIPTION);
    assert.equal(
      metadata.description,
      "Private mobile dog grooming in Palm Beach by a multiple award-winning show groomer, specializing in tailored styling, coat care, senior care and hand stripping.",
    );
    const page = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");
    assert.match(
      page,
      /<link rel="canonical" href=\{HOME_PAGE_CANONICAL\} \/>/,
    );
    assert.match(
      page,
      /<meta property="og:url" content=\{HOME_PAGE_CANONICAL\} \/>/,
    );
    assert.equal(HOME_PAGE_CANONICAL, "https://k9atelier.com/");
  });

  it("keeps one H1, the hero introduction, and crawlable service links", () => {
    const html = renderToStaticMarkup(<HomePageContent />);
    const h1s = html.match(/<h1\b/g) ?? [];

    assert.equal(h1s.length, 1);
    assert.match(html, /<h1\b[^>]*>K9 ATELIER<\/h1>/);
    assert.doesNotMatch(html, /grooming, elevated\./i);
    const highlights = html.match(/<ul role="list"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? "";
    assert.deepEqual(
      [...highlights.matchAll(/<li>([^<]*)<\/li>/g)].map((match) => match[1]),
      [
        "At your doorstep",
        "White-glove premium service",
        "One-on-one care, unhurried, cage free",
        "Multiple award-winning show groomer"
      ],
    );
    assert.match(html, /id="home-services-heading"[^>]*>Services<\/h2>/);
    const visibleText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    assert.match(
      visibleText,
      /Serving Jupiter Island · Jupiter · Tequesta · Palm Beach Gardens · Palm Beach(?! · West Palm Beach)/,
    );
    assert.equal(visibleText.includes("West Palm Beach"), false);
    assert.doesNotMatch(
      html,
      /Palm Beach · Jupiter · Palm Beach Gardens · West Palm Beach/,
    );

    const anchors = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(
      (match) => ({
        href: match[1],
        text: match[2]
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ")
          .trim(),
      }),
    );
    const byHref = (href: string) => anchors.find((anchor) => anchor.href === href);

    assert.match(byHref("/services/full-groom")?.text ?? "", /^Full Grooming\b/);
    assert.match(byHref("/services/bath-coat-care")?.text ?? "", /^Bath & Coat Care\b/);
    assert.match(byHref("/services/hand-stripping")?.text ?? "", /^Hand Stripping\b/);
    assert.match(byHref("/services/spa")?.text ?? "", /^Luxury Spa Day\b/);
    assert.match(byHref("/services/spa")?.text ?? "", /A fully customized spa experience/);
    assert.equal((byHref("/services/spa")?.text ?? "").includes("$"), false);
    assert.match(byHref("/services/color")?.text ?? "", /^Creative Color\b/);
    assert.match(byHref("/services/color")?.text ?? "", /Pet-safe color artistry/);
    assert.equal((byHref("/services/color")?.text ?? "").includes("$"), false);
    const specialtyCard = anchors.find(
      (anchor) =>
        anchor.href === "/services/specialty-care" &&
        anchor.text.startsWith("Specialty Care"),
    );
    assert.match(specialtyCard?.text ?? "", /^Specialty Care\b/);
    assert.match(specialtyCard?.text ?? "", /Senior · Comfort care/);
    assert.match(byHref("/gallery")?.text ?? "", /Explore Our Work/);
  });

  it("pairs six services with portfolio photos and hides public prices", () => {
    const html = renderToStaticMarkup(<HomePageContent />);
    const start = html.indexOf('id="home-services-heading"');
    const end = html.indexOf('id="home-selected-work-heading"');
    const services = html.slice(start, end);
    assert.equal((services.match(/<img\b/g) ?? []).length, 6);
    assert.equal((services.match(/loading="lazy"/g) ?? []).length, 6);
    assert.doesNotMatch(services, /\$/);
    for (const image of services.matchAll(/<img[^>]*src="([^"]+)"/g)) {
      const source = new URL(image[1].replace(/&amp;/g, "&"), "https://k9atelier.com");
      const path = source.searchParams.get("url") ?? source.pathname;
      assert.ok(readFileSync(new URL(`../../../public${path}`, import.meta.url)).length > 0);
    }
    assert.match(html, /Private care\. At your doorstep\./);
    assert.match(html, /href="tel:561-593-3335"/);
  });

  it("places four lazy selected works between services and the first visit", () => {
    const html = renderToStaticMarkup(<HomePageContent />);
    const start = html.indexOf('id="home-selected-work-heading"');
    const end = html.indexOf('id="first-visit"');
    assert.ok(start > html.indexOf('id="home-services-heading"'));
    assert.ok(end > start);

    const section = html.slice(start, end);
    assert.match(section, /Selected Work/);
    assert.doesNotMatch(section, /Every coat, considered individually\./);
    assert.match(section, /href="\/gallery"/);
    assert.match(section, /Explore Our Work/);

    const sources = ["gallery-04.png", "gallery-11.png", "gallery-06.png", "gallery-16.png"];
    let previous = -1;
    for (const file of sources) {
      const index = section.indexOf(file);
      assert.ok(index > previous, file);
      previous = index;
    }

    const images = [...section.matchAll(/<img\b[^>]*>/g)].map((match) => match[0]);
    assert.equal(images.length, 4);
    for (const image of images) {
      assert.match(image, /loading="lazy"/);
      assert.match(image, /sizes="/);
      assert.equal(/fetchpriority/i.test(image), false);
      assert.equal(/\bpriority\b/.test(image), false);
    }

    const component = readFileSync(
      new URL("./HomeSelectedWork.tsx", import.meta.url),
      "utf8",
    );
    assert.equal(component.includes("priority"), false);
    assert.equal(component.includes("preload"), false);
  });

  it("shows the public phone and Palm Beach service-area sentence in the footer", () => {
    const html = renderToStaticMarkup(<Footer chrome={getSiteChrome()} />);

    assert.equal(business.brand.phone, "561-593-3335");
    assert.equal(business.brand.phoneDisplay, "561-593-3335");
    assert.match(html, /561-593-3335/);
    assert.match(html, /href="tel:\+15615933335"/);
    const visibleText = html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
    assert.match(
      visibleText,
      /Private, cage-free mobile dog grooming for dogs up to 45 lbs\./,
    );
    assert.match(
      visibleText,
      /Serving Jupiter Island, Jupiter, Tequesta, Palm Beach Gardens & Palm Beach\./,
    );
    assert.equal(visibleText.includes("West Palm Beach"), false);
  });
});
