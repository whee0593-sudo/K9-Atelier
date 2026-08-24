import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppointmentRecord } from "../appointments/types";
import {
  buildCustomerRemoveDogConfirmationEmail,
  buildRemoveDogEmailContent,
  manageAppointmentUrl,
  remainingPetsCopy,
} from "./remove-dog-confirmation";

function appointment(patch: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    id: "apt-maple",
    customerId: "cust-1",
    petId: "pet-maple",
    petName: "Maple",
    petBreed: "Cavapoo",
    serviceId: "signature-bath-care",
    serviceName: "Signature Bath & Care",
    addOnIds: [],
    addOnOptions: {},
    addressStreet: "1408 14th Lane",
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

const alex = {
  email: "alex@example.com",
  name: "Alex Rivera",
  firstName: "Alex",
};

const otto = appointment({
  id: "apt-otto",
  petId: "pet-otto",
  petName: "Otto",
  petBreed: "Schnauzer",
  serviceId: "hand-stripping-specialty",
  serviceName: "Hand Stripping Specialty",
  estimatedTotal: 225,
});

const daisy = appointment({
  id: "apt-daisy",
  petId: "pet-daisy",
  petName: "Daisy",
  estimatedTotal: 140,
});

describe("remove a dog confirmation copy", () => {
  it("uses the removed pet in the subject with K9 ATELIER", () => {
    const content = buildRemoveDogEmailContent({
      appointment: appointment(),
      customer: alex,
      remainingAppointments: [otto],
      fee: 0,
    });
    assert.equal(
      content.subject,
      "Maple Has Been Removed from Your K9 ATELIER Appointment",
    );
    assert.doesNotMatch(content.subject, /K9 Atelier/);
  });

  it("writes remaining-pet grammar for one, two, and three pets", () => {
    assert.equal(
      remainingPetsCopy(["Otto"], false),
      "Otto’s appointment remains confirmed with no other changes.",
    );
    assert.equal(
      remainingPetsCopy(["Otto", "Daisy"], false),
      "Otto and Daisy’s appointments remain confirmed with no other changes.",
    );
    assert.equal(
      remainingPetsCopy(["Otto", "Daisy", "Willow"], false),
      "Otto, Daisy, and Willow’s appointments remain confirmed with no other changes.",
    );
  });

  it("links Manage Appointment to the remaining visit, not the homepage", () => {
    assert.match(
      manageAppointmentUrl("apt-otto"),
      /\/account\/appointments\/apt-otto$/,
    );
    assert.match(manageAppointmentUrl(null), /\/account\/appointments$/);
    assert.doesNotMatch(manageAppointmentUrl("apt-otto"), /k9atelier.com\/$/);
  });

  it("binds first name, removed pet, date, and remaining pet", () => {
    const content = buildRemoveDogEmailContent({
      appointment: appointment(),
      customer: alex,
      remainingAppointments: [otto],
      fee: 70,
      feeStatus: "paid",
      cardBrand: "visa",
      cardLast4: "4242",
    });
    assert.match(content.text, /^Dear Alex,/);
    assert.match(
      content.text,
      /Maple has been removed from your appointment on Monday, August 24, 2026/,
    );
    assert.match(
      content.text,
      /Otto’s appointment remains confirmed with no other changes/,
    );
    assert.doesNotMatch(content.text, /We've removed/);
    assert.doesNotMatch(content.text, /policy fee/i);
    assert.match(content.text, /cancellation fee of \$70\.00 has been charged/);
    assert.match(content.text, /Visa ending in 4242/);
    assert.match(content.manageUrl, /\/account\/appointments\/apt-otto$/);
  });

  it("hides a charged sentence when there is no fee", () => {
    const email = buildCustomerRemoveDogConfirmationEmail({
      appointment: appointment(),
      customer: alex,
      remainingAppointments: [otto],
      fee: 0,
    });
    assert.match(email.html, /No cancellation fee was applied/);
    assert.doesNotMatch(email.html, /\$0\.00/);
    assert.doesNotMatch(email.html, /has been charged/);
  });

  it("uses processing and failed copy instead of has been charged", () => {
    const processing = buildRemoveDogEmailContent({
      appointment: appointment(),
      customer: alex,
      remainingAppointments: [otto],
      fee: 70,
      feeStatus: "processing",
    });
    const failed = buildRemoveDogEmailContent({
      appointment: appointment(),
      customer: alex,
      remainingAppointments: [otto],
      fee: 70,
      feeStatus: "failed",
    });
    assert.match(processing.text, /is currently being processed/);
    assert.doesNotMatch(processing.text, /has been charged/);
    assert.match(failed.text, /could not be charged/);
    assert.doesNotMatch(failed.text, /has been charged/);
  });

  it("shows revised remaining details only when the leftover visit changed", () => {
    const unchanged = buildRemoveDogEmailContent({
      appointment: appointment(),
      customer: alex,
      remainingAppointments: [otto],
      remainingUpdated: false,
    });
    const updated = buildRemoveDogEmailContent({
      appointment: appointment(),
      customer: alex,
      remainingAppointments: [
        {
          ...otto,
          appointmentTime: "1:00–3:00 PM",
          estimatedTotal: 210,
        },
      ],
      remainingUpdated: true,
    });
    assert.match(unchanged.text, /with no other changes/);
    assert.doesNotMatch(unchanged.text, /Please review the revised details/);
    assert.match(
      updated.text,
      /Your remaining appointment has been updated. Please review the revised details below/,
    );
    assert.doesNotMatch(updated.text, /with no other changes/);
    assert.match(updated.text, /1:00 PM–3:00 PM/);
    assert.match(updated.text, /Hand Stripping Specialty/);
    assert.match(updated.text, /\$210\.00/);
  });

  it("keeps long names readable and uses Title Case on the button", () => {
    const email = buildCustomerRemoveDogConfirmationEmail({
      appointment: appointment({
        petName: "Bartholomew Maximilian-Whitfield",
      }),
      customer: {
        email: "guest@example.com",
        name: "Anastasia Montgomery-Whitfield",
        firstName: "Anastasia Montgomery-Whitfield",
      },
      remainingAppointments: [
        { ...otto, petName: "Lady Clementine-Rose" },
      ],
      fee: 0,
    });
    assert.match(email.html, /Dear Anastasia Montgomery-Whitfield,/);
    assert.match(email.html, /Bartholomew Maximilian-Whitfield has been removed/);
    assert.match(email.html, /Manage Appointment/);
    assert.doesNotMatch(email.html, /MANAGE APPOINTMENT/);
    assert.doesNotMatch(email.html, /penny@k9atelier.com/);
    assert.match(email.html, /K9 ATELIER/);
  });

  it("mentions three remaining pets after one is removed", () => {
    const content = buildRemoveDogEmailContent({
      appointment: appointment(),
      customer: alex,
      remainingAppointments: [otto, daisy, { ...daisy, id: "apt-willow", petName: "Willow" }],
      fee: 0,
    });
    assert.match(
      content.text,
      /Otto, Daisy, and Willow’s appointments remain confirmed with no other changes/,
    );
  });
});
