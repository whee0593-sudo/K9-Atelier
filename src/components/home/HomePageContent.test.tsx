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
import { business, getCommunitiesServedLabel } from "@/lib/business";

const REMOVED_HOME_SECTIONS = [
  "HomeAboutTeaser",
  "HomeArtistry",
  "HomeBookingCta",
  "HomeExperience",
  "HomeExpertise",
  "HomeFaqTeaser",
  "HomeGentleCare",
  "HomeReviews",
  "HomeSignatureServices",
  "HomeSpaWellness",
] as const;

describe("home page content", () => {
  it("uses the shortened show-groomer hero lead", () => {
    const business = JSON.parse(
      readFileSync(new URL("../../../content/business.json", import.meta.url), "utf8"),
    ) as { brand: { lead: string } };

    assert.equal(
      business.brand.lead,
      "Award-winning show groomer — tailored styling, gentle senior care, and hand stripping.",
    );
    assert.equal(
      business.brand.lead.includes("Private mobile pet spa in Palm Beach County"),
      false,
    );
  });

  it("sends the hero secondary button to the contact page", () => {
    const source = readFileSync(new URL("./HomeHero.tsx", import.meta.url), "utf8");

    assert.match(source, /Ask a Question/);
    assert.match(source, /href="\/contact"/);
    assert.match(source, /heroCtaClass/);
    assert.match(source, /heroSecondaryCtaClass/);
    assert.match(source, /business\.brand\.lead/);
    assert.equal(
      source.includes("Award-winning grooming, brought directly"),
      false,
    );
    assert.equal(source.includes("variant=\"secondary\""), false);
    assert.equal(source.includes("Discover the Experience"), false);
    assert.equal(source.includes("/#first-visit"), false);
  });

  it("puts brand copy, CTAs, and service meta above the mobile hero image", () => {
    const source = readFileSync(new URL("./HomeHero.tsx", import.meta.url), "utf8");

    const eyebrow = source.indexOf("business.brand.lockup");
    const tagline = source.indexOf("business.brand.tagline");
    const lead = source.indexOf("business.brand.lead");
    const bookCta = source.indexOf("Book an Appointment");
    const askCta = source.indexOf("Ask a Question");
    const serviceMeta = source.indexOf("<HeroServiceMeta className=\"mt-6 md:mt-8\"");
    const photo = source.indexOf("<EditorialPhoto");

    assert.ok(eyebrow > 0 && eyebrow < tagline);
    assert.ok(tagline < lead);
    assert.ok(lead < bookCta);
    assert.ok(bookCta < askCta);
    assert.ok(askCta < serviceMeta);
    assert.ok(serviceMeta < photo);
    assert.match(source, /max-h-\[46vh\]/);
    assert.match(source, /md:max-h-\[80vh\]/);
    assert.match(source, /md:!w-\[353px\]/);
    assert.match(source, /aspect-\[4\/5\]/);
    assert.match(source, /calc\(46vh \* 0\.8\)/);
    assert.equal(source.includes('sizes="(min-width: 768px) 42vw, 100vw"'), false);
    assert.match(source, /md:grid-cols-2/);
  });

  it("places service discovery between the hero and first visit", () => {
    const source = readFileSync(
      new URL("./HomePageContent.tsx", import.meta.url),
      "utf8",
    );

    const hero = source.indexOf("<HomeHero />");
    const services = source.indexOf("<HomeServices />");
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
    assert.match(html, /K9 ATELIER — grooming, elevated\./);
    assert.match(html, /Private Mobile Pet Spa · Palm Beach/);
    assert.match(
      html,
      /Award-winning show groomer — tailored styling, gentle senior care, and hand stripping\./,
    );
    assert.match(html, /Grooming, tailored to the individual\./);
    assert.match(html, new RegExp(getCommunitiesServedLabel().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(
      html,
      /Jupiter · Palm Beach Gardens · West Palm Beach/,
    );
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
    assert.match(byHref("/services/spa")?.text ?? "", /^Spa Rituals\b/);
    assert.match(byHref("/services/spa")?.text ?? "", /Skin · Coat · Wellness/);
    assert.match(byHref("/services/spa")?.text ?? "", /From \$140/);
    assert.match(byHref("/services/color")?.text ?? "", /^Creative Color\b/);
    assert.match(byHref("/services/color")?.text ?? "", /Pet-safe color artistry/);
    assert.match(byHref("/services/color")?.text ?? "", /From \$50/);
    assert.match(byHref("/services/specialty-care")?.text ?? "", /^Specialty Care\b/);
    assert.match(byHref("/services/specialty-care")?.text ?? "", /Senior · Comfort care/);
    assert.match(byHref("/gallery")?.text ?? "", /View the Gallery/);
  });

  it("places four lazy selected works between services and the first visit", () => {
    const html = renderToStaticMarkup(<HomePageContent />);
    const start = html.indexOf('id="home-selected-work-heading"');
    const end = html.indexOf('id="first-visit"');
    assert.ok(start > html.indexOf("Grooming, tailored to the individual."));
    assert.ok(end > start);

    const section = html.slice(start, end);
    assert.match(section, /Selected Work/);
    assert.match(section, /Every coat, considered individually\./);
    assert.match(section, /href="\/gallery"/);
    assert.match(section, /View the Gallery/);

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
    const html = renderToStaticMarkup(<Footer />);

    assert.equal(business.brand.phone, "561-593-3335");
    assert.equal(business.brand.phoneDisplay, "561-593-3335");
    assert.match(html, /561-593-3335/);
    assert.match(html, /href="tel:\+15615933335"/);
    assert.match(
      html,
      /Serving Jupiter, Palm Beach Gardens &amp; West Palm Beach\./,
    );
  });
});
