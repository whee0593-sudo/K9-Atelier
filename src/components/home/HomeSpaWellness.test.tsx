import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HomeSpaRitualItem } from "@/components/home/HomeSpaWellness";
import {
  homeSpaWellnessIntro,
  homeSpaWellnessServices,
  spaDetailsToggleLabel,
} from "@/components/home/home-spa-wellness";

describe("home spa wellness content", () => {
  it("keeps three ritual names and short suitability lines", () => {
    assert.equal(homeSpaWellnessServices.length, 3);
    assert.deepEqual(
      homeSpaWellnessServices.map((service) => service.title),
      [
        "Dead Sea Mineral Ritual",
        "Lavender & Chamomile Bath Ritual",
        "Sensitive Skin Botanical Ritual",
      ],
    );
    assert.deepEqual(
      homeSpaWellnessServices.map((service) => service.suitability),
      [
        "For heavy shedding and dense double coats.",
        "For dry, dull or tangle-prone coats.",
        "For dry or sensitive skin.",
      ],
    );
  });

  it("preserves the existing long descriptions for collapse", () => {
    assert.match(
      homeSpaWellnessServices[0].details,
      /Dead Sea mud care/,
    );
    assert.match(
      homeSpaWellnessServices[1].details,
      /lavender and chamomile/,
    );
    assert.match(
      homeSpaWellnessServices[2].details,
      /oatmeal\/aloe-based care/,
    );
  });

  it("exposes expand and collapse button labels", () => {
    assert.equal(spaDetailsToggleLabel(false), "View Details");
    assert.equal(spaDetailsToggleLabel(true), "Hide Details");
  });

  it("points the CTA to spa wellness pricing", () => {
    assert.equal(homeSpaWellnessIntro.ctaHref, "/services#spa-wellness");
    assert.equal(
      homeSpaWellnessIntro.ctaLabel,
      "View Spa Services & Pricing",
    );
    assert.equal(homeSpaWellnessIntro.eyebrow, "Spa & Wellness");
    assert.equal(homeSpaWellnessIntro.title, "Care for Skin, Coat & Comfort");
    assert.equal(
      homeSpaWellnessIntro.body,
      "Targeted spa treatments selected for your dog’s skin and coat needs.",
    );
    assert.equal(
      homeSpaWellnessIntro.note,
      "Spa Rituals are scheduled separately from full haircut appointments.",
    );
  });
});

describe("home spa wellness markup", () => {
  it("renders collapsed details by default with aria-expanded false", () => {
    const html = homeSpaWellnessServices
      .map((service) =>
        renderToStaticMarkup(<HomeSpaRitualItem service={service} />),
      )
      .join("");

    for (const service of homeSpaWellnessServices) {
      assert.match(html, new RegExp(escapeRegExp(escapeHtml(service.title))));
      assert.match(
        html,
        new RegExp(escapeRegExp(escapeHtml(service.suitability))),
      );
      assert.match(html, new RegExp(escapeRegExp(escapeHtml(service.details))));
    }

    assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 3);
    assert.equal((html.match(/aria-controls="/g) ?? []).length, 3);
    assert.equal((html.match(/>View Details</g) ?? []).length, 3);
    assert.equal(html.includes("Hide Details"), false);
    assert.match(html, /grid-rows-\[0fr\]/);
    assert.equal(html.includes("From $140"), false);
    assert.equal(html.includes("All spa treatments include"), false);
  });

  it("shows hide label and aria-expanded true when a ritual is open", () => {
    const service = homeSpaWellnessServices[0];
    const html = renderToStaticMarkup(
      <HomeSpaRitualItem service={service} defaultOpen />,
    );

    assert.match(html, /aria-expanded="true"/);
    assert.match(html, />Hide Details</);
    assert.equal(html.includes("View Details"), false);
    assert.match(html, /grid-rows-\[1fr\]/);
    assert.match(html, new RegExp(escapeRegExp(escapeHtml(service.details))));
  });
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
