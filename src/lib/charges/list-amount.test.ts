import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeLineItems } from "./line-items";
import {
  catalogLinePatch,
  formatLineItemMoney,
  listAmountForCatalog,
  listedAmountIfChanged,
  withCatalogListAmount,
} from "./list-amount";
import { buildChargeReceiptParagraphs } from "./receipt-content";
import { buildChargeReceiptCardHtml, buildChargeReceiptCardText } from "./receipt-email";
import type { AdminAppointmentRecord } from "@/lib/appointments/types";
import type { AppointmentChargeRecord } from "./types";

describe("checkout list price", () => {
  it("shows the original price when staff waives or reduces a line", () => {
    assert.equal(
      listedAmountIfChanged({ amount: 0, listAmount: 140 }),
      140,
    );
    assert.equal(
      listedAmountIfChanged({ amount: 120, listAmount: 140 }),
      140,
    );
    assert.equal(
      formatLineItemMoney({ amount: 0, listAmount: 140 }),
      "$140.00 → $0.00",
    );
    assert.equal(
      formatLineItemMoney({ amount: 120, listAmount: 140 }),
      "$140.00 → $120.00",
    );
  });

  it("hides the original price when the charged amount is unchanged", () => {
    assert.equal(listedAmountIfChanged({ amount: 140, listAmount: 140 }), null);
    assert.equal(formatLineItemMoney({ amount: 140, listAmount: 140 }), "$140.00");
    assert.equal(listedAmountIfChanged({ amount: 140 }), null);
  });

  it("keeps listAmount when sanitizing edited checkout lines", () => {
    const sanitized = sanitizeLineItems([
      {
        id: "1",
        label: "The Atelier Full Groom",
        amount: 0,
        listAmount: 140,
        catalogId: "custom-full-haircut",
      },
    ]);
    assert.deepEqual(sanitized, [
      {
        id: "1",
        label: "The Atelier Full Groom",
        amount: 0,
        listAmount: 140,
        catalogId: "custom-full-haircut",
        referralCategory: "eligible_service",
      },
    ]);
  });

  it("backfills a catalog list price for older saved visit lines", () => {
    const filled = withCatalogListAmount(
      [
        {
          id: "1",
          label: "Custom Full Haircut & Styling",
          amount: 0,
          catalogId: "custom-full-haircut",
        },
      ],
      [{ id: "custom-full-haircut", name: "Custom Full Haircut", suggestedAmount: 140 }],
    );
    assert.equal(filled[0]?.listAmount, 140);
    assert.equal(listedAmountIfChanged(filled[0]!), 140);
  });

  it("prints the struck list price on receipt copy", () => {
    const appointment = {
      petName: "Maple",
      appointmentDate: "2026-09-16",
      appointmentTime: "10:00",
      timezone: "America/New_York",
      customerFirstName: "Alex",
    } as AdminAppointmentRecord;
    const charge = {
      kind: "service",
      lineItems: [
        {
          id: "1",
          label: "The Atelier Full Groom",
          amount: 0,
          listAmount: 140,
          catalogId: "custom-full-haircut",
        },
      ],
      tipAmount: 0,
      total: 0,
      refundedAmount: 0,
    } as AppointmentChargeRecord;

    assert.equal(
      buildChargeReceiptParagraphs(appointment, charge).some((line) =>
        line.includes("$140.00 → $0.00"),
      ),
      true,
    );
    assert.match(buildChargeReceiptCardText(appointment, charge), /\$140\.00 → \$0\.00/);
    assert.match(
      buildChargeReceiptCardHtml(appointment, charge),
      /text-decoration:line-through[\s\S]*\$140\.00[\s\S]*\$0\.00/,
    );
  });

  it("does not treat hourly services as a fixed list price", () => {
    assert.equal(listAmountForCatalog("hand-stripping", 160), undefined);
    const patch = catalogLinePatch({
      id: "hand-stripping",
      name: "Hand Stripping",
      suggestedAmount: 160,
    });
    assert.equal(patch.listAmount, undefined);
    assert.equal(patch.amount, 160);
  });
});
