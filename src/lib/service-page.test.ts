import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  coloringOptionDisplayNote,
  coloringOptionPriceLabel,
  FULL_GROOM_IDS,
  FULL_GROOM_PAGE_DESCRIPTION,
  FULL_GROOM_PAGE_H1,
  FULL_GROOM_PAGE_TITLE,
  FULL_GROOM_PATH,
  SERVICES_HASH_ROUTES,
  SERVICES_NAV,
  SERVICES_PATH,
  absoluteSiteUrl,
  getServiceById,
  getServicesByIds,
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
    assert.equal(serviceStartingPriceLabel(hourly!), "From $160 / hour");
    assert.equal(serviceStartingPriceLabel(addOn!), "From $30 / 15 min");
    const groom = getServiceById("custom-full-haircut");
    const mini = getServiceById("mini-trim");
    assert.equal(serviceStartingPriceLabel(groom!), "From $140");
    assert.equal(serviceStartingPriceLabel(mini!), "From $30");
    assert.equal(serviceCardSummary(mini!), "Eyes, feet & sanitary areas only.");
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
    assert.equal(serviceCardPriceValue(hourly!), "$160 / hour");
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

  it("points Full Groom navigation at the dedicated category route", () => {
    const fullGroom = SERVICES_NAV.find((item) => item.label === "Full Groom");
    assert.equal(fullGroom?.href, FULL_GROOM_PATH);
    assert.equal(fullGroom?.sectionId, "full-groom");
    assert.equal(
      SERVICES_NAV.find((item) => item.label === "Bath & Coat")?.href,
      `${SERVICES_PATH}#bath-coat`,
    );
  });

  it("keeps Full Groom services on a shared catalog", () => {
    const services = getServicesByIds(FULL_GROOM_IDS);
    assert.deepEqual(
      services.map((service) => service.id),
      ["custom-full-haircut", "hand-stripping"],
    );
    assert.equal(services[0]?.name, "Custom Full Haircut & Styling");
    assert.equal(services[1]?.name, "Hand Stripping");
  });

  it("maps the legacy Full Groom hash to the category route", () => {
    assert.equal(SERVICES_HASH_ROUTES["full-groom"], FULL_GROOM_PATH);
  });

  it("uses independent Full Groom SEO copy and canonical", () => {
    assert.equal(
      FULL_GROOM_PAGE_TITLE,
      "Full Grooming & Hand Stripping | K9 Atelier",
    );
    assert.equal(
      FULL_GROOM_PAGE_DESCRIPTION,
      "Custom full grooming and professional hand stripping for suitable wire-coated breeds. Private mobile grooming serving Jupiter, Palm Beach Gardens and surrounding Palm Beach areas.",
    );
    assert.equal(FULL_GROOM_PAGE_H1, "Full Grooming & Hand Stripping");
    assert.equal(
      absoluteSiteUrl(FULL_GROOM_PATH),
      "https://k9atelier.com/services/full-groom",
    );
    assert.equal(
      absoluteSiteUrl(SERVICES_PATH),
      "https://k9atelier.com/services",
    );
  });
});
