import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOperationalAdminAppointment } from "@/lib/appointments/operational-visibility";

describe("operational admin appointment visibility", () => {
  it("keeps pending and confirmed appointments in day operations", () => {
    assert.equal(isOperationalAdminAppointment("pending_confirmation"), true);
    assert.equal(isOperationalAdminAppointment("confirmed"), true);
  });

  it("hides cancelled appointments from day operations", () => {
    assert.equal(isOperationalAdminAppointment("cancelled"), false);
  });
});
