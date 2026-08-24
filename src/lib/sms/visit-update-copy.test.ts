import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVisitServicesUpdatedSms } from "./visit-update-copy";

describe("visit services updated SMS", () => {
  it("lists the new services and estimated total", () => {
    assert.equal(
      buildVisitServicesUpdatedSms({
        services: ["Signature Bath & Care", "Mini Trim"],
        estimatedTotal: 165,
      }),
      [
        "K9 ATELIER: Today's appointment has been updated. Updated services: Signature Bath & Care, Mini Trim. Estimated total: $165.00.",
        "",
        "Reply STOP to opt out.",
      ].join("\n"),
    );
  });
});
