import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coloringOptionDisplayNote,
  coloringOptionPriceLabel,
  getServiceById,
  serviceCardAccessLabel,
  serviceCardPriceValue,
  serviceCardSummary,
  serviceDurationLabel,
  serviceStartingPriceLabel,
} from "./service-page";
import { getBookableServicesForPet } from "./services";

describe("service page helpers", () => {
  it("keeps card summaries short", () => {
    const showCare = getServiceById("long-coat-show-care");
    assert.ok(showCare);
    const words = serviceCardSummary(showCare).split(/\s+/);
    assert.ok(words.length <= 35);
  });

  it("formats starting prices with From and consistent units", () => {
    const bath = getServiceById("signature-bath-care");
    const hourly = getServiceById("hand-stripping");
    const addOn = getServiceById("dematting-brush-out");
    assert.equal(serviceStartingPriceLabel(bath!), "From $90");
    assert.equal(serviceStartingPriceLabel(hourly!), "From $150 / hour");
    assert.equal(serviceStartingPriceLabel(addOn!), "From $30 / 15 min");
  });

  it("reports duration ranges from weight tiers", () => {
    const bath = getServiceById("signature-bath-care");
    assert.equal(serviceDurationLabel(bath!), "45–90 min");
  });

  it("shows card meta amounts without repeating From", () => {
    const bath = getServiceById("signature-bath-care");
    const hourly = getServiceById("hand-stripping");
    const complimentary = getServiceById("end-of-life-care");
    assert.equal(serviceCardPriceValue(bath!), "$90");
    assert.equal(serviceCardPriceValue(hourly!), "$150 / hour");
    assert.equal(serviceCardPriceValue(complimentary!), "Complimentary");
    assert.equal(serviceDurationLabel(complimentary!), "By appointment only");
    assert.equal(serviceCardAccessLabel(complimentary!), "Members only");
    assert.equal(complimentary!.membersOnly, true);
  });

  it("keeps members-only end-of-life care off the public booking list", () => {
    const publicList = getBookableServicesForPet(20);
    const memberList = getBookableServicesForPet(20, {
      includeMembersOnly: true,
    });
    assert.equal(
      publicList.some((service) => service.id === "end-of-life-care"),
      false,
    );
    assert.equal(
      memberList.some((service) => service.id === "end-of-life-care"),
      true,
    );
  });

  it("keeps coloring option prices once, with section units when present", () => {
    assert.equal(
      coloringOptionPriceLabel({
        priceFrom: 50,
        note: "From $50 · washes out in 1–2 baths",
      }),
      "From $50",
    );
    assert.equal(
      coloringOptionPriceLabel({
        priceFrom: 100,
        note: "$100 / section / per single color",
      }),
      "From $100 / section",
    );
    assert.equal(
      coloringOptionPriceLabel({
        priceFrom: 350,
        note: "$350 (single color)",
      }),
      "From $350",
    );
    assert.equal(
      coloringOptionPriceLabel({ consultationRequired: true }),
      "Consultation required",
    );
  });

  it("strips duplicate price text from coloring notes", () => {
    assert.equal(
      coloringOptionDisplayNote("From $50 · washes out in 1–2 baths"),
      "washes out in 1–2 baths",
    );
    assert.equal(
      coloringOptionDisplayNote("$100 / section / per single color"),
      "section / per single color",
    );
    assert.equal(
      coloringOptionDisplayNote("$350 (single color)"),
      "single color",
    );
  });
});
