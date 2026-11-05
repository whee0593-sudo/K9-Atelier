import assert from "node:assert/strict";
import { it } from "node:test";
import type { AppointmentRecord } from "../appointments/types";
import { buildCustomerAddDogEmail } from "./html-templates";
function appointment(patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    id: "apt-1",
    customerId: "cust-1",
    petId: "pet-1",
    petName: "Maple",
    petBreed: "Cavapoo",
    serviceId: "signature-bath-care",
    serviceName: "Signature Bath & Care",
    addOnIds: [],
    addOnOptions: {},
    addressStreet: "123 Example Avenue",
    addressCity: "Palm Beach Gardens",
    addressState: "FL",
    addressZip: "33418",
    travelDistanceMiles: 8,
    travelFee: 0,
    appointmentDate: "2026-08-24",
    appointmentTime: "10:00–12:00 PM",
    scheduledStart: null,
    timePreference: "morning",
    timezone: "America/New_York",
    estimatedTotal: 140,
    newClientDeposit: null,
    vaccinationStatusAtBooking: null,
    status: "cancelled",
    confirmedAt: null,
    customerConfirmedAt: null,
    createdAt: "2026-08-20T14:00:00.000Z",
    ...patch,
  };
}

it("shows coloring and its selected option, preserves total, and puts review copy before details", () => {
 const email = buildCustomerAddDogEmail({appointment: appointment({addOnIds: ["creative-accent-coloring"], addOnOptions: {"creative-accent-coloring": "Temporary Fun"}}), customer: {email:"test@example.com", name:"Penny"}});
 for (const body of [email.text, email.html]) {
  assert.ok(body.includes("Creative Accent Coloring (Temporary Fun)"));
  assert.ok(body.includes("$140"));
  assert.equal(body.split("once the change has been confirmed.").length,2);
  assert.ok(body.indexOf("once the change has been confirmed.") < body.indexOf("Signature Bath"));
 }
});
it("handles a primary service without add-ons", () => {
 const email = buildCustomerAddDogEmail({appointment: appointment(),customer:{email:"test@example.com"}});
 assert.match(email.text,/Service: Signature Bath & Care\n/);
 assert.ok(!email.text.includes("Creative Accent Coloring"));
});
