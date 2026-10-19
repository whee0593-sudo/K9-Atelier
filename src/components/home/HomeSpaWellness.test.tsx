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
  it("shows Luxury Spa Day instead of the retired spa rituals", () => {
    assert.equal(homeSpaWellnessServices.length, 1);
    assert.equal(homeSpaWellnessServices[0]?.title, "Luxury Spa Day");
    assert.equal(
      homeSpaWellnessServices[0]?.suitability,
      "Nail, ear, and teeth care included",
    );
    assert.match(
      homeSpaWellnessServices[0]?.details ?? "",
      /fully customized, relaxing spa experience/,
    );
    assert.equal(
      homeSpaWellnessServices.some((service) => /Dead Sea|Aromatherapy|Sensitive Skin Botanical/.test(service.title)),
      false,
    );
  });

  it("exposes expand and collapse button labels", () => {
    assert.equal(spaDetailsToggleLabel(false), "View Details");
    assert.equal(spaDetailsToggleLabel(true), "Hide Details");
  });

  it("points the CTA to spa wellness pricing", () => {
    assert.equal(homeSpaWellnessIntro.ctaHref, "/services/spa");
    assert.equal(homeSpaWellnessIntro.ctaLabel, "View Luxury Spa Day");
    assert.equal(homeSpaWellnessIntro.eyebrow, "Spa & Wellness");
    assert.equal(homeSpaWellnessIntro.title, "Care for Skin, Coat & Comfort");
    assert.match(
      homeSpaWellnessIntro.body,
      /fully customized, relaxing spa experience/,
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

    assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 1);
    assert.equal((html.match(/aria-controls="/g) ?? []).length, 1);
    assert.equal((html.match(/>View Details</g) ?? []).length, 1);
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
