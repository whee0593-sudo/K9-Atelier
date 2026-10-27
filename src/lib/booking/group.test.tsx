import assert from "node:assert/strict";
import { describe, it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BookingCareOptionsStep } from "@/components/booking/BookingCareOptionsStep";
import { BookingDogStep } from "@/components/booking/BookingDogStep";
import {
  createDraftBookingPet,
  bookingDurationMinutes,
} from "@/lib/booking-flow";
import { getUpcomingBookableDates } from "@/lib/booking-slots";
import {
  validateGroupBookingInput,
  groupBookingIntentHash,
} from "@/lib/booking/group";
import {
  bookingDogsDuration,
  bookingDogsIntent,
  validateBookingDogs,
} from "@/lib/booking/dogs";
import { allBookableServices } from "@/lib/services";

(globalThis as { React?: typeof React }).React = React;
const service = allBookableServices().find(
  (item) => item.id === "signature-bath-care",
)!;
const pet = {
  ...createDraftBookingPet(),
  name: "Bella",
  breed: "Poodle",
  weightLbs: 12,
};
function request(count = 3) {
  return {
    address: {
      street: "100 Olive Ave",
      city: "West Palm Beach",
      state: "FL",
      zip: "33401",
    },
    appointmentDate: getUpcomingBookableDates(2)[1].value,
    appointmentTime: "9:00 AM",
    slotStartMinutes: 540,
    addressLat: 26.72,
    addressLon: -80.05,
    travelDistanceMiles: 12,
    travelFee: 13,
    customerFirstName: "Tia",
    customerLastName: "Test",
    customerPhone: "+15615550123",
    paymentMethodId: "22222222-2222-4222-8222-222222222222",
    idempotencyKey: "33333333-3333-4333-8333-333333333333",
    dogs: Array.from({ length: count }, (_, index) => ({
      petId: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
      serviceId: service.id,
      serviceName: service.name,
      addOnIds: [],
      addOnOptions: {},
      estimatedTotal: index === 0 ? 103 : 90,
    })),
  };
}

describe("multi-dog customer booking", () => {
  it("puts Add Another Dog below care options and immediately left of Continue", () => {
    const html = renderToStaticMarkup(
      <BookingCareOptionsStep
        pet={pet}
        primaryService={service}
        selectedIds={[]}
        addOnOptions={{}}
        onToggle={() => {}}
        onOptionChange={() => {}}
        onBack={() => {}}
        onContinue={() => {}}
        onAddDog={() => {}}
      />,
    );
    assert.ok(
      html.indexOf("Explore Options") < html.indexOf("+ Add Another Dog"),
    );
    assert.match(
      html,
      /\+ Add Another Dog<\/button><button[^>]*>Continue<\/button>/,
    );
  });
  it("keeps the dog-details step as one dog and offers a way back from an accidental addition", () => {
    const html = renderToStaticMarkup(
      <BookingDogStep
        draftPet={pet}
        onDraftChange={() => {}}
        onContinue={() => {}}
        onBack={() => {}}
      />,
    );
    assert.equal(html.includes("Add Another Dog"), false);
    assert.ok(html.includes("Back to your dogs"));
  });
  it("reports every invalid dog before any group save", () => {
    const second = { ...createDraftBookingPet(), name: "Max" };
    const third = {
      ...createDraftBookingPet(),
      name: "Daisy",
      breed: "Maltese",
      weightLbs: 0,
    };
    const errors = validateBookingDogs([pet, second, third]);
    assert.equal(errors[pet.id], undefined);
    assert.ok(errors[second.id]);
    assert.ok(errors[third.id]);
  });
  it("adds each dog's own duration without a separate travel gap between them", () => {
    const other = allBookableServices().find(
      (item) => item.id === "custom-full-haircut",
    )!;
    const dogs = [
      { pet, service, addOnIds: ["mini-trim"], addOnOptions: {}, spaGoals: [] },
      {
        pet: { ...pet, id: "other", weightLbs: 18 },
        service: other,
        addOnIds: [],
        addOnOptions: {},
        spaGoals: [],
      },
    ];
    assert.equal(
      bookingDogsDuration(dogs),
      bookingDurationMinutes(service.id, 12, ["mini-trim"]) +
        bookingDurationMinutes(other.id, 18),
    );
  });
  it("validates every dog, keeps one shared address, and imposes no arbitrary dog-count cap", () => {
    const body = request(30);
    const inputs = validateGroupBookingInput(body);
    assert.equal(inputs.length, 30);
    assert.deepEqual(inputs[29].address, body.address);
    assert.throws(() =>
      validateGroupBookingInput({
        ...body,
        dogs: [
          ...body.dogs.slice(0, 29),
          { ...body.dogs[29], serviceId: "unknown" },
        ],
      }),
    );
  });
  it("rejects repeated dogs and protects the shared schedule from a dog-level override", () => {
    const body = request();
    assert.throws(
      () =>
        validateGroupBookingInput({
          ...body,
          dogs: [body.dogs[0], body.dogs[0]],
        }),
      /only be added once/,
    );
    const inputs = validateGroupBookingInput({
      ...body,
      dogs: body.dogs.map((dog) => ({
        ...dog,
        slotStartMinutes: 960,
        address: {},
      })),
    });
    assert.equal(inputs[2].slotStartMinutes, 540);
    assert.deepEqual(inputs[2].address, body.address);
  });
  it("changes the retry identity when any dog's care changes", () => {
    const inputs = validateGroupBookingInput(request());
    const changed = inputs.map((input, index) =>
      index === 2 ? { ...input, addOnIds: ["mini-trim"] } : input,
    );
    assert.notEqual(
      groupBookingIntentHash(inputs),
      groupBookingIntentHash(changed),
    );
  });
  it("keeps the intent when drafts are saved but distinguishes identical-looking household dogs", () => {
    const dog = {
      bookingKey: pet.id,
      pet,
      service,
      addOnIds: [],
      addOnOptions: {},
      spaGoals: [],
    };
    const saved = {
      ...dog,
      pet: { ...pet, id: "11111111-1111-4111-8111-111111111111" },
    };
    assert.equal(bookingDogsIntent([dog]), bookingDogsIntent([saved]));
    assert.notEqual(
      bookingDogsIntent([saved]),
      bookingDogsIntent([{ ...saved, bookingKey: "another-dog" }]),
    );
  });
});
