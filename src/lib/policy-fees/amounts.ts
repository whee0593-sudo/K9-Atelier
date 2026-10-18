/** Fixed dollar cap. A cap above the computed fee does not increase the charge or invent a waiver. */
export function roundPolicyMoney(amount: number) {
  return Math.round(amount * 100) / 100;
}

export function applyFixedCollectCap(
  computed: number,
  collectCap: number | null,
) {
  const base = roundPolicyMoney(computed);
  if (!Number.isFinite(base) || base < 0) {
    return { ok: false as const, reason: "invalid_computed" as const };
  }
  if (collectCap == null) {
    return {
      ok: true as const,
      computed: base,
      collectCap: null as number | null,
      charged: base,
      waiver: 0,
    };
  }
  const cap = roundPolicyMoney(collectCap);
  if (!Number.isFinite(cap) || cap < 0) {
    return { ok: false as const, reason: "invalid_cap" as const };
  }
  const charged = roundPolicyMoney(Math.min(base, cap));
  const waiver = roundPolicyMoney(base - charged);
  return {
    ok: true as const,
    computed: base,
    collectCap: cap,
    charged,
    waiver,
  };
}

export function formatFixedCapPreview(input: {
  computed: number;
  collectCap: number | null;
}) {
  const priced = applyFixedCollectCap(input.computed, input.collectCap);
  if (!priced.ok) return null;
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });
  return {
    ...priced,
    capKind: "fixed_amount" as const,
    heading: "Fixed dollar cap",
    note: "This sets the most that can be charged. It is not a percentage waiver.",
    computedLabel: money.format(priced.computed),
    capLabel: priced.collectCap == null ? "No cap" : money.format(priced.collectCap),
    chargedLabel: money.format(priced.charged),
    waiverLabel: money.format(priced.waiver),
  };
}
