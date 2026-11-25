import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hourlyAmountFromTimes, hourlyRateForCatalogId } from "./hourly";
import {
  VISIT_LINE_ITEMS_KEY,
  appointmentFieldsFromVisitLineItems,
  mergeVisitLineItemsIntoOptions,
  readStoredVisitLineItems,
  stringAddOnOptions,
} from "./visit-line-items";

describe("visit line items", () => {
  it("rounds both billable minutes and the accumulated Hand Stripping amount up", () => {
    const rate = hourlyRateForCatalogId("hand-stripping");
    assert.equal(rate, 160);
    const start = "2026-07-08T13:00:00.000Z";
    const startMs = Date.parse(start);
    assert.equal(hourlyAmountFromTimes(start, null, rate, startMs), 0);
    assert.equal(hourlyAmountFromTimes(start, null, rate, startMs + 1), 3);
    assert.equal(hourlyAmountFromTimes(start, null, rate, startMs + 59_999), 3);
    assert.equal(hourlyAmountFromTimes(start, null, rate, startMs + 60_000), 3);
    assert.equal(hourlyAmountFromTimes(start, null, rate, startMs + 60_001), 6);
    assert.equal(hourlyAmountFromTimes(start, "2026-07-08T13:02:00.000Z", rate), 6);
    assert.equal(hourlyAmountFromTimes(start, "2026-07-08T13:02:59.999Z", rate), 8);
    assert.equal(hourlyAmountFromTimes(start, "2026-07-08T14:15:00.000Z", rate), 200);
    assert.equal(hourlyAmountFromTimes(start, null, 0.6, startMs + 60_000), 1);
  });

  it("maps the first catalog service and remaining add-ons", () => {
    const fields = appointmentFieldsFromVisitLineItems([
      {
        id: "1",
        label: "Signature Bath & Care",
        amount: 140,
        catalogId: "signature-bath-care",
      },
      {
        id: "2",
        label: "Mini Trim",
        amount: 25,
        catalogId: "mini-trim",
      },
    ]);
    assert.equal(fields.serviceId, "signature-bath-care");
    assert.deepEqual(fields.addOnIds, ["mini-trim"]);
    assert.equal(fields.estimatedTotal, 165);
  });

  it("stores and reads the edited lines without leaking into add-on options", () => {
    const items = [
      {
        id: "1",
        label: "Signature Bath & Care",
        amount: 120,
        listAmount: 140,
        catalogId: "signature-bath-care",
      },
    ];
    const merged = mergeVisitLineItemsIntoOptions(
      { "creative-accent-coloring": "Lavender" },
      items,
    ) as Record<string, unknown>;
    assert.equal(merged["creative-accent-coloring"], "Lavender");
    assert.deepEqual(readStoredVisitLineItems(merged), [
      {
        ...items[0],
        referralCategory: "eligible_service",
      },
    ]);
    assert.equal(
      stringAddOnOptions(merged)[VISIT_LINE_ITEMS_KEY],
      undefined,
    );
  });
});
