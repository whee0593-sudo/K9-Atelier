import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ServicesJsonLd } from "@/components/seo/ServicesJsonLd";
import { ServiceDirectory } from "@/components/services/ServiceDirectory";
import { ServicesHero } from "@/components/services/ServicesHero";
import { ServicesIntroduction } from "@/components/services/ServicesIntroduction";
import {
  SERVICES_DIRECTORY_DESCRIPTIONS,
  SERVICES_PAGE_CANONICAL,
  SERVICES_PAGE_DESCRIPTION,
  SERVICES_PAGE_TITLE,
  SERVICES_PATH,
  absoluteSiteUrl,
} from "@/lib/service-page";
import { metadata } from "@/app/services/page";

const SERVICE_LINKS = [
  ["/services/bath-coat-care", "Bath & Coat Care", "Bathing · Coat & skin maintenance"],
  ["/services/full-groom", "Full Grooming", "Haircuts · Styling · Coat care"],
  ["/services/hand-stripping", "Hand Stripping", "Traditional wire-coat maintenance"],
  ["/services/spa", "Spa Rituals", "Skin · Coat · Wellness"],
  ["/services/color", "Creative Color", "Pet-safe color artistry"],
  ["/services/specialty-care", "Specialty Care", "Senior · Extra-gentle comfort care"],
  ["/services/add-ons", "Add-On Care", "Finishing · Coat support"],
] as const;

function hasNestedAnchor(html: string) {
  let depth = 0;
  for (const match of html.matchAll(/<a\b[^>]*>|<\/a>/g)) {
    if (match[0].startsWith("</")) {
      depth -= 1;
      if (depth < 0) return true;
    } else if (depth > 0) {
      return true;
    } else {
      depth += 1;
    }
  }
  return depth !== 0;
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

describe("services page metadata", () => {
  it("sets the Palm Beach title, description, and canonical", () => {
    assert.equal(metadata.title, SERVICES_PAGE_TITLE);
    assert.equal(
      metadata.title,
      "Mobile Dog Grooming Services in Palm Beach | K9 Atelier",
    );
    assert.equal(metadata.description, SERVICES_PAGE_DESCRIPTION);
    assert.equal(
      metadata.description,
      "Explore K9 Atelier\u2019s private mobile dog grooming services in Palm Beach, including full grooming, coat care, hand stripping, spa treatments and specialty care.",
    );
    assert.equal(metadata.alternates?.canonical, SERVICES_PAGE_CANONICAL);
    assert.equal(metadata.alternates?.canonical, "https://k9atelier.com/services");
    assert.equal(absoluteSiteUrl(SERVICES_PATH), SERVICES_PAGE_CANONICAL);
  });
});

describe("services page content", () => {
  it("keeps one H1 and the Palm Beach supporting sentence", () => {
    const html = renderToStaticMarkup(
      <>
        <ServicesHero />
        <ServiceDirectory />
        <ServicesIntroduction />
      </>,
    );
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.match(html, /Grooming, Considered/);
    assert.match(html, /Down to Every Detail\./);
    const visibleText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    assert.match(
      visibleText,
      /Private, one-on-one mobile dog grooming, tailored to your dog\./,
    );
    assert.match(
      visibleText,
      /Jupiter Island, Jupiter, Tequesta, Palm Beach Gardens, Palm Beach and West Palm Beach\./,
    );
    assert.match(html, /Dogs up to 45 lbs · By appointment only/);
  });

  it("keeps seven crawlable service cards and the groomer link", () => {
    const html = renderToStaticMarkup(
      <>
        <ServiceDirectory />
        <ServicesIntroduction />
      </>,
    );
    const links = anchors(html);

    for (const [href, name, description] of SERVICE_LINKS) {
      const link = links.find((item) => item.href === href);
      assert.ok(link, href);
      assert.match(link.text, new RegExp(`^${name.replace("&", "&")}\\b`));
      const escaped = description.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (href === "/services/bath-coat-care") {
        const visible = html
          .replace(/<[^>]+>/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ");
        assert.match(visible, new RegExp(escaped));
        assert.equal(link.text.includes("Show-Level Long-Coat Care"), false);
      } else {
        assert.match(link.text, new RegExp(escaped));
      }
      const slug = href.replace("/services/", "") as keyof typeof SERVICES_DIRECTORY_DESCRIPTIONS;
      assert.equal(SERVICES_DIRECTORY_DESCRIPTIONS[slug], description);
    }

    const longCoat = links.find((item) => item.href === "/services/long-coat-care");
    assert.ok(longCoat);
    assert.equal(longCoat.text, "Show-Level Long-Coat Care");
    assert.equal(links.filter((item) => item.href === "/services/bath-coat-care").length, 1);
    assert.equal(hasNestedAnchor(html), false);

    const booking = links.find((item) => item.href === "/book");
    const groomer = links.find((item) => item.href === "/about");
    assert.ok(booking);
    assert.match(booking.text, /Book Your Appointment/);
    assert.ok(groomer);
    assert.match(groomer.text, /Meet Your Groomer/);
    assert.ok(html.indexOf("Book Your Appointment") < html.indexOf("Meet Your Groomer"));
    assert.match(html, /Care Designed Around the Individual Dog/);
  });
});

describe("services structured data", () => {
  it("publishes a Home to Services breadcrumb and the services page entity", () => {
    const html = renderToStaticMarkup(<ServicesJsonLd />);
    const match = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    assert.ok(match);
    const data = JSON.parse(match[1]) as {
      "@graph": Array<Record<string, unknown>>;
    };
    const breadcrumb = data["@graph"].find(
      (node) => node["@type"] === "BreadcrumbList",
    );
    const page = data["@graph"].find((node) => node["@type"] === "WebPage");
    assert.ok(breadcrumb);
    assert.ok(page);

    const items = breadcrumb.itemListElement as Array<Record<string, unknown>>;
    assert.deepEqual(
      items.map((item) => [item.position, item.name, item.item]),
      [
        [1, "Home", "https://k9atelier.com/"],
        [2, "Services", "https://k9atelier.com/services"],
      ],
    );
    assert.equal(page["@id"], "https://k9atelier.com/services");
    assert.equal(page.url, "https://k9atelier.com/services");
    assert.equal(page.name, SERVICES_PAGE_TITLE);
    assert.equal(
      (page.about as { "@id": string })["@id"],
      "https://k9atelier.com/#business",
    );
  });
});
