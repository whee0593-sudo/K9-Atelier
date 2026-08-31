const STREET_WORDS: Record<string, string> = {
  street: "st",
  str: "st",
  avenue: "ave",
  av: "ave",
  boulevard: "blvd",
  drive: "dr",
  road: "rd",
  lane: "ln",
  court: "ct",
  place: "pl",
  terrace: "ter",
  circle: "cir",
  highway: "hwy",
  parkway: "pkwy",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
};

const UNIT_LABEL =
  "(?:apt|apartment|unit|ste|suite|fl|floor|#)";

const UNIT_PATTERN = new RegExp(
  `\\b${UNIT_LABEL}\\b\\s*[-.]?\\s*([a-z0-9-]+)`,
  "i",
);

const TRAILING_UNIT_PATTERN = new RegExp(
  `[,\\s]+${UNIT_LABEL}\\b\\s*[-.]?\\s*[a-z0-9-]+\\s*$`,
  "i",
);

export type NormalizedServiceAddress = {
  normalizedStreetAddress: string;
  normalizedUnit: string;
  normalizedCity: string;
  normalizedState: string;
  normalizedZip5: string;
};

export function normalizeZip(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.slice(0, 5);
}

export function normalizeCity(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeState(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z]/g, "");
}

function normalizeStreetLine(value: string) {
  const parts = value
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => STREET_WORDS[word] ?? word);
  return parts.join(" ");
}

export function extractNormalizedUnit(value: string | null | undefined) {
  const text = String(value ?? "");
  const labeled = text.match(UNIT_PATTERN);
  if (labeled?.[1]) return labeled[1].trim().toLowerCase();
  const hashed = text.match(/#\s*([a-z0-9-]+)/i);
  return (hashed?.[1] ?? "").trim().toLowerCase();
}

export function normalizeStreetAddress(value: string | null | undefined) {
  let text = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ");
  text = text.replace(TRAILING_UNIT_PATTERN, "").trim();
  text = text.replace(/#\s*[a-z0-9-]+$/i, "").trim();
  return normalizeStreetLine(text);
}

export function normalizeServiceAddress(input: {
  street?: string | null;
  unit?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}): NormalizedServiceAddress {
  const streetSource = [input.street, input.unit].filter(Boolean).join(" ");
  return {
    normalizedStreetAddress: normalizeStreetAddress(streetSource),
    normalizedUnit:
      extractNormalizedUnit(input.unit) ||
      extractNormalizedUnit(input.street) ||
      String(input.unit ?? "").trim().toLowerCase(),
    normalizedCity: normalizeCity(input.city),
    normalizedState: normalizeState(input.state),
    normalizedZip5: normalizeZip(input.zip),
  };
}

export function householdVisitKey(input: {
  customerId: string;
  appointmentDate: string;
  addressStreet: string;
  addressZip: string;
  addressUnit?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
}) {
  const address = normalizeServiceAddress({
    street: input.addressStreet,
    unit: input.addressUnit,
    city: input.addressCity,
    state: input.addressState,
    zip: input.addressZip,
  });
  return [
    input.customerId,
    input.appointmentDate,
    address.normalizedStreetAddress,
    address.normalizedUnit,
    address.normalizedZip5,
  ].join("|");
}

export type AddressCompare = "same" | "different" | "review";

export function compareServiceAddresses(
  left: {
    street?: string | null;
    unit?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  },
  right: {
    street?: string | null;
    unit?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  },
): AddressCompare {
  const a = normalizeServiceAddress(left);
  const b = normalizeServiceAddress(right);
  if (!a.normalizedStreetAddress || !b.normalizedStreetAddress) return "different";
  if (!a.normalizedZip5 || a.normalizedZip5 !== b.normalizedZip5) return "different";
  if (a.normalizedStreetAddress !== b.normalizedStreetAddress) return "different";
  if (a.normalizedCity && b.normalizedCity && a.normalizedCity !== b.normalizedCity) {
    return "different";
  }
  if (a.normalizedState && b.normalizedState && a.normalizedState !== b.normalizedState) {
    return "different";
  }
  if (a.normalizedUnit && b.normalizedUnit) {
    return a.normalizedUnit === b.normalizedUnit ? "same" : "different";
  }
  if (a.normalizedUnit || b.normalizedUnit) return "review";
  return "review";
}

export function addressesLookSame(
  left: {
    street?: string | null;
    unit?: string | null;
    zip?: string | null;
    city?: string | null;
    state?: string | null;
  },
  right: {
    street?: string | null;
    unit?: string | null;
    zip?: string | null;
    city?: string | null;
    state?: string | null;
  },
) {
  return compareServiceAddresses(left, right) === "same";
}
