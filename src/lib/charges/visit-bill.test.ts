import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPreviewCollectContext } from "@/lib/charges/preview";
import { buildChargeReceiptParagraphs } from "@/lib/charges/receipt-content";
import { buildChargeReceiptCardText } from "@/lib/charges/receipt-email";
import { formatVisitBillDate } from "@/lib/charges/receipt-view";
import type { AppointmentChargeRecord } from "@/lib/charges/types";
import { quoteReferralApplication } from "@/lib/referrals/eligible";
import {
  appointmentIdsCoveredByServiceCharges,
  buildVisitBill,
  chargedVisitSnapshot,
  decideVisitServiceCharge,
  isFullyRefundedPayment,
  serviceChargeHasVisitBill,
  visitBillTotal,
  visitPaymentStatus,
  type VisitCheckoutPet,
} from "@/lib/charges/visit-bill";

function pet(overrides: Partial<VisitCheckoutPet> & Pick<VisitCheckoutPet, "appointmentId" | "petName" | "serviceName" | "servicePrice">): VisitCheckoutPet {
  return {
    status: "confirmed",
    serviceEndedAt: "2026-11-23T20:00:00.000Z",
    ...overrides,
  };
}

const visit = {
  visitId: "visit-sarah",
  customerName: "Sarah",
  serviceDate: "2026-11-23",
  arrivalLabel: "3:30 PM",
};

describe("visit checkout bill", () => {
  it("builds one bill for a single dog and omits a zero travel fee", () => {
    const bill = buildVisitBill({
      ...visit,
      travelFee: 0,
      pets: [
        pet({
          appointmentId: "daisy",
          petName: "Daisy",
          serviceName: "Full Groom",
          servicePrice: 150,
        }),
      ],
    });
    assert.equal(bill.blocked, false);
    assert.equal(bill.subtotal, 150);
    assert.equal(bill.lineItems.length, 1);
    assert.equal(bill.lineItems[0]?.label, "Daisy — Full Groom");
    assert.equal(bill.lineItems[0]?.amount, 150);
    assert.equal(bill.lineItems[0]?.appointmentId, "daisy");
    assert.equal(bill.travelFee, 0);
    assert.equal(bill.lineItems.some((item) => item.catalogId === "travel-fee"), false);
    assert.equal(visitBillTotal({ subtotal: bill.subtotal, tip: 0 }), 150);
  });

  it("sums three dogs and reads travel once from the visit", () => {
    const bill = buildVisitBill({
      ...visit,
      travelFee: 65,
      pets: [
        pet({
          appointmentId: "daisy",
          petName: "Daisy",
          serviceName: "Full Groom",
          servicePrice: 150,
        }),
        pet({
          appointmentId: "milo",
          petName: "Milo",
          serviceName: "Full Groom",
          servicePrice: 170,
        }),
        pet({
          appointmentId: "coco",
          petName: "Coco",
          serviceName: "Bath & Coat Care",
          servicePrice: 120,
        }),
      ],
    });
    assert.equal(bill.subtotal, 505);
    assert.equal(bill.servicedDogCount, 3);
    assert.deepEqual(
      bill.lineItems.map((item) => item.amount),
      [150, 170, 120, 65],
    );
    assert.equal(
      bill.lineItems.filter((item) => item.catalogId === "travel-fee").length,
      1,
    );
    assert.equal(bill.lineItems.find((item) => item.catalogId === "travel-fee")?.appointmentId, undefined);
    assert.equal(formatVisitBillDate(bill.serviceDate), "Nov 23");
  });

  it("leaves a cancelled dog off the service bill and still charges travel once", () => {
    const bill = buildVisitBill({
      ...visit,
      travelFee: 65,
      pets: [
        pet({
          appointmentId: "daisy",
          petName: "Daisy",
          serviceName: "Full Groom",
          servicePrice: 150,
        }),
        pet({
          appointmentId: "milo",
          petName: "Milo",
          serviceName: "Full Groom",
          servicePrice: 170,
        }),
        pet({
          appointmentId: "coco",
          petName: "Coco",
          serviceName: "Bath & Coat Care",
          servicePrice: 120,
          status: "cancelled",
          serviceEndedAt: null,
        }),
      ],
    });
    assert.equal(bill.blocked, false);
    assert.equal(bill.cancelledPets.length, 1);
    assert.equal(bill.subtotal, 385);
    assert.deepEqual(
      bill.lineItems.map((item) => item.petName ?? item.label),
      ["Daisy", "Milo", "Travel fee"],
    );
    assert.equal(bill.lineItems.some((item) => item.label.includes("Coco")), false);
  });

  it("blocks the whole visit when a dog has not finished, instead of dropping that dog", () => {
    const bill = buildVisitBill({
      ...visit,
      travelFee: 65,
      pets: [
        pet({
          appointmentId: "daisy",
          petName: "Daisy",
          serviceName: "Full Groom",
          servicePrice: 150,
        }),
        pet({
          appointmentId: "milo",
          petName: "Milo",
          serviceName: "Full Groom",
          servicePrice: 170,
          serviceEndedAt: null,
        }),
      ],
    });
    assert.equal(bill.blocked, true);
    assert.match(bill.blockedMessage ?? "", /Milo/);
    assert.equal(bill.incompletePets.map((item) => item.petName).join(", "), "Milo");
    assert.equal(bill.eligiblePets.length, 1);
    assert.equal(bill.lineItems.some((item) => item.petName === "Milo"), false);
  });

  it("applies one visit tip and one visit discount", () => {
    const bill = buildVisitBill({
      ...visit,
      travelFee: 65,
      pets: [
        pet({
          appointmentId: "daisy",
          petName: "Daisy",
          serviceName: "Full Groom",
          servicePrice: 150,
        }),
        pet({
          appointmentId: "milo",
          petName: "Milo",
          serviceName: "Full Groom",
          servicePrice: 170,
        }),
        pet({
          appointmentId: "coco",
          petName: "Coco",
          serviceName: "Bath & Coat Care",
          servicePrice: 120,
        }),
      ],
    });
    const quote = quoteReferralApplication({
      lineItems: bill.lineItems,
      tipAmount: 0,
      availableCreditCents: 2000,
      mode: "full",
      applyNewClientDiscount: false,
    });
    assert.equal(quote.creditCents, 2000);
    assert.equal(quote.dueCents, 48500);
    assert.equal(
      visitBillTotal({
        subtotal: bill.subtotal,
        discount: 20,
        tip: 40,
      }),
      525,
    );
  });

  it("keeps one service charge per visit and leaves a historical charge in place", () => {
    assert.equal(
      decideVisitServiceCharge([
        { status: "pending", hasSnapshot: true, appointmentId: "daisy" },
      ]),
      "in_progress",
    );
    assert.equal(
      decideVisitServiceCharge([
        { status: "paid", hasSnapshot: true, appointmentId: "daisy" },
      ]),
      "already_paid",
    );
    assert.equal(
      decideVisitServiceCharge([
        { status: "paid", hasSnapshot: false, appointmentId: "daisy" },
      ]),
      "legacy_paid",
    );
    assert.equal(
      decideVisitServiceCharge([
        { status: "failed", hasSnapshot: true, appointmentId: "daisy" },
      ]),
      "create",
    );
    assert.equal(
      decideVisitServiceCharge([
        {
          status: "paid",
          hasSnapshot: false,
          appointmentId: "daisy",
          fullyRefunded: true,
        },
      ]),
      "create",
    );
    assert.equal(
      decideVisitServiceCharge([
        {
          status: "paid",
          hasSnapshot: true,
          appointmentId: "daisy",
          fullyRefunded: true,
        },
      ]),
      "create",
    );
    assert.equal(isFullyRefundedPayment(150, 150), true);
    assert.equal(isFullyRefundedPayment(150, 20), false);
    assert.equal(isFullyRefundedPayment(0, 0), false);
    assert.equal(
      serviceChargeHasVisitBill({
        kind: "service",
        visitId: "visit-sarah",
        hasSnapshot: true,
      }),
      true,
    );
    assert.equal(
      serviceChargeHasVisitBill({
        kind: "service",
        visitId: null,
        hasSnapshot: false,
      }),
      false,
    );
    assert.equal(
      serviceChargeHasVisitBill({
        kind: "service",
        visitId: "visit-sarah",
        hasSnapshot: false,
      }),
      false,
    );
    assert.equal(
      serviceChargeHasVisitBill({
        kind: "cancellation",
        visitId: null,
        hasSnapshot: false,
      }),
      true,
    );
    assert.equal(
      serviceChargeHasVisitBill({
        kind: "no_show",
        visitId: null,
        hasSnapshot: false,
      }),
      true,
    );
    assert.equal(
      visitPaymentStatus([
        { status: "paid", hasSnapshot: true, appointmentId: "daisy" },
      ]),
      "paid",
    );
    assert.equal(
      visitPaymentStatus([
        { status: "pending", hasSnapshot: true, appointmentId: "daisy" },
      ]),
      "pending",
    );
    assert.equal(
      visitPaymentStatus([
        { status: "failed", hasSnapshot: true, appointmentId: "daisy" },
      ]),
      "failed",
    );
    assert.equal(visitPaymentStatus([]), "unpaid");

    const legacy = appointmentIdsCoveredByServiceCharges({
      appointmentIdsByVisitId: { "visit-sarah": ["daisy", "milo", "coco"] },
      charges: [{ appointmentId: "daisy", visitId: null }],
    });
    assert.equal(legacy.has("daisy"), true);
    assert.equal(legacy.has("milo"), false);

    const current = appointmentIdsCoveredByServiceCharges({
      appointmentIdsByVisitId: { "visit-sarah": ["daisy", "milo", "coco"] },
      charges: [
        {
          appointmentId: "daisy",
          visitId: "visit-sarah",
          lineItems: [{ appointmentId: "daisy" }, { appointmentId: "milo" }, { appointmentId: "coco" }],
        },
      ],
    });
    assert.equal(current.has("daisy"), true);
    assert.equal(current.has("milo"), true);
    assert.equal(current.has("coco"), true);
  });

  it("freezes the paid bill so a later catalog price does not change the receipt", () => {
    const booked = buildVisitBill({
      ...visit,
      travelFee: 65,
      pets: [
        pet({
          appointmentId: "daisy",
          petName: "Daisy",
          serviceName: "Full Groom",
          servicePrice: 150,
        }),
        pet({
          appointmentId: "milo",
          petName: "Milo",
          serviceName: "Full Groom",
          servicePrice: 170,
        }),
        pet({
          appointmentId: "coco",
          petName: "Coco",
          serviceName: "Bath & Coat Care",
          servicePrice: 120,
        }),
      ],
    });
    const snapshot = chargedVisitSnapshot({
      bill: booked,
      lineItems: booked.lineItems,
      discount: 0,
      tip: 25,
      total: 530,
      paymentMethodLabel: "Visa ending in 4242",
    });
    const raised = buildVisitBill({
      ...visit,
      travelFee: 80,
      pets: booked.eligiblePets.map((item) => ({
        ...item,
        servicePrice: 999,
      })),
    });
    assert.equal(raised.subtotal, 3077);
    assert.equal(snapshot.subtotal, 505);
    assert.equal(snapshot.travelFee, 65);
    assert.equal(snapshot.total, 530);
    assert.deepEqual(
      snapshot.pets.map((item) => item.amount),
      [150, 170, 120],
    );
    assert.equal(snapshot.pets[0]?.serviceName, "Full Groom");

    const appointment = {
      ...buildPreviewCollectContext().appointment,
      petName: "Daisy",
      serviceName: "Catalog price 999",
      appointmentDate: "2026-12-01",
      appointmentTime: "9:00 AM",
    };
    const charge: AppointmentChargeRecord = {
      id: "chg-visit",
      appointmentId: "daisy",
      visitId: "visit-sarah",
      kind: "service",
      status: "paid",
      lineItems: [],
      subtotal: snapshot.subtotal,
      tipAmount: 25,
      total: snapshot.total,
      receiptChannel: null,
      paidAt: "2026-11-23T21:00:00.000Z",
      refundedAmount: 0,
      tender: "card",
      billSnapshot: snapshot,
    };
    const paragraphs = buildChargeReceiptParagraphs(appointment, charge);
    const text = paragraphs.join("\n");
    assert.match(text, /Daisy — Full Groom/);
    assert.match(text, /Milo — Full Groom/);
    assert.match(text, /Coco — Bath & Coat Care/);
    assert.match(text, /Travel fee/);
    assert.match(text, /\$65\.00/);
    assert.match(text, /\$150\.00/);
    assert.match(text, /Subtotal\s+\$505\.00/);
    assert.match(text, /Tip\s+\$25\.00/);
    assert.match(text, /Total paid\s+\$530\.00/);
    assert.match(text, /Visa ending in 4242/);
    assert.equal(text.includes("999"), false);
    assert.equal(text.includes("Catalog price"), false);
    assert.equal(paragraphs.filter((line) => line.startsWith("Travel fee")).length, 1);
    const emailText = buildChargeReceiptCardText(appointment, charge);
    assert.match(emailText, /\$505\.00/);
    assert.equal(emailText.includes("999"), false);
  });
});
