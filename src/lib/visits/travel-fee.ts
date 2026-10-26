/** null means automatic; zero is an intentional waiver. */
export function parseTravelFeeOverride(value: unknown): number | null {
  if (value == null) return null;
  if (
    typeof value !== "number" || !Number.isFinite(value) ||
    value < 0 || value > 5000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001
  ) throw new Error("Enter a travel fee from $0 to $5,000 with at most two decimal places.");
  return value;
}

export function effectiveTravelFee(automatic: number, override: number | null | undefined) {
  return override ?? automatic;
}

export function visitTravelLinesMatch(items: { catalogId?: string; amount: number; referralCategory?: string }[], fee: number) {
  const travel = items.filter((item) => item.catalogId === "travel-fee" || item.referralCategory === "travel_fee");
  return travel.length <= 1 && (travel[0]?.amount ?? 0) === fee;
}

/** Dog service edits cannot add a second visit fee or erase a waiver. */
export function withTravelFee<T extends { catalogId?: string; amount: number; id: string; label: string }>(items: T[], amount: number) {
  const services = items.filter((item) => item.catalogId !== "travel-fee");
  return amount > 0
    ? [...services, { id: "visit-travel-fee", label: "Travel fee", catalogId: "travel-fee", amount } as T]
    : services;
}
