const UNIT_SUFFIX =
  /(?:,|\s)\s*(?:apartment|apt|unit|suite|ste|#)\b.*$/i;

/** House number at the start, including 123A and 12-14. Not 15th or 1st. */
const LEADING_HOUSE_NUMBER =
  /^\d+(?:[A-Za-z]|-[A-Za-z]|\s*-\s*\d+[A-Za-z]?)?\s+/;

const TRAILING_HOUSE_NUMBER = /\s+\d+[A-Za-z]?$/;

/**
 * Street name for a confirmation text. Drops the house number and any
 * apartment or suite. City, state, and ZIP are never part of this field.
 */
export function streetNameForSms(street: string | null | undefined) {
  let text = (street ?? "").replace(/\s+/g, " ").trim();
  text = text.replace(UNIT_SUFFIX, "").replace(/,\s*$/, "").trim();
  text = text.replace(LEADING_HOUSE_NUMBER, "").trim();
  text = text.replace(TRAILING_HOUSE_NUMBER, "").trim();
  if (/^\d+[A-Za-z]?$/.test(text)) return "";
  return text;
}
