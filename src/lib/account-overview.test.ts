import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { overviewAppointments } from "./account-overview";
import type { AppointmentRecord } from "./appointments/types";
import { validateProfilePatchInput } from "./profiles/validation";
import { buildAccountNavSummaries } from "./account-nav-summaries";

function appointment(id: string, date: string, options: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return { id, appointmentDate: date, status: "confirmed", scheduledStart: 600, ...options } as AppointmentRecord;
}
describe("account overview and editing", () => {
  const now = new Date("2026-10-30T16:00:00Z");
  it("prefers the soonest future visit, includes all its dogs, and skips cancelled bookings", () => {
    const appointments = [appointment("past", "2026-10-29"), appointment("later", "2026-11-02"),
      appointment("cancelled", "2026-10-31", {status:"cancelled"}),
      appointment("a", "2026-11-01", { visitId: "visit" }), appointment("b", "2026-11-01", { visitId: "visit" })];
    const result = overviewAppointments(appointments, now);
    assert.equal(result.upcoming, true);
    assert.deepEqual(result.appointments.map(a => a.id), ["a", "b"]);
  });
  it("uses New York time and falls back to the last visit when today's start has passed", () => {
    const result = overviewAppointments([appointment("a", "2026-10-29"), appointment("b", "2026-10-30")], now);
    assert.equal(result.upcoming, false);
    assert.equal(result.appointments[0].id, "b");
    assert.equal(overviewAppointments([], now).appointments.length, 0);
  });
  it("saves a single field on an otherwise incomplete profile and rejects invalid changes", () => {
    assert.deepEqual(validateProfilePatchInput({ firstName: " Jane " }), { firstName: "Jane" });
    assert.throws(() => validateProfilePatchInput({ firstName: "" }));
    assert.throws(() => validateProfilePatchInput({ phone: "invalid" }));
    assert.throws(() => validateProfilePatchInput({ email: "invalid" }));
    assert.deepEqual(validateProfilePatchInput({ email: "NEW@example.com" }), {email:"new@example.com"});
    assert.deepEqual(validateProfilePatchInput({ householdAllergyStatus: "yes", householdAllergyDetails: "Fragrance" }), {householdAllergyStatus:"yes",householdAllergyDetails:"Fragrance"});
    assert.throws(() => validateProfilePatchInput({ householdAllergyDetails: "Fragrance" }));
    assert.deepEqual(validateProfilePatchInput({ customerId: "another-user", role: "admin" }), {});
  });
  it("counts addresses added without a booking and leaves completed categories blank", () => {
    const result = buildAccountNavSummaries({ savedAddressCount: 1, appointments: [], pets: [], paymentMethodCount: 0 });
    assert.equal(result.addresses, null);
    assert.equal(result.payment, "incompleted");
    assert.equal(result.pets, "incompleted");
    assert.equal(result.overview, null);
  });
});
