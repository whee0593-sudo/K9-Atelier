import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { handleAppointmentRouteError } from "@/lib/appointments/errors";
import { requireBookingPolicyConsent } from "@/lib/appointments/validation";

describe("required customer booking policy agreement", () => {
  for (const name of ["single", "group"]) {
    for (const consent of [undefined, false, null, "true", 1]) {
      it(`${name} rejects ${String(consent)} before booking side effects`, async () => {
        let response: Response | undefined;
        try { requireBookingPolicyConsent({ servicePoliciesConsent: consent }); }
        catch (error) { response = handleAppointmentRouteError(error); }
        assert.ok(response);
        assert.equal(response.status, 400);
        assert.deepEqual(await response.json(), {
          error: "Please agree to the Service Policies and Fees to continue.",
          field: "servicePoliciesConsent",
        });
      });
    }
  }
  it("checks both customer endpoints before booking creation", () => {
    for (const path of ["src/app/api/appointments/route.ts", "src/app/api/booking/group/route.ts"]) {
      const source = readFileSync(path, "utf8");
      const check = source.indexOf("requireBookingPolicyConsent(body)");
      assert.ok(check > 0);
      assert.ok(check < source.indexOf("const result = await create"));
    }
  });
  it("accepts only explicit boolean agreement", () => {
    assert.doesNotThrow(() => requireBookingPolicyConsent({ servicePoliciesConsent: true }));
  });
});
