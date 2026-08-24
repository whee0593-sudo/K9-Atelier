import type { FinanceChargeRow } from "@/lib/finance/report";

function charge(
  patch: Omit<FinanceChargeRow, "taxAmount"> & { taxAmount?: number },
): FinanceChargeRow {
  return { taxAmount: 0, ...patch };
}

export const PREVIEW_FINANCE_DATE = "2026-07-17";

export function buildPreviewFinanceCharges(): FinanceChargeRow[] {
  return [
    charge({
      id: "fin-daisy",
      kind: "service",
      paidDate: "2026-07-08",
      lineItems: [
        { id: "1", label: "Signature Bath & Care", amount: 140, catalogId: "signature-bath-care" },
      ],
      subtotal: 140,
      tipAmount: 25.2,
      total: 165.2,
      refundedAmount: 0,
    }),
    charge({
      id: "fin-scout",
      kind: "service",
      paidDate: "2026-07-08",
      lineItems: [
        {
          id: "1",
          label: "Hand Stripping Specialty",
          amount: 225,
          catalogId: "hand-stripping",
        },
      ],
      subtotal: 225,
      tipAmount: 40.5,
      total: 265.5,
      refundedAmount: 0,
    }),
    charge({
      id: "fin-pepper",
      kind: "service",
      paidDate: "2026-07-14",
      lineItems: [
        { id: "1", label: "Show Care for Long Coats", amount: 140, catalogId: "long-coat-show-care" },
      ],
      subtotal: 140,
      tipAmount: 25.2,
      total: 165.2,
      refundedAmount: 0,
    }),
    charge({
      id: "fin-milo",
      kind: "service",
      paidDate: "2026-07-14",
      lineItems: [
        { id: "1", label: "Signature Bath & Care", amount: 140, catalogId: "signature-bath-care" },
        { id: "2", label: "Travel fee", amount: 13, catalogId: "travel-fee" },
      ],
      subtotal: 153,
      tipAmount: 27.54,
      total: 180.54,
      refundedAmount: 0,
    }),
    charge({
      id: "fin-cleo",
      kind: "service",
      paidDate: "2026-07-14",
      lineItems: [
        {
          id: "1",
          label: "Creative Accent Coloring",
          amount: 165,
          catalogId: "creative-accent-coloring",
        },
      ],
      subtotal: 165,
      tipAmount: 29.7,
      total: 194.7,
      refundedAmount: 40,
    }),
    charge({
      id: "fin-hugo",
      kind: "service",
      paidDate: "2026-07-17",
      lineItems: [
        { id: "1", label: "Signature Bath & Care", amount: 140, catalogId: "signature-bath-care" },
      ],
      subtotal: 140,
      tipAmount: 25.2,
      total: 165.2,
      refundedAmount: 0,
    }),
    charge({
      id: "fin-nala",
      kind: "service",
      paidDate: "2026-07-23",
      lineItems: [
        { id: "1", label: "Signature Bath & Care", amount: 140, catalogId: "signature-bath-care" },
      ],
      subtotal: 140,
      tipAmount: 21,
      total: 161,
      refundedAmount: 0,
    }),
    charge({
      id: "fin-gus",
      kind: "service",
      paidDate: "2026-07-23",
      lineItems: [
        { id: "1", label: "Show Care for Long Coats", amount: 140, catalogId: "long-coat-show-care" },
      ],
      subtotal: 140,
      tipAmount: 25.2,
      total: 165.2,
      refundedAmount: 0,
    }),
    charge({
      id: "fin-pip",
      kind: "service",
      paidDate: "2026-07-23",
      lineItems: [
        { id: "1", label: "Signature Bath & Care", amount: 140, catalogId: "signature-bath-care" },
      ],
      subtotal: 140,
      tipAmount: 0,
      total: 140,
      refundedAmount: 0,
    }),
    charge({
      id: "fin-stella",
      kind: "service",
      paidDate: "2026-07-23",
      lineItems: [
        {
          id: "1",
          label: "Creative Accent Coloring",
          amount: 165,
          catalogId: "creative-accent-coloring",
        },
      ],
      subtotal: 165,
      tipAmount: 33,
      total: 198,
      refundedAmount: 0,
    }),
    charge({
      id: "fin-noshow",
      kind: "no_show",
      paidDate: "2026-07-10",
      lineItems: [{ id: "1", label: "No-show fee", amount: 140, catalogId: "no-show" }],
      subtotal: 140,
      tipAmount: 0,
      total: 140,
      refundedAmount: 0,
    }),
  ];
}
