import assert from "node:assert/strict";
import { it } from "node:test";
import { operationalVisits } from "./operations";
import { buildPreviewOnTheWayAppointments } from "@/lib/appointments/calendar-preview";

const first = { ...buildPreviewOnTheWayAppointments()[0]!, id: "a", visitId: "visit-a", petName: "Valentino" };
it("groups explicit visits while preserving every dog and independent household visits", () => {
  const groups = operationalVisits([first, { ...first, id: "b", petName: "Stella" },
    { ...first, id: "c", visitId: "visit-b" }, { ...first, id: "d", visitId: null }]);
  assert.equal(groups.length, 3);
  assert.deepEqual(groups[0].pets.map(p => p.petName), ["Valentino", "Stella"]);
});
it("excludes cancelled dogs and reflects visit-level lifecycle and sent notices", () => {
  const [group] = operationalVisits([{ ...first, visitStartedAt: "2026-10-28T12:00:00Z", visitEndedAt: "2026-10-28T14:00:00Z" },
    { ...first, id: "b", enRouteSmsSentAt: "sent" }, { ...first, id: "c", status: "cancelled" }]);
  assert.equal(group.pets.length, 2);
  assert.equal(group.appointment.enRouteSmsSentAt, "sent");
  assert.equal(group.appointment.serviceEndedAt, "2026-10-28T14:00:00Z");
});
it("legacy completion waits for all active dogs", () => {
  const [group] = operationalVisits([{ ...first, serviceEndedAt: "2026-10-28T14:00:00Z" }, { ...first, id: "b", serviceEndedAt: null }]);
  assert.equal(group.appointment.serviceEndedAt, null);
});

it("keeps the care page in progress when only the selected dog has finished", async () => {
  const { carePageTiming } = await import("./operations");
  const appointment = {serviceStartedAt:"2026-10-28T14:00:00Z", serviceEndedAt:"2026-10-28T15:00:00Z"};
  assert.deepEqual(carePageTiming({appointment, visit:{startedAt:"2026-10-28T13:55:00Z", endedAt:null}}),
    {startedAt:"2026-10-28T13:55:00Z", endedAt:null});
  assert.deepEqual(carePageTiming({appointment}), {startedAt:appointment.serviceStartedAt, endedAt:appointment.serviceEndedAt});
});
