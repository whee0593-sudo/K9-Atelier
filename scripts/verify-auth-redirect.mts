import assert from "node:assert/strict";
import { sanitizeAuthRedirect } from "../src/lib/auth-redirect.ts";

const cases: Array<[string | null | undefined, string]> = [
  ["https://evil.com", "/account"],
  ["//evil.com", "/account"],
  ["/book", "/book"],
  ["/account", "/account"],
  ["/account/pets", "/account/pets"],
  ["/account/profile", "/account/profile"],
  ["/account/bookings", "/account/bookings"],
  ["/account/evil", "/account"],
  ["/book/extra", "/account"],
  ["/login", "/account"],
  ["/account/pets?x=1", "/account"],
  ["/admin", "/admin"],
  ["/admin/vaccinations", "/admin/vaccinations"],
  ["/admin/evil", "/admin/evil"],
  ["/administrator", "/account"],
];

for (const [input, expected] of cases) {
  assert.equal(sanitizeAuthRedirect(input), expected, `input=${String(input)}`);
}

console.log("redirect-safety: PASS", cases.length, "cases");
