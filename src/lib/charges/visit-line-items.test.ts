import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  VISIT_LINE_ITEMS_KEY,
  appointmentFieldsFromVisitLineItems,
  mergeVisitLineItemsIntoOptions,
  readStoredVisitLineItems,
  stringAddOnOptions,
} from "./visit-line-items";

describe("visit line items", () => {
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
        amount: 140,
        catalogId: "signature-bath-care",
      },
    ];
    const merged = mergeVisitLineItemsIntoOptions(
      { "creative-accent-coloring": "Lavender" },
      items,
    );
    assert.equal(merged["creative-accent-coloring"], "Lavender");
    assert.deepEqual(readStoredVisitLineItems(merged), items);
    assert.equal(
      stringAddOnOptions(merged)[VISIT_LINE_ITEMS_KEY],
      undefined,
    );
  });
});
