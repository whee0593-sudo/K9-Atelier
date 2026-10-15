export type BookingIdempotencyState = {
  intent: string;
  key: string;
};

/**
 * One booking intent keeps one key across retries.
 * A new intent (different pet, service, add-ons, address, date, time, or card) gets a new key.
 */
export function nextIdempotencyKey(
  current: BookingIdempotencyState | null,
  intent: string,
  mint: () => string,
): BookingIdempotencyState {
  if (current && current.intent === intent && current.key) return current;
  return { intent, key: mint() };
}
